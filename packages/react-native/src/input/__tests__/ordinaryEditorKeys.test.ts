import type * as RN from "react-native"

import { createNativeOrdinaryEditorKeys, type TNativeOrdinaryEditorKeyEvent } from "../ordinaryEditorKeys"

const setup = () => {
  const original = { _nativeTag: 17 } as unknown as RN.TextInput
  const session = { windowId: "window", epoch: 1, active: true }
  let current: RN.TextInput | null = original
  let allowed = true
  const receive = jest.fn()
  const registry = createNativeOrdinaryEditorKeys("scope", () => session)
  const lease = registry.register("editor", { original, current: () => current, canAct: () => allowed, receive })
  const binding = registry.bindings()[0]
  const status = {
    ...binding,
    target: 17,
    ownerId: "scope",
    windowId: "window",
    epoch: 1,
    sequence: 1,
    ready: true,
    windowActive: true,
    error: "",
  }
  registry.acceptStatus(status)
  const event = (eventId = 1, phase: "down" | "up" = "down") =>
    ({
      nativeEvent: {
        ...binding,
        target: 17,
        ownerId: "scope",
        windowId: "window",
        epoch: 1,
        eventId,
        kind: "keyboard",
        key: "z",
        code: "KeyZ",
        location: 0,
        nativeCode: 29,
        characters: "z",
        phase,
        repeat: false,
        cancelled: false,
        isComposing: true,
        shiftKey: false,
        altKey: false,
        ctrlKey: true,
        metaKey: false,
        capsLock: false,
        nativeModifierData: "1",
        nativeDefaultHandled: false,
        timestamp: eventId,
      },
      target: original,
      currentTarget: original,
      persist: jest.fn(),
      preventDefault: jest.fn(),
    }) as unknown as TNativeOrdinaryEditorKeyEvent
  return {
    original,
    session,
    receive,
    registry,
    lease,
    binding,
    status,
    event,
    replace: (value: RN.TextInput | null) => {
      current = value
    },
    allow: (value: boolean) => {
      allowed = value
    },
  }
}
afterEach(() => jest.restoreAllMocks())

it("delivers the original event and editor for both phases without a native settlement channel", () => {
  const f = setup()
  const down = f.event(),
    up = f.event(2, "up")
  f.receive.mockImplementation((event: TNativeOrdinaryEditorKeyEvent) => event.preventDefault())
  expect(f.lease.receive(down)).toBe(true)
  expect(f.lease.receive(up)).toBe(true)
  expect(f.receive.mock.calls.map(([event]) => event)).toEqual([down, up])
  expect(f.receive.mock.calls[0][0]).toBe(down)
  expect(down.target).toBe(f.original)
  expect(down.currentTarget).toBe(f.original)
  expect(down.nativeEvent.isComposing).toBe(true)
  expect(down.nativeEvent.ctrlKey).toBe(true)
  expect(down.persist).toHaveBeenCalledTimes(1)
  expect(down.preventDefault).toHaveBeenCalledTimes(1)
  expect(Object.keys(f.lease).sort()).toEqual(["receive", "unregister"])
})
it.each(["ownerId", "bindingId", "bindingRevision", "windowId", "epoch", "target", "kind", "phase"] as const)(
  "rejects mismatched %s",
  (field) => {
    const f = setup(),
      event = f.event()
    Object.assign(event.nativeEvent, { [field]: typeof event.nativeEvent[field] === "number" ? 99 : "foreign" })
    expect(f.lease.receive(event)).toBe(false)
    expect(f.receive).not.toHaveBeenCalled()
  },
)
it("rejects foreign actual receivers, duplicate packets, cancelled downs and nonpositive serials", () => {
  const f = setup()
  const foreign = f.event()
  foreign.currentTarget = {} as RN.TextInput
  expect(f.lease.receive(foreign)).toBe(false)
  const cancelled = f.event()
  Object.assign(cancelled.nativeEvent, { cancelled: true })
  expect(f.lease.receive(cancelled)).toBe(false)
  expect(f.lease.receive(f.event(0))).toBe(false)
  const event = f.event()
  expect(f.lease.receive(event)).toBe(true)
  expect(f.lease.receive(event)).toBe(false)
  expect(f.receive).toHaveBeenCalledTimes(1)
})
it("requires matching current readiness and rejects stale status revisions/sequences", () => {
  const f = setup()
  f.registry.acceptStatus({ ...f.status, ready: false, sequence: 2 })
  f.registry.acceptStatus({ ...f.status, sequence: 1 })
  f.registry.acceptStatus({ ...f.status, bindingRevision: "foreign", sequence: 3 })
  expect(f.lease.receive(f.event())).toBe(false)
  f.registry.acceptStatus({ ...f.status, sequence: 4 })
  expect(f.lease.receive(f.event())).toBe(true)
  f.session.epoch++
  expect(f.lease.receive(f.event(2))).toBe(false)
})
it("retires delivery when the editor, guard, window or lease changes", () => {
  const f = setup()
  f.replace({} as RN.TextInput)
  expect(f.lease.receive(f.event())).toBe(false)
  f.replace(f.original)
  f.allow(false)
  expect(f.lease.receive(f.event())).toBe(false)
  f.allow(true)
  f.session.active = false
  expect(f.lease.receive(f.event())).toBe(false)
  f.session.active = true
  f.lease.unregister()
  expect(f.registry.bindings()).toEqual([])
  expect(f.lease.receive(f.event())).toBe(false)
  expect(f.receive).not.toHaveBeenCalled()
})
it("never lets a retired registration adopt a replacement with the same native tag", () => {
  const f = setup()
  f.lease.unregister()
  const next = f.registry.register("editor", {
    original: f.original,
    current: () => f.original,
    canAct: () => true,
    receive: f.receive,
  })
  expect(f.registry.bindings()[0].bindingRevision).not.toBe(f.binding.bindingRevision)
  expect(f.lease.receive(f.event())).toBe(false)
  expect(next.receive(f.event())).toBe(false)
  f.registry.dispose()
  expect(f.registry.bindings()).toEqual([])
  expect(next.receive(f.event())).toBe(false)
})

