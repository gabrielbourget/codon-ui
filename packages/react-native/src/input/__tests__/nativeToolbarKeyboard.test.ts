import type { View } from "react-native"

import {
  createNativeToolbarKeyboard,
  type TNativeToolbarKeyboardEvent,
  type TNativeToolbarKeyData,
} from "../nativeToolbarKeyboard"

const setup = () => {
  const root = { _nativeTag: 17 } as unknown as View
  let current: View | null = root
  let allowed = true
  const session = { windowId: "window", epoch: 1, active: true }
  const receive = jest.fn()
  const registry = createNativeToolbarKeyboard("scope", () => session)
  const register = () =>
    registry.register("toolbar", root, {
      orientation: "horizontal",
      current: () => current,
      canAct: () => allowed,
      receive,
    })
  const lease = register()
  const binding = JSON.parse(registry.bindings())[0]
  const status = {
    ...binding,
    ownerId: "scope",
    windowId: "window",
    epoch: 1,
    sequence: 1,
    ready: true,
    windowActive: true,
    nestedToolbar: false,
    error: "",
  }
  const accept = (overrides = {}) => registry.acceptStatus(JSON.stringify({ ...status, ...overrides }))
  accept()
  const event = (overrides: Partial<TNativeToolbarKeyData> = {}) =>
    ({
      nativeEvent: {
        packet: JSON.stringify({
          ...status,
          target: 23,
          focusedTarget: 23,
          requestedTarget: 29,
          destinationTarget: 29,
          focusObserved: true,
          eventId: 1,
          key: "Tab",
          nativeCode: 61,
          characters: "\t",
          phase: "down",
          repeat: false,
          cancelled: false,
          isComposing: false,
          shiftKey: false,
          altKey: false,
          ctrlKey: false,
          metaKey: false,
          capsLock: false,
          nativeModifierData: "0",
          nativeDefaultHandled: false,
          disposition: "tab",
          timestamp: 10,
          ...overrides,
        }),
      },
      persist: jest.fn(),
    }) as unknown as TNativeToolbarKeyboardEvent
  return {
    registry,
    root,
    lease,
    binding,
    status,
    session,
    receive,
    event,
    accept,
    register,
    replace: (next: View | null) => {
      current = next
    },
    allow: (next: boolean) => {
      allowed = next
    },
  }
}

it("delivers noncapturing Tab observations exactly once without consumed-policy dispatch or event rebranding", () => {
  const f = setup()
  const originalObservation = f.event()
  expect(f.registry.dispatch(originalObservation)).toBe(true)
  expect(f.registry.dispatch(originalObservation)).toBe(false)
  expect(f.receive).toHaveBeenCalledTimes(1)
  expect(f.receive.mock.calls[0][1]).toBe(originalObservation)
  expect(f.receive.mock.calls[0][0]).toMatchObject({
    target: 23,
    rootTarget: 17,
    nativeDefaultHandled: false,
    disposition: "tab",
  })
  expect(originalObservation.persist).toHaveBeenCalledTimes(1)
  expect(f.registry.dispatch(f.event({ eventId: 2, shiftKey: true, phase: "up" }))).toBe(true)
  expect(f.registry.dispatch(f.event({ eventId: 3, nativeDefaultHandled: true }))).toBe(false)
})
it("retains arrow focus-only and ordinary Home/End dispositions plus cancelled release metadata", () => {
  const f = setup()
  expect(f.registry.dispatch(f.event({ key: "ArrowRight", disposition: "arrow", nativeDefaultHandled: true }))).toBe(
    true,
  )
  expect(f.registry.dispatch(f.event({ eventId: 2, key: "Home", disposition: "ordinary" }))).toBe(true)
  expect(f.registry.dispatch(f.event({ eventId: 3, key: "End", disposition: "ordinary" }))).toBe(true)
  expect(f.registry.dispatch(f.event({ eventId: 4, phase: "up", cancelled: true }))).toBe(true)
  expect(f.registry.dispatch(f.event({ eventId: 5, cancelled: true }))).toBe(false)
})
it.each(["ownerId", "bindingId", "bindingRevision", "rootTarget", "windowId", "epoch"] as const)(
  "rejects foreign %s",
  (field) => {
    const f = setup()
    const value = typeof f.status[field] === "number" ? 99 : "foreign"
    expect(f.registry.dispatch(f.event({ [field]: value }))).toBe(false)
    expect(f.accept({ [field]: value, sequence: 2 })).toBe(false)
    expect(f.receive).not.toHaveBeenCalled()
  },
)
it("requires matching native readiness and returns physical nesting independently of React ancestry", () => {
  const f = setup()
  expect(f.registry.status("toolbar")).toEqual({ ready: true, nestedToolbar: false, error: "" })
  expect(f.accept({ sequence: 2, ready: false, nestedToolbar: true })).toBe(false)
  expect(f.registry.status("toolbar")).toEqual({ ready: false, nestedToolbar: true, error: "" })
  expect(f.registry.dispatch(f.event())).toBe(false)
  expect(f.accept({ sequence: 1 })).toBe(false)
  expect(f.accept({ sequence: 3, nestedToolbar: true })).toBe(true)
  expect(f.registry.status("toolbar")).toEqual({ ready: true, nestedToolbar: true, error: "" })
})
it("retires replaced roots, disabled/session work and unmounted leases", () => {
  const f = setup()
  f.replace({ _nativeTag: 17 } as unknown as View)
  expect(f.registry.dispatch(f.event())).toBe(false)
  f.replace(f.root)
  f.allow(false)
  expect(f.registry.dispatch(f.event())).toBe(false)
  f.allow(true)
  f.session.active = false
  expect(f.registry.dispatch(f.event())).toBe(false)
  f.session.active = true
  f.registry.setEnabled(false)
  f.registry.setEnabled(true)
  expect(f.registry.dispatch(f.event())).toBe(false)
  f.lease.unregister()
  f.register()
  expect(f.registry.dispatch(f.event())).toBe(false)
  f.registry.dispose()
  expect(f.registry.dispatch(f.event())).toBe(false)
})
it("rejects malformed packets and nonpositive or duplicate event identities", () => {
  const f = setup()
  expect(f.registry.acceptStatus("null")).toBe(false)
  expect(f.registry.acceptStatus("not-json")).toBe(false)
  expect(f.registry.dispatch(f.event({ eventId: 0 }))).toBe(false)
  expect(f.registry.dispatch(f.event({ target: -1 }))).toBe(false)
  expect(f.registry.dispatch({ nativeEvent: { packet: "[]" } } as unknown as TNativeToolbarKeyboardEvent)).toBe(false)
  expect(f.receive).not.toHaveBeenCalled()
})
