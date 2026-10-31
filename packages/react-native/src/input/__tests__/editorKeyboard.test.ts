import type { TextInput } from "react-native"

import {
  NativeEditorKeyboardLease,
  type TNativeEditorKeyData,
  type TNativeEditorKeyEvent,
  type TNativeEditorKeyboardCallbacks,
} from "../editorKeyboard"

const identity = {
  ownerId: "owner",
  bindingId: "field",
  bindingRevision: "revision",
  target: 17,
  windowId: "window",
  epoch: 1,
}
const setup = () => {
  // Identity models only; these objects are never presented as native SDK editors.
  const original = {} as TextInput
  let current: TextInput | null = original
  let callbacks: TNativeEditorKeyboardCallbacks = {}
  const acknowledge = jest.fn(() => true)
  const lease = new NativeEditorKeyboardLease({
    identity,
    original,
    current: () => current,
    callbacks: () => callbacks,
    acknowledge,
  })
  const status = (sequence = 1, ready = true, windowActive = true) => ({ ...identity, sequence, ready, windowActive })
  const event = (extra: Partial<TNativeEditorKeyData> = {}) => {
    let prevented = false
    return {
      nativeEvent: {
        ...identity,
        eventId: 1,
        phase: "down",
        key: "a",
        code: "KeyA",
        nativeCode: 4,
        location: 0,
        repeat: false,
        cancelled: false,
        isComposing: false,
        shiftKey: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        capsLock: false,
        nativeModifierData: "0",
        timestamp: 100,
        ...extra,
      },
      persist: jest.fn(),
      preventDefault: jest.fn(() => {
        prevented = true
      }),
      isDefaultPrevented: () => prevented,
      get defaultPrevented() {
        return prevented
      },
    } as unknown as TNativeEditorKeyEvent
  }
  return {
    original,
    lease,
    acknowledge,
    status,
    event,
    replace: () => {
      current = {} as TextInput
    },
    callbacks: (value: TNativeEditorKeyboardCallbacks) => {
      callbacks = value
    },
  }
}

it("keeps original event/editor identity, owned-before-caller order and a once-only veto acknowledgement", () => {
  const f = setup(),
    trace: string[] = [],
    original = f.event()
  f.callbacks({
    owned: (event, editor) => {
      expect(event).toBe(original)
      expect(editor).toBe(f.original)
      trace.push("owned")
    },
    onKeyDown: (event, editor) => {
      expect(event).toBe(original)
      expect(editor).toBe(f.original)
      trace.push("caller")
      event.preventDefault()
    },
  })
  expect(f.lease.acceptStatus(f.status())).toBe(true)
  expect(f.lease.receive(original)).toBe("acknowledged")
  expect(trace).toEqual(["owned", "caller"])
  expect(f.acknowledge.mock.calls).toEqual([
    [{ ...identity, eventId: 1, phase: "down", current: true, preventDefault: true }],
  ])
  expect(f.lease.receive(original)).toBe("rejected")
  expect(f.acknowledge).toHaveBeenCalledTimes(1)
})

it.each(["up", "cancel"] as const)("delivers the actual %s phase without inventing a down callback", (phase) => {
  const f = setup(),
    down = jest.fn(),
    up = jest.fn(),
    cancel = jest.fn()
  f.callbacks({ onKeyDown: down, onKeyUp: up, onKeyCancel: cancel })
  f.lease.acceptStatus(f.status())
  const event = f.event({ phase, cancelled: phase === "cancel" })
  expect(f.lease.receive(event)).toBe("acknowledged")
  expect(down).not.toHaveBeenCalled()
  expect(phase === "up" ? up : cancel).toHaveBeenCalledWith(event, f.original)
  expect(phase === "up" ? cancel : up).not.toHaveBeenCalled()
})

it.each(["ownerId", "bindingId", "bindingRevision", "target", "windowId", "epoch"] as const)(
  "rejects foreign %s before any callback or acknowledgement",
  (field) => {
    const f = setup(),
      callback = jest.fn()
    f.callbacks({ onKeyDown: callback })
    f.lease.acceptStatus(f.status())
    const event = f.event({ [field]: typeof identity[field] === "number" ? 99 : "foreign" })
    expect(f.lease.receive(event)).toBe("rejected")
    expect(callback).not.toHaveBeenCalled()
    expect(f.acknowledge).not.toHaveBeenCalled()
  },
)

it("requires current native readiness and never revives a replaced or retired editor", () => {
  const f = setup()
  expect(f.lease.receive(f.event())).toBe("rejected")
  f.lease.acceptStatus(f.status())
  expect(f.lease.acceptStatus(f.status(2, true, false))).toBe(false)
  expect(f.lease.acceptStatus(f.status())).toBe(false)
  expect(f.lease.receive(f.event())).toBe("rejected")
  f.lease.acceptStatus(f.status(3))
  f.replace()
  expect(f.lease.receive(f.event())).toBe("rejected")
  f.lease.retire()
  expect(f.lease.acceptStatus(f.status(4))).toBe(false)
})

it("uses replaced callbacks without replacing the binding and reports missing synchronous acknowledgement", () => {
  const f = setup(),
    old = jest.fn(),
    latest = jest.fn()
  f.callbacks({ onKeyDown: old })
  f.lease.acceptStatus(f.status())
  f.callbacks({ onKeyDown: latest })
  f.acknowledge.mockReturnValue(false)
  const event = f.event({ repeat: true, isComposing: true, altKey: true })
  expect(f.lease.receive(event)).toBe("unacknowledged")
  expect(old).not.toHaveBeenCalled()
  expect(latest).toHaveBeenCalledWith(event, f.original)
})

it("settles after an original callback exception and preserves its veto and error", () => {
  const f = setup(),
    failure = new Error("original caller")
  f.callbacks({
    onKeyDown: (event) => {
      event.preventDefault()
      throw failure
    },
  })
  f.lease.acceptStatus(f.status())
  expect(() => f.lease.receive(f.event())).toThrow(failure)
  expect(f.acknowledge).toHaveBeenCalledWith({
    ...identity,
    eventId: 1,
    phase: "down",
    current: true,
    preventDefault: true,
  })
})

it("retires authority during an owned callback without calling a retired caller", () => {
  const f = setup(),
    caller = jest.fn()
  f.callbacks({ owned: () => f.lease.retire(), onKeyDown: caller })
  f.lease.acceptStatus(f.status())
  expect(f.lease.receive(f.event())).toBe("retired")
  expect(caller).not.toHaveBeenCalled()
  expect(f.acknowledge).toHaveBeenCalledWith({
    ...identity,
    eventId: 1,
    phase: "down",
    current: false,
    preventDefault: false,
  })
})

it("does not hold native authority for an asynchronous callback continuation", async () => {
  const f = setup()
  let continueCallback!: () => void
  const continuation = new Promise<void>((resolve) => {
    continueCallback = resolve
  })
  f.callbacks({
    onKeyDown: async (event) => {
      await continuation
      event.preventDefault()
    },
  })
  f.lease.acceptStatus(f.status())
  const event = f.event()
  expect(f.lease.receive(event)).toBe("acknowledged")
  expect(f.acknowledge.mock.calls).toEqual([
    [{ ...identity, eventId: 1, phase: "down", current: true, preventDefault: false }],
  ])
  continueCallback()
  await continuation
  expect(event.isDefaultPrevented()).toBe(true)
  expect(f.acknowledge).toHaveBeenCalledTimes(1)
  expect(f.lease.receive(event)).toBe("rejected")
})
