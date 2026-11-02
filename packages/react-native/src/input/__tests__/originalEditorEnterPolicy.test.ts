import type { TextInput } from "react-native"

import type { TNativeOrdinaryEditorKeyEvent } from "../ordinaryEditorKeys"
import { createNativeOriginalEditorEnterAdapter } from "../originalEditorEnterPolicy"
import type { TNativeOriginalEditorActionFrame } from "../originalEditorKeyPolicy"

const setup = () => {
  const original = { _nativeTag: 17 } as unknown as TextInput
  const state = {
    original: original as TextInput | null,
    enabled: true,
    lifetimeKey: "model",
    allowed: true,
    ready: true,
    query: " query ",
  }
  const submit = jest.fn()
  const adapter = createNativeOriginalEditorEnterAdapter({
    current: () => ({ ...state, canAct: () => state.allowed }),
    isCurrent: (target, frame) => state.ready && target === state.original && frame.windowId === "window",
    onSubmit: () => submit(state.query.trim()),
  })
  const frame = (overrides: Partial<TNativeOriginalEditorActionFrame> = {}): TNativeOriginalEditorActionFrame => ({
    ownerId: "owner",
    policyId: "policy",
    policyRevision: 1,
    bindingId: "binding",
    bindingRevision: "1",
    windowId: "window",
    epoch: 1,
    targetTag: 17,
    dispatchId: 1,
    admitted: true,
    isComposing: false,
    key: "Enter",
    nativeCode: 66,
    characters: "\n",
    repeat: false,
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    capsLock: false,
    nativeModifierData: "0",
    timestamp: 1,
    ...overrides,
  })
  const event = (value: TNativeOriginalEditorActionFrame): TNativeOrdinaryEditorKeyEvent =>
    ({
      target: original,
      currentTarget: original,
      persist: jest.fn(),
      preventDefault: jest.fn(),
      nativeEvent: {
        ...value,
        target: 17,
        kind: "keyboard",
        phase: "down",
        cancelled: false,
        eventId: value.dispatchId,
        code: "Enter",
        location: 0,
        observerBindings: "[]",
        nativeDefaultHandled: true,
        originalEditorAction: JSON.stringify(value),
      },
    }) as unknown as TNativeOrdinaryEditorKeyEvent
  return { state, original, submit, adapter, frame, event }
}

it.each(Array.from({ length: 16 }, (_, index) => index))(
  "pairs modifier mask %s and genuine repeat receipts without a fabricated stock event",
  (mask) => {
    const f = setup(),
      first = f.frame({
        shiftKey: !!(mask & 8),
        altKey: !!(mask & 4),
        ctrlKey: !!(mask & 2),
        metaKey: !!(mask & 1),
        nativeModifierData: String(mask),
      }),
      original = f.event(first)
    expect(f.adapter.onAction(first)).toBe(true)
    expect(f.submit).not.toHaveBeenCalled()
    expect(f.adapter.receive(original)).toBe(true)
    expect(f.submit).toHaveBeenLastCalledWith("query")
    expect(f.adapter.receive(original)).toBe(false)
    expect(f.adapter.onAction(first)).toBe(false)
    const repeat = f.frame({ ...first, dispatchId: 2, timestamp: 2, repeat: true })
    expect(f.adapter.onAction(repeat)).toBe(true)
    expect(f.adapter.receive(f.event(repeat))).toBe(true)
    expect(f.submit).toHaveBeenCalledTimes(2)
    expect(original.preventDefault).not.toHaveBeenCalled()
  },
)

