import type { View } from "react-native"

import {
  createNativeToolbarKeyboard,
  deliverNativeToolbarTargetKey,
  readNativeToolbarOriginalRoute,
  type TNativeToolbarOriginalKeyEvent,
} from "../nativeToolbarKeyboard"
import { createNativeOrdinaryEditorKeys } from "../ordinaryEditorKeys"

const setup = () => {
  const root = { _nativeTag: 17 } as unknown as View
  const target = { _nativeTag: 23 } as unknown as View
  const ancestor = { _nativeTag: 91 } as unknown as View
  const session = { windowId: "window", epoch: 1, active: true }
  const toolbar = createNativeToolbarKeyboard("toolbar", () => session)
  const lease = toolbar.register("group", root, {
    orientation: "horizontal",
    current: () => root,
    canAct: () => true,
    receive: jest.fn(),
  })
  const binding = JSON.parse(toolbar.bindings())[0]
  toolbar.acceptStatus(
    JSON.stringify({
      ...binding,
      ownerId: "toolbar",
      windowId: "window",
      epoch: 1,
      sequence: 1,
      ready: true,
      windowActive: true,
      nestedToolbar: false,
      error: "",
    }),
  )
  const route = {
    ...binding,
    ownerId: "toolbar",
    windowId: "window",
    epoch: 1,
    eventId: 1,
    physicalPath: [23, 17, 91],
    target: 23,
    focusedTarget: 23,
    requestedTarget: -1,
    destinationTarget: -1,
    focusObserved: false,
    key: "Home",
    nativeCode: 122,
    characters: "",
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
    disposition: "ordinary",
    timestamp: 1,
  }
  const event = () =>
    ({
      target,
      currentTarget: target,
      nativeEvent: {
        ...route,
        kind: "keyboard",
        bindingId: "editor-binding",
        bindingRevision: "editor-revision",
        eventId: 101,
        observerBindings: "[]",
        toolbarRoute: JSON.stringify(route),
      },
      persist: jest.fn(),
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    }) as unknown as TNativeToolbarOriginalKeyEvent
  return { root, target, ancestor, session, toolbar, lease, route, event }
}

