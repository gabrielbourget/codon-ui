import type { View } from "react-native"

import {
  captureToolbarOriginal,
  createNativeToolbarKeyboard,
  deliverToolbarObserver,
  readNativeToolbarOriginalRoute,
} from "../nativeToolbarKeyboard"
import { createNativeOrdinaryEditorKeys, type TNativeToolbarDateKeyEvent } from "../ordinaryEditorKeys"

const setup = () => {
  const root = { _nativeTag: 17 } as unknown as View
  const field = { _nativeTag: 23 } as unknown as View
  const ancestor = { _nativeTag: 91 } as unknown as View
  const session = { windowId: "window", epoch: 1, active: true }
  const toolbar = createNativeToolbarKeyboard("group", () => session)
  const groupLease = toolbar.register("group", root, {
    orientation: "horizontal",
    current: () => root,
    canAct: () => true,
    receive: jest.fn(),
  })
  const group = JSON.parse(toolbar.bindings())[0]
  const status = {
    ...group,
    ownerId: "group",
    windowId: "window",
    epoch: 1,
    sequence: 1,
    ready: true,
    observationReady: true,
    windowActive: true,
    nestedToolbar: false,
    error: "",
  }
  toolbar.acceptStatus(JSON.stringify(status))
  const observerSession = { windowId: "window", epoch: 7, active: true }
  const observers = createNativeOrdinaryEditorKeys("ancestor", () => observerSession)
  const calls: unknown[][] = []
  const options = {
    original: ancestor,
    current: () => ancestor,
    canAct: () => true,
    subtree: true,
    toolbar: true,
    receive: jest.fn(),
  }
  const captureLease = observers.register("capture", {
    ...options,
    receiveDate: (event) =>
      deliverToolbarObserver(event, { onKeyDownCapture: (original) => calls.push(["capture", original]) }, "capture"),
  })
  const bubbleLease = observers.register("bubble", {
    ...options,
    receiveDate: (event) =>
      deliverToolbarObserver(event, { onKeyDown: (original) => calls.push(["bubble", original]) }, "bubble"),
  })
  const capture = {
    ...captureLease,
    receiveDate: (event: TNativeToolbarDateKeyEvent) => observers.receiveDate("capture", event),
  }
  const bubble = {
    ...bubbleLease,
    receiveDate: (event: TNativeToolbarDateKeyEvent) => observers.receiveDate("bubble", event),
  }
  const binding = observers.bindings()[0]
  observers.acceptStatus({
    ...binding,
    ownerId: "ancestor",
    target: 91,
    windowId: "window",
    epoch: 7,
    sequence: 1,
    ready: true,
    windowActive: true,
    error: "",
  })
  const route = {
    ...group,
    ownerId: "group",
    windowId: "window",
    epoch: 1,
    eventId: 1,
    rootTarget: 17,
    physicalPath: [23, 17, 91],
    observerBindings: [{ ...binding, ownerId: "ancestor", windowId: "window", epoch: 7 }],
    key: "ArrowLeft",
    nativeCode: 21,
    phase: "down",
    cancelled: false,
    disposition: "ordinary",
    nativeDefaultHandled: false,
  }
  const event = (overrides = {}) => {
    let stopped = false,
      prevented = false
    return {
      target: field,
      currentTarget: ancestor,
      nativeEvent: {
        kind: "keyboard",
        ownerId: "date-field",
        segmentId: "month",
        bindingRevision: "date-revision",
        target: 23,
        nativeInstance: "date-original",
        windowId: "window",
        epoch: 11,
        sequence: 101,
        key: "ArrowLeft",
        nativeCode: 21,
        phase: "down",
        cancelled: false,
        isComposing: false,
        nativeDefaultHandled: true,
        toolbarRoute: JSON.stringify(route),
        ...overrides,
      },
      persist: jest.fn(),
      stopPropagation: () => {
        stopped = true
      },
      isPropagationStopped: () => stopped,
      preventDefault: () => {
        prevented = true
      },
      isDefaultPrevented: () => prevented,
    } as unknown as TNativeToolbarDateKeyEvent
  }
  return {
    toolbar,
    groupLease,
    status,
    session,
    root,
    field,
    ancestor,
    observers,
    observerSession,
    capture,
    bubble,
    route,
    calls,
    event,
  }
}

