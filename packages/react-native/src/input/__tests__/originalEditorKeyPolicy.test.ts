import type { NativeSyntheticEvent, TextInput, View } from "react-native"

import { createNativeKeyScope, type TNativeKeyPolicy } from "../keyScope"
import { createNativeOrdinaryEditorKeys, type TNativeOrdinaryEditorKeyEvent } from "../ordinaryEditorKeys"
import {
  createNativeOriginalEditorActionReceiver,
  type TNativeOriginalEditorActionFrame,
} from "../originalEditorKeyPolicy"
import type { NativeScopedKeyData } from "../specs/CUIKeyboardScopeNativeComponent"
import type { TNativeKeyboardEvent } from "../types"

const ready = (scope: ReturnType<typeof createNativeKeyScope>) => {
  scope.acceptNativeStatus({
    ownerId: scope.ownerId,
    windowId: "window",
    epoch: 1,
    policyRevision: scope.policyRevision(),
    ready: false,
    windowActive: true,
  })
  scope.acceptNativeStatus({
    ownerId: scope.ownerId,
    windowId: "window",
    epoch: 1,
    policyRevision: scope.policyRevision(),
    ready: true,
    windowActive: true,
  })
}
const setup = () => {
  const original = { _nativeTag: 17 } as unknown as TextInput
  let target: TextInput | null = original,
    enabled = true,
    allowed = true,
    lifetimeKey = "config:1"
  const order: string[] = [],
    onAction = jest.fn((_frame: TNativeOriginalEditorActionFrame) => order.push("numeric"))
  const scope = createNativeKeyScope("scope")
  const nativeBindings = createNativeOrdinaryEditorKeys(scope.ownerId, () => ({
    ...scope.acknowledgedSession(),
    active: scope.isNativeReady(),
  }))
  const originalLease = nativeBindings.register("original", {
    original,
    current: () => target,
    canAct: () => allowed,
    receive: () => {},
  })
  const originalBinding = nativeBindings.bindings()[0]!

  const receive = createNativeOriginalEditorActionReceiver({
    current: () => ({
      original,
      target,
      enabled,
      tokens: ["0000:ArrowUp", "0000:Home"],
      lifetimeKey,
      canAct: () => allowed,
    }),
    session: () => ({
      ownerId: scope.ownerId,
      ...scope.acknowledgedSession(),
      policyRevision: scope.policyRevision(),
      ready: scope.isNativeReady(),
    }),
    onAction,
    binding: (target, frame) => nativeBindings.isCurrentActionBinding(target, frame),
  })
  const policy: TNativeKeyPolicy = {
    tokens: ["0000:ArrowUp", "0000:Home"],
    excludeEditable: false,
    excludeComposing: true,
    originalEditorAction: true,
    targetTag: 17,
    isEnabled: true,
    lifetimeKey,
    canAct: () => allowed,
    onKey: (event) => receive(event as NativeSyntheticEvent<NativeScopedKeyData>),
  }
  const lease = scope.register("stepper", policy)
  ready(scope)
  nativeBindings.acceptStatus({
    ...originalBinding,
    target: 17,
    ownerId: scope.ownerId,
    ...scope.acknowledgedSession(),
    sequence: 1,
    ready: true,
    windowActive: true,
    error: "",
  })
  const packet = (
    extra: Partial<NativeScopedKeyData> = {},
    frameExtra: Partial<TNativeOriginalEditorActionFrame> = {},
  ) => {
    const data: NativeScopedKeyData = {
      kind: "keyboard",
      ownerId: scope.ownerId,
      policyId: scope.policies()[0]?.id ?? "retired",
      target: 9,
      focusedTarget: 17,
      ...scope.acknowledgedSession(),
      policyRevision: scope.policyRevision(),
      key: "ArrowUp",
      nativeCode: 19,
      characters: "",
      phase: "down",
      repeat: false,
      cancelled: false,
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      capsLock: false,
      nativeModifierData: "0",
      nativeDefaultHandled: true,
      timestamp: 10,
      ...extra,
    }
    const frame: TNativeOriginalEditorActionFrame = {
      ownerId: data.ownerId,
      policyId: data.policyId,
      policyRevision: data.policyRevision,
      bindingId: originalBinding.bindingId,
      bindingRevision: originalBinding.bindingRevision,
      windowId: data.windowId,
      epoch: data.epoch,
      targetTag: 17,
      dispatchId: 1,
      admitted: true,
      isComposing: false,
      key: data.key,
      nativeCode: data.nativeCode,
      characters: data.characters,
      repeat: data.repeat,
      shiftKey: data.shiftKey,
      altKey: data.altKey,
      ctrlKey: data.ctrlKey,
      metaKey: data.metaKey,
      capsLock: data.capsLock,
      nativeModifierData: data.nativeModifierData,
      timestamp: data.timestamp,
      ...frameExtra,
    }
    return {
      target: { _nativeTag: 9 },
      currentTarget: { _nativeTag: 9 },
      nativeEvent: { ...data, originalEditorAction: JSON.stringify(frame) },
    } as unknown as NativeSyntheticEvent<NativeScopedKeyData>
  }
  const dispatch = (event: NativeSyntheticEvent<NativeScopedKeyData>) =>
    scope.dispatch(event.nativeEvent.policyId, event as TNativeKeyboardEvent, event.nativeEvent)
  return {
    scope,
    original,
    policy,
    lease,
    packet,
    dispatch,
    onAction,
    order,
    nativeBindings,
    originalLease,
    originalBinding,
    set target(value: TextInput | null) {
      target = value
    },
    set enabled(value: boolean) {
      enabled = value
    },
    set allowed(value: boolean) {
      allowed = value
    },
    set lifetimeKey(value: string) {
      lifetimeKey = value
    },
  }
}
it("uses exact opt-in authority, exposes only a semantic frame and ignores duplicate dispatches", () => {
  const x = setup(),
    event = x.packet()
  expect(x.dispatch(event)).toBe(true)
  expect(x.onAction).toHaveBeenCalledTimes(1)
  expect(x.onAction.mock.calls[0][0]).toMatchObject({ targetTag: 17, admitted: true, isComposing: false })
  expect(x.onAction.mock.calls[0][0]).not.toHaveProperty("nativeEvent")
  expect(x.onAction.mock.calls[0][0]).not.toBe(event)
  x.dispatch(event)
  expect(x.onAction).toHaveBeenCalledTimes(1)
})
it("requests per admitted repeated down, never again on up/cancel", () => {
  const x = setup()
  x.dispatch(x.packet())
  x.dispatch(x.packet({ repeat: true }, { dispatchId: 2 }))
  x.dispatch(x.packet({ phase: "up" }, { dispatchId: 3, admitted: false }))
  x.dispatch(x.packet({ phase: "up", cancelled: true }, { dispatchId: 4, admitted: false }))
  expect(x.onAction).toHaveBeenCalledTimes(2)
})
it.each([
  { isComposing: true },
  { admitted: false },
  { targetTag: 18 },
  { dispatchId: 0 },
  { windowId: "replacement" },
  { ownerId: "other" },
  { policyId: "other" },
  { policyRevision: -1 },
  { epoch: 2 },
  { key: "ArrowDown" },
  { nativeCode: 3 },
  { repeat: true },
] as Partial<TNativeOriginalEditorActionFrame>[])("rejects false or stale action authority %p", (frame) => {
  const x = setup()
  x.dispatch(x.packet({}, frame))
  expect(x.onAction).not.toHaveBeenCalled()
})
it.each([
  { phase: "up" },
  { cancelled: true },
  { nativeDefaultHandled: false },
  { shiftKey: true },
  { altKey: true },
  { ctrlKey: true },
  { metaKey: true },
  { focusedTarget: 18 },
] as Partial<NativeScopedKeyData>[])("does not action a non-owned original/default frame %p", (data) => {
  const x = setup()
  x.dispatch(x.packet(data))
  expect(x.onAction).not.toHaveBeenCalled()
})
it("retires old policy revisions and original refs before any next request", () => {
  const x = setup(),
    old = x.packet()
  x.lease.update({ ...x.policy, lifetimeKey: "config:2" })
  ready(x.scope)
  expect(x.dispatch(old)).toBe(false)
  expect(x.onAction).not.toHaveBeenCalled()
  x.target = { _nativeTag: 17 } as unknown as TextInput
  x.dispatch(x.packet())
  expect(x.onAction).not.toHaveBeenCalled()
  x.target = x.original
  x.dispatch(x.packet())
  expect(x.onAction).toHaveBeenCalledTimes(1)
})
it("does not infer numeric authority from handled alone or a missing private packet", () => {
  const x = setup(),
    event = x.packet()
  delete (event.nativeEvent as { originalEditorAction?: string }).originalEditorAction
  x.dispatch(event)
  expect(x.onAction).not.toHaveBeenCalled()
})
it("keeps legacy snapshot shape unchanged and opt-in capture separately disableable", () => {
  const x = setup()
  expect(x.scope.policies()[0]).toMatchObject({ originalEditorAction: true, targetTag: 17 })
  x.lease.update({ ...x.policy, isEnabled: false })
  ready(x.scope)
  expect(x.scope.policies()).toEqual([])
  const legacy = x.scope.register("legacy", { ...x.policy, originalEditorAction: undefined })
  ready(x.scope)
  expect(x.scope.policies()[0]).not.toHaveProperty("originalEditorAction")
  legacy.unregister()
})
it("delivers the genuine original ordinary event after an independent numeric request", () => {
  const x = setup(),
    session = { windowId: "window", epoch: 1, active: true }
  const registry = createNativeOrdinaryEditorKeys("scope", () => session),
    observed = jest.fn((event: TNativeOrdinaryEditorKeyEvent) => {
      x.order.push("public-key")
      event.preventDefault()
    })
  const ordinary = registry.register("editor", {
    original: x.original,
    current: () => x.original,
    canAct: () => true,
    receive: observed,
  })
  const binding = registry.bindings()[0]!
  registry.acceptStatus({
    ...binding,
    target: 17,
    ownerId: "scope",
    windowId: "window",
    epoch: 1,
    sequence: 1,
    ready: true,
    windowActive: true,
    error: "",
  })
  const internal = x.packet()
  x.dispatch(internal)
  const event = {
    target: x.original,
    currentTarget: x.original,
    persist: jest.fn(),
    preventDefault: jest.fn(),
    nativeEvent: {
      ...internal.nativeEvent,
      ...binding,
      target: 17,
      eventId: 1,
      code: "ArrowUp",
      location: 0,
      isComposing: false,
      observerBindings: "[]",
    },
  } as unknown as TNativeOrdinaryEditorKeyEvent
  expect(ordinary.receive(event)).toBe(true)
  expect(x.order).toEqual(["numeric", "public-key"])
  expect(observed.mock.calls[0][0]).toBe(event)
  expect(observed.mock.calls[0][0].nativeEvent).toBe(event.nativeEvent)
  expect(event.target).toBe(x.original)
  expect(event.currentTarget).toBe(x.original)
  expect(event.preventDefault).toHaveBeenCalledTimes(1)
  expect(x.onAction).toHaveBeenCalledTimes(1)
})
it("keeps ancestor original observation independent of native action ownership", () => {
  const root = { _nativeTag: 99 } as unknown as View,
    editor = { _nativeTag: 17 } as unknown as TextInput,
    received = jest.fn()
  const registry = createNativeOrdinaryEditorKeys("parent", () => ({ windowId: "window", epoch: 9, active: true }))
  const lease = registry.register("root", {
    original: root,
    current: () => root,
    currentTarget: () => root,
    subtree: true,
    canAct: () => true,
    receive: received,
  })
  const binding = registry.bindings()[0]!
  registry.acceptStatus({
    ...binding,
    target: 99,
    ownerId: "parent",
    windowId: "window",
    epoch: 9,
    sequence: 1,
    ready: true,
    windowActive: true,
    error: "",
  })
  const frame = {
    ownerId: "scope",
    policyId: "scope:2",
    policyRevision: 3,
    windowId: "window",
    epoch: 1,
    targetTag: 17,
    dispatchId: 1,
    admitted: false,
  }
  const event = {
    target: editor,
    currentTarget: root,
    persist: jest.fn(),
    nativeEvent: {
      kind: "keyboard",
      ownerId: "scope",
      windowId: "window",
      epoch: 1,
      eventId: 1,
      target: 17,
      phase: "down",
      cancelled: false,
      observerBindings: JSON.stringify([{ ...binding, ownerId: "parent", windowId: "window", epoch: 9 }]),
      originalEditorAction: JSON.stringify(frame),
    },
  } as unknown as TNativeOrdinaryEditorKeyEvent<TextInput, View>
  expect(lease.receive(event)).toBe(true)
  expect(received.mock.calls[0][0]).toBe(event)
  expect(lease.receive(event)).toBe(false)
})
it("rejects hidden/disabled/inactive/current-owner loss without creating a numeric completion", () => {
  const x = setup()
  x.enabled = false
  x.dispatch(x.packet())
  expect(x.onAction).not.toHaveBeenCalled()
  x.enabled = true
  x.allowed = false
  x.dispatch(x.packet())
  expect(x.onAction).not.toHaveBeenCalled()
  x.allowed = true
  x.scope.acceptNativeStatus({
    ownerId: x.scope.ownerId,
    windowId: "window",
    epoch: 2,
    policyRevision: x.scope.policyRevision(),
    ready: false,
    windowActive: false,
  })
  x.dispatch(x.packet())
  expect(x.onAction).not.toHaveBeenCalled()
})