afterEach(() => jest.restoreAllMocks())
it("delivers an admitted original target event by identity and leaves ordinary Home/End/default data intact", () => {
  const f = setup(),
    receive = jest.fn(),
    event = f.event()
  expect(deliverNativeToolbarTargetKey(f.target, event, { onKeyDown: receive })).toBe(true)
  expect(receive.mock.calls[0][0]).toBe(event)
  expect(receive.mock.calls[0][0].target).toBe(f.target)
  expect(event.currentTarget).toBe(f.target)
  expect(event.nativeEvent.nativeDefaultHandled).toBe(false)
  expect(event.preventDefault).not.toHaveBeenCalled()
  expect(event.stopPropagation).not.toHaveBeenCalled()
  f.toolbar.dispose()
})
it("rejects portalled physical outsiders and stale group/root/window metadata without rewriting the event", () => {
  const f = setup(),
    event = f.event()
  event.currentTarget = { _nativeTag: 77 } as unknown as View
  expect(readNativeToolbarOriginalRoute(event)).toBeNull()
  event.currentTarget = f.ancestor
  expect(readNativeToolbarOriginalRoute(event)).toMatchObject({ rootTarget: 17 })
  f.session.epoch = 2
  expect(readNativeToolbarOriginalRoute(event)).toBeNull()
  f.session.epoch = 1
  f.lease.unregister()
  expect(readNativeToolbarOriginalRoute(event)).toBeNull()
  f.toolbar.dispose()
})
it("requires the real target/currentTarget and refuses malformed or mismatched original-event provenance", () => {
  const f = setup(),
    receive = jest.fn(),
    event = f.event()
  event.currentTarget = f.ancestor
  expect(deliverNativeToolbarTargetKey(f.target, event, { onKeyDown: receive })).toBe(false)
  event.currentTarget = f.target
  Object.assign(event.nativeEvent, { key: "End" })
  expect(readNativeToolbarOriginalRoute(event)).toBeNull()
  Object.assign(event.nativeEvent, { toolbarRoute: "not-json" })
  expect(readNativeToolbarOriginalRoute(event)).toBeNull()
  expect(receive).not.toHaveBeenCalled()
  f.toolbar.dispose()
})
it("admits capture and bubble independently across an exact editor's source scope using each listener's own acknowledged lease", () => {
  const f = setup(),
    order: string[] = [],
    current = { windowId: "window", epoch: 7, active: true }
  const registry = createNativeOrdinaryEditorKeys("ancestor-scope", () => current)
  const options = { original: f.ancestor, current: () => f.ancestor, canAct: () => true, subtree: true, toolbar: true }
  const capture = registry.register("capture", {
    ...options,
    receive: (event) => {
      expect(event.currentTarget).toBe(f.ancestor)
      order.push("capture")
    },
  })
  const bubble = registry.register("bubble", {
    ...options,
    receive: (event) => {
      expect(event.target).toBe(f.target)
      order.push("bubble")
    },
  })
  const binding = registry.bindings()[0]
  registry.acceptStatus({
    ...binding,
    ownerId: "ancestor-scope",
    target: 91,
    windowId: "window",
    epoch: 7,
    sequence: 1,
    ready: true,
    windowActive: true,
    error: "",
  })
  const event = f.event()
  event.currentTarget = f.ancestor
  Object.assign(event.nativeEvent, {
    ownerId: "exact-editor-scope",
    epoch: 3,
    observerBindings: JSON.stringify([{ ...binding, ownerId: "ancestor-scope", windowId: "window", epoch: 7 }]),
  })
  expect(capture.receive(event)).toBe(true)
  event.currentTarget = f.target
  expect(
    deliverNativeToolbarTargetKey(f.target, event, {
      onKeyDown: (received) => {
        expect(received).toBe(event)
        order.push("target")
      },
    }),
  ).toBe(true)
  event.currentTarget = f.ancestor
  expect(bubble.receive(event)).toBe(true)
  expect(capture.receive(event)).toBe(false)
  expect(bubble.receive(event)).toBe(false)
  expect(order).toEqual(["capture", "target", "bubble"])
  current.epoch++
  Object.assign(event.nativeEvent, { eventId: 102 })
  expect(capture.receive(event)).toBe(false)
  registry.dispose()
  f.toolbar.dispose()
})
it("keeps ordinary non-toolbar foreign-scope delivery rejected and never infers toolbar metadata", () => {
  const f = setup(),
    receive = jest.fn()
  const registry = createNativeOrdinaryEditorKeys("ancestor-scope", () => ({
    windowId: "window",
    epoch: 1,
    active: true,
  }))
  const lease = registry.register("capture", {
    original: f.ancestor,
    current: () => f.ancestor,
    canAct: () => true,
    subtree: true,
    receive,
  })
  const binding = registry.bindings()[0]
  registry.acceptStatus({
    ...binding,
    ownerId: "ancestor-scope",
    target: 91,
    windowId: "window",
    epoch: 1,
    sequence: 1,
    ready: true,
    windowActive: true,
    error: "",
  })
  const event = f.event()
  event.currentTarget = f.ancestor
  Object.assign(event.nativeEvent, {
    ownerId: "foreign",
    observerBindings: JSON.stringify([binding]),
    toolbarRoute: undefined,
  })
  expect(lease.receive(event)).toBe(false)
  expect(readNativeToolbarOriginalRoute(event)).toBeNull()
  expect(receive).not.toHaveBeenCalled()
  registry.dispose()
  f.toolbar.dispose()
})
it("rejects replaced originals and retired window leases while preserving editor composition observations", () => {
  const f = setup(),
    event = f.event(),
    receive = jest.fn()
  Object.assign(event.nativeEvent, {
    isComposing: true,
    key: "ArrowLeft",
    nativeCode: 21,
    toolbarRoute: JSON.stringify({
      ...f.route,
      key: "ArrowLeft",
      nativeCode: 21,
      disposition: "ordinary",
      isComposing: true,
    }),
  })
  expect(deliverNativeToolbarTargetKey(f.target, event, { onKeyDown: receive })).toBe(true)
  expect(receive.mock.calls[0][0].nativeEvent.isComposing).toBe(true)
  expect(event.preventDefault).not.toHaveBeenCalled()
  const alias = { _nativeTag: 23 } as unknown as View
  expect(deliverNativeToolbarTargetKey(alias, event, { onKeyDown: receive })).toBe(false)
  f.toolbar.setEnabled(false)
  expect(deliverNativeToolbarTargetKey(f.target, event, { onKeyDown: receive })).toBe(false)
  f.toolbar.dispose()
})