it("preserves one genuine field-handled event through capture, target and bubble with independent field/group/listener identities", () => {
  const f = setup(),
    event = f.event(),
    fieldHandler = jest.fn()
  expect(f.capture.receiveDate(event)).toBe(true)
  event.currentTarget = f.field
  fieldHandler(event)
  event.currentTarget = f.ancestor
  expect(f.bubble.receiveDate(event)).toBe(true)
  expect(f.calls.map(([phase]) => phase)).toEqual(["capture", "bubble"])
  expect(f.calls[0][1]).toBe(event)
  expect(f.calls[1][1]).toBe(event)
  expect(fieldHandler.mock.calls[0][0]).toBe(event)
  expect(event.nativeEvent).toMatchObject({
    ownerId: "date-field",
    bindingRevision: "date-revision",
    epoch: 11,
    sequence: 101,
    nativeDefaultHandled: true,
  })
  expect(event.isDefaultPrevented()).toBe(false)
  expect(f.capture.receiveDate(event)).toBe(false)
  expect(f.bubble.receiveDate(event)).toBe(false)
  f.observers.dispose()
  f.toolbar.dispose()
})
it("keeps observations eligible when navigation is unready and never captures field arrows or composing observations", () => {
  const f = setup(),
    event = f.event({ isComposing: true })
  f.toolbar.acceptStatus(
    JSON.stringify({ ...f.status, sequence: 2, ready: false, observationReady: true, error: "focus-request-refused" }),
  )
  expect(f.toolbar.status("group").ready).toBe(false)
  expect(readNativeToolbarOriginalRoute(event)).not.toBeNull()
  expect(f.capture.receiveDate(event)).toBe(true)
  event.currentTarget = f.root
  captureToolbarOriginal(f.root, event)
  expect(event.isPropagationStopped()).toBe(false)
  expect(event.isDefaultPrevented()).toBe(false)
  expect(f.calls).toHaveLength(1)
  f.observers.dispose()
  f.toolbar.dispose()
})
it("retains real Tab default metadata while internal capture stops only subsequent JS phases", () => {
  const f = setup(),
    event = f.event({
      key: "Tab",
      nativeCode: 61,
      nativeDefaultHandled: false,
      toolbarRoute: JSON.stringify({ ...f.route, key: "Tab", nativeCode: 61, disposition: "tab" }),
    })
  event.currentTarget = f.root
  captureToolbarOriginal(f.root, event)
  expect(event.isPropagationStopped()).toBe(true)
  expect(event.isDefaultPrevented()).toBe(false)
  expect(event.nativeEvent.nativeDefaultHandled).toBe(false)
  expect(deliverToolbarObserver(event, { onKeyDown: jest.fn() }, "bubble")).toBe(false)
  f.observers.dispose()
  f.toolbar.dispose()
})
it("respects actual field stopPropagation and rejects portal, retired lease and stale listener sessions", () => {
  const f = setup(),
    event = f.event()
  expect(f.capture.receiveDate(event)).toBe(true)
  event.stopPropagation()
  expect(deliverToolbarObserver(event, { onKeyDown: jest.fn() }, "bubble")).toBe(false)
  const portal = f.event({ sequence: 102, toolbarRoute: JSON.stringify({ ...f.route, physicalPath: [23, 17] }) })
  expect(readNativeToolbarOriginalRoute(portal)).toBeNull()
  f.observerSession.epoch++
  expect(f.capture.receiveDate(f.event({ sequence: 103 }))).toBe(false)
  f.groupLease.unregister()
  expect(readNativeToolbarOriginalRoute(f.event())).toBeNull()
  f.observers.dispose()
  f.toolbar.dispose()
})
it("retires old field epochs after observing replacement and leaves non-toolbar date events untouched", () => {
  const f = setup()
  expect(f.capture.receiveDate(f.event())).toBe(true)
  expect(f.capture.receiveDate(f.event({ epoch: 12, sequence: 1 }))).toBe(true)
  expect(f.capture.receiveDate(f.event({ epoch: 11, sequence: 102 }))).toBe(false)
  expect(f.capture.receiveDate(f.event({ toolbarRoute: undefined, sequence: 103 }))).toBe(false)
  expect(f.calls).toHaveLength(2)
  f.observers.dispose()
  f.toolbar.dispose()
})