it("retires a hidden/disconnected original binding even when its native object/tag and policy are retained", () => {
  const x = setup(),
    old = x.packet()
  x.dispatch(old)
  expect(x.onAction).toHaveBeenCalledTimes(1)
  x.originalLease.unregister()
  x.dispatch(x.packet({}, { dispatchId: 2 }))
  expect(x.onAction).toHaveBeenCalledTimes(1)
  x.nativeBindings.register("original", {
    original: x.original,
    current: () => x.original,
    canAct: () => true,
    receive: () => {},
  })
  const binding = x.nativeBindings.bindings()[0]!
  expect(binding.bindingRevision).not.toBe(x.originalBinding.bindingRevision)
  x.nativeBindings.acceptStatus({
    ...binding,
    target: 17,
    ownerId: x.scope.ownerId,
    ...x.scope.acknowledgedSession(),
    sequence: 1,
    ready: true,
    windowActive: true,
    error: "",
  })
  x.dispatch(x.packet({}, { dispatchId: 3 }))
  expect(x.onAction).toHaveBeenCalledTimes(1)
  x.dispatch(x.packet({}, { dispatchId: 1, bindingId: binding.bindingId, bindingRevision: binding.bindingRevision }))
  expect(x.onAction).toHaveBeenCalledTimes(2)
  x.dispatch(x.packet({}, { dispatchId: 1, bindingId: binding.bindingId, bindingRevision: binding.bindingRevision }))
  expect(x.onAction).toHaveBeenCalledTimes(2)
})