it("shares one native publisher between an editor and its containing field without replacing event receivers", () => {
  const f = setup(),
    root = {} as RN.View,
    receive = jest.fn()
  const observer = f.registry.register("field", {
    original: f.original,
    current: () => f.original,
    currentTarget: () => root,
    canAct: () => true,
    receive,
  })
  expect(f.registry.bindings()).toEqual([f.binding])
  const event = f.event()
  expect(f.lease.receive(event)).toBe(true)
  // React's native bubbling changes currentTarget for each receiver. The
  // adapter validates that actual value instead of rewriting it.
  Object.assign(event, { currentTarget: root })
  expect(observer.receive(event)).toBe(true)
  expect(receive.mock.calls[0][0]).toBe(event)
  expect(receive.mock.calls[0][0].target).toBe(f.original)
  expect(receive.mock.calls[0][0].currentTarget).toBe(root)
  expect(observer.receive(event)).toBe(false)
  expect(f.lease.receive(event)).toBe(false)
  f.lease.unregister()
  expect(f.registry.bindings()).toEqual([f.binding])
  const up = f.event(2, "up")
  Object.assign(up, { currentTarget: root })
  expect(observer.receive(up)).toBe(true)
  observer.unregister()
  expect(f.registry.bindings()).toEqual([])
})
it("retires a containing receiver independently and rejects an unmounted or foreign root", () => {
  const f = setup(),
    receive = jest.fn()
  let root: RN.View | null = {} as RN.View
  const observer = f.registry.register("field", {
    original: f.original,
    current: () => f.original,
    currentTarget: () => root,
    canAct: () => true,
    receive,
  })
  expect(observer.receive(f.event())).toBe(false)
  const event = f.event()
  Object.assign(event, { currentTarget: root })
  root = null
  expect(observer.receive(event)).toBe(false)
  observer.unregister()
  expect(f.lease.receive(f.event())).toBe(true)
  expect(receive).not.toHaveBeenCalled()
})
it("rejects an alias object with the same native tag while retaining the original publisher", () => {
  const f = setup(),
    alias = { _nativeTag: 17 } as unknown as RN.TextInput
  expect(() =>
    f.registry.register("alias", {
      original: alias,
      current: () => alias,
      canAct: () => true,
      receive: jest.fn(),
    }),
  ).toThrow("different original native control")
  expect(f.registry.bindings()).toEqual([f.binding])
  expect(f.lease.receive(f.event())).toBe(true)
})

it("admits only current native subtree observations and keeps the actual focused editor and receiving root", () => {
  const f = setup(),
    root = { _nativeTag: 91 } as unknown as RN.View,
    receive = jest.fn()
  const observer = f.registry.register("field", {
    original: root,
    current: () => root,
    subtree: true,
    currentTarget: () => root,
    canAct: () => true,
    receive,
  })
  const binding = f.registry.bindings().find((value) => value.targetTag === 91)!
  f.registry.acceptStatus({ ...f.status, ...binding, target: 91 })
  const event = f.event()
  Object.assign(event, { currentTarget: root })
  Object.assign(event.nativeEvent, { observerBindings: JSON.stringify([{ ...binding, bindingRevision: "retired" }]) })
  expect(observer.receive(event)).toBe(false)
  Object.assign(event.nativeEvent, { observerBindings: JSON.stringify([binding]) })
  expect(observer.receive(event)).toBe(true)
  expect(receive.mock.calls[0][0]).toBe(event)
  expect(event.target).toBe(f.original)
  expect(event.currentTarget).toBe(root)
  expect(observer.receive(event)).toBe(false)
  observer.unregister()
  expect(f.registry.bindings()).toEqual([f.binding])
})