it("does not turn composing, uncaptured, cancelled or foreign-original observations into query requests", () => {
  const f = setup(),
    frame = f.frame()
  expect(f.adapter.onAction(f.frame({ isComposing: true }))).toBe(false)
  expect(f.adapter.onAction(frame)).toBe(true)
  for (const patch of [
    { isComposing: true },
    { nativeDefaultHandled: false },
    { cancelled: true },
    { ownerId: "foreign" },
  ]) {
    const event = f.event(frame)
    Object.assign(event.nativeEvent, patch)
    expect(f.adapter.receive(event)).toBe(false)
  }
  const foreign = f.event(frame)
  foreign.target = { _nativeTag: 17 } as unknown as TextInput
  expect(f.adapter.receive(foreign)).toBe(false)
  expect(f.submit).not.toHaveBeenCalled()
  expect(f.adapter.receive(f.event(frame))).toBe(true)
  expect(f.submit).toHaveBeenCalledTimes(1)
})

it("requires exact native metadata and original fields rather than a timing or next-submit heuristic", () => {
  const f = setup(),
    frame = f.frame()
  expect(f.adapter.onAction(frame)).toBe(true)
  for (const patch of [
    { originalEditorAction: "invalid" },
    { originalEditorAction: "null" },
    { key: "Space" },
    { timestamp: 99 },
    { bindingRevision: "old" },
  ]) {
    const event = f.event(frame)
    Object.assign(event.nativeEvent, patch)
    expect(f.adapter.receive(event)).toBe(false)
  }
  const changed = f.event(frame)
  Object.assign(changed.nativeEvent, { originalEditorAction: JSON.stringify({ ...frame, repeat: true }) })
  expect(f.adapter.receive(changed)).toBe(false)
  expect(f.submit).not.toHaveBeenCalled()
  f.state.query = " latest owner "
  expect(f.adapter.receive(f.event(frame))).toBe(true)
  expect(f.submit).toHaveBeenCalledWith("latest owner")
})

it.each(["enabled", "allowed", "ready"] as const)("refuses pending work after %s retirement", (guard) => {
  const f = setup(),
    frame = f.frame()
  f.adapter.onAction(frame)
  f.state[guard] = false
  expect(f.adapter.receive(f.event(frame))).toBe(false)
  f.adapter.retire()
  f.state[guard] = true
  expect(f.adapter.receive(f.event(frame))).toBe(false)
  expect(f.adapter.onAction(frame)).toBe(false)
  expect(f.submit).not.toHaveBeenCalled()
})

it("does not revive a pending request after original or model owner replacement and restoration", () => {
  const f = setup(),
    frame = f.frame()
  f.adapter.onAction(frame)
  f.state.original = { _nativeTag: 17 } as unknown as TextInput
  expect(f.adapter.receive(f.event(frame))).toBe(false)
  f.state.original = f.original
  expect(f.adapter.receive(f.event(frame))).toBe(false)
  const fresh = f.frame({ dispatchId: 2, timestamp: 2 })
  f.adapter.onAction(fresh)
  f.state.lifetimeKey = "replacement"
  expect(f.adapter.receive(f.event(fresh))).toBe(false)
  f.state.lifetimeKey = "model"
  expect(f.adapter.receive(f.event(fresh))).toBe(false)
  expect(f.submit).not.toHaveBeenCalled()
})

it("retires unmatched held metadata on its real original key-up without selecting a result", () => {
  const f = setup(),
    frame = f.frame()
  f.adapter.onAction(frame)
  const up = f.event(frame)
  Object.assign(up.nativeEvent, { phase: "up", timestamp: 2 })
  expect(f.adapter.receive(up)).toBe(false)
  expect(f.adapter.receive(f.event(frame))).toBe(false)
  expect(f.submit).not.toHaveBeenCalled()
})

it("consumes before a reentrant or throwing callback so the same physical event cannot replay", () => {
  const f = setup(),
    frame = f.frame(),
    event = f.event(frame)
  f.adapter.onAction(frame)
  f.submit.mockImplementation(() => {
    expect(f.adapter.receive(event)).toBe(false)
    throw new Error("owner callback")
  })
  expect(() => f.adapter.receive(event)).toThrow("owner callback")
  expect(f.adapter.receive(event)).toBe(false)
  expect(f.submit).toHaveBeenCalledTimes(1)
})
