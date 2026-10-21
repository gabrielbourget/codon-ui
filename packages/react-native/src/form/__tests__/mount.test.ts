import type { NativeFormCommitData } from "../../input/specs/CUIFormRootNativeComponent"
import { NativeFormMountReceipt } from "../mount"

const scope = {
  ownerId: "owner",
  descriptorId: "field",
  descriptorRevision: "revision:1",
  target: 11,
  originalTarget: 12,
}
const packet = (updates: Partial<NativeFormCommitData> = {}): NativeFormCommitData => ({
  ...scope,
  surfaceId: 1,
  windowId: "window:1",
  epoch: 1,
  sequence: 1,
  mountRevision: "native-mount:1",
  attached: true,
  complete: true,
  metadataOnly: true,
  originalClass: "OriginalEditor",
  error: "",
  ...updates,
})
const setup = () => {
  const metadata = {},
    original = {}
  let current = true
  const receiver = new NativeFormMountReceipt(scope, {
    metadata,
    original,
    current: () => (current ? { metadata, original } : { metadata: null, original: null }),
  })
  return {
    receiver,
    replace: () => {
      current = false
    },
    restore: () => {
      current = true
    },
  }
}

it("retains a copied current original-target mount acknowledgment without granting a form action", () => {
  const { receiver } = setup()
  const value = packet()
  expect(receiver.receive(value)).toBe(true)
  expect(receiver.getSnapshot()).toEqual(value)
  expect(receiver.getSnapshot()).not.toBe(value)
  expect(Object.isFrozen(receiver.getSnapshot())).toBe(true)
})

it.each([
  ["foreign owner", { ownerId: "other" }],
  ["retired descriptor", { descriptorRevision: "old" }],
  ["foreign metadata", { target: 90 }],
  ["replaced editor", { originalTarget: 90 }],
  ["nonintegral epoch", { epoch: 1.5 }],
  ["missing mount identity", { mountRevision: "" }],
  ["missing surface", { surfaceId: -1 }],
  ["not inert", { metadataOnly: false }],
  ["detached completion", { attached: false }],
  ["failed completion", { error: "unavailable" }],
  ["missing original class", { originalClass: "" }],
] as const)("rejects %s", (_name, updates) => {
  const { receiver } = setup()
  expect(receiver.receive(packet(updates))).toBe(false)
  expect(receiver.getSnapshot()).toBeNull()
})

it("requires ordered native sequence and an advancing epoch for window replacement", () => {
  const { receiver } = setup()
  expect(receiver.receive(packet())).toBe(true)
  expect(receiver.receive(packet())).toBe(false)
  expect(receiver.receive(packet({ sequence: 2, windowId: "window:2" }))).toBe(false)
  expect(receiver.receive(packet({ sequence: 2, epoch: 2, windowId: "window:2" }))).toBe(true)
  expect(receiver.receive(packet({ sequence: 3 }))).toBe(false)
  expect(receiver.getSnapshot()?.windowId).toBe("window:2")
})

it("retires current completion on a valid incomplete/detached native status", () => {
  const { receiver } = setup()
  receiver.receive(packet())
  expect(
    receiver.receive(
      packet({ epoch: 2, sequence: 2, attached: false, complete: false, originalClass: "", error: "detached" }),
    ),
  ).toBe(true)
  expect(receiver.getSnapshot()).toBeNull()
  expect(receiver.receive(packet({ epoch: 3, sequence: 3 }))).toBe(true)
})

it("permanently retires original-ref authority before delayed callbacks and refuses resurrection", () => {
  const { receiver, replace, restore } = setup()
  receiver.receive(packet())
  replace()
  expect(receiver.getSnapshot()).toBeNull()
  restore()
  expect(receiver.receive(packet({ epoch: 2, sequence: 2 }))).toBe(false)
  expect(receiver.getSnapshot()).toBeNull()
})

it.each([null, undefined, []])("rejects malformed native payload %p without manufacturing readiness", (value) => {
  const { receiver } = setup()
  expect(receiver.receive(value as unknown as NativeFormCommitData)).toBe(false)
  expect(receiver.getSnapshot()).toBeNull()
})

it("does not consult a retired owner's current refs", () => {
  const metadata = {},
    original = {},
    current = jest.fn(() => ({ metadata, original }))
  const receiver = new NativeFormMountReceipt(scope, { metadata, original, current })
  receiver.retire()
  expect(receiver.getSnapshot()).toBeNull()
  expect(receiver.receive(packet())).toBe(false)
  expect(current).not.toHaveBeenCalled()
})
