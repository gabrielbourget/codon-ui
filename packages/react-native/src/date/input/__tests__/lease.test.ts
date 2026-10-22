import { createNativeDateSegmentLease } from "../lease"

import { packet } from "./packet"

const lease = () =>
  createNativeDateSegmentLease({ ownerId: "owner", segmentId: "hour", bindingRevision: "binding", target: 71 })
it("requires an actual admitted native status before accepting input or exposing a focus frame", () => {
  const binding = lease()
  expect(binding.frame()).toBeNull()
  expect(binding.accept(packet({ kind: "insert", focused: true, sequence: 2 }))).toBe(false)
  expect(binding.accept(packet())).toBe(true)
  expect(binding.frame()).toEqual({ windowId: "window", epoch: 4 })
  const original = packet({
    kind: "insert",
    text: "١",
    document: "١",
    selectionStart: 1,
    selectionEnd: 1,
    focused: true,
    sequence: 2,
  })
  expect(binding.accept(original)).toBe(true)
  expect(original.nativeData).toBe("{}")
  expect(binding.accept(original)).toBe(false)
})
it.each([
  { ownerId: "foreign" },
  { segmentId: "minute" },
  { bindingRevision: "old" },
  { target: 72 },
  { nativeInstance: "" },
  { target: 0 },
  { surfaceId: 0 },
  { epoch: NaN },
  { sequence: Infinity },
  { timestamp: -1 },
  { selectionStart: -1 },
  { selectionEnd: 1 },
  { composingStart: 0 },
  { kind: "invented" },
])("rejects foreign or malformed native lifetime data: %o", (extra) => {
  expect(lease().accept(packet(extra))).toBe(false)
})
it("preserves backwards native selections and actual marked-text ranges without treating them as values", () => {
  const binding = lease()
  binding.accept(packet())
  expect(
    binding.accept(
      packet({
        kind: "marked",
        document: "١٢",
        text: "١٢",
        selectionStart: 2,
        selectionEnd: 2,
        composingStart: 0,
        composingEnd: 2,
        focused: true,
        sequence: 2,
      }),
    ),
  ).toBe(true)
  expect(
    binding.accept(
      packet({
        kind: "selection",
        document: "١٢",
        selectionStart: 2,
        selectionEnd: 0,
        replacementStart: 2,
        replacementEnd: 0,
        focused: true,
        sequence: 3,
      }),
    ),
  ).toBe(true)
})
it("requires a new native generation after guard invalidation and rejects stale windows/epochs/replays", () => {
  const binding = lease()
  binding.accept(packet())
  binding.invalidate()
  expect(binding.frame()).toBeNull()
  expect(binding.accept(packet({ sequence: 2 }))).toBe(false)
  expect(binding.accept(packet({ epoch: 5, sequence: 3 }))).toBe(true)
  expect(binding.accept(packet({ kind: "focus", focused: true, windowId: "foreign", epoch: 5, sequence: 4 }))).toBe(
    false,
  )
  expect(binding.accept(packet({ windowId: "next", epoch: 5, sequence: 4 }))).toBe(false)
  expect(binding.accept(packet({ windowId: "next", epoch: 6, sequence: 5 }))).toBe(true)
  expect(binding.accept(packet({ kind: "insert", focused: true, epoch: 5, sequence: 6 }))).toBe(false)
  expect(binding.accept(packet({ active: false, epoch: 7, sequence: 7 }))).toBe(true)
  expect(binding.frame()).toBeNull()
  binding.retire()
  expect(binding.accept(packet({ epoch: 8, sequence: 8 }))).toBe(false)
})
it("only acknowledges focus/blur from consistent original native callbacks", () => {
  const binding = lease()
  binding.accept(packet())
  expect(binding.accept(packet({ kind: "focus", focused: false, sequence: 2 }))).toBe(false)
  expect(binding.accept(packet({ kind: "blur", focused: true, sequence: 3 }))).toBe(false)
  expect(binding.accept(packet({ kind: "insert", focused: false, sequence: 4 }))).toBe(false)
  expect(binding.accept(packet({ kind: "focus", focused: true, sequence: 5 }))).toBe(true)
})

it("rejects another SDK instance for the same numeric tag and owner", () => {
  const binding = lease()
  binding.accept(packet())
  expect(binding.accept(packet({ nativeInstance: "replacement-instance", sequence: 2, epoch: 5 }))).toBe(false)
})
