import { useContext, useInsertionEffect, useMemo, useRef } from "react"
import { findNodeHandle, type NativeSyntheticEvent, type TextInput } from "react-native"

import { nativeKeyToken } from "./keyScope"
import { useNativeKeyPolicy, useNativeKeyScope } from "./NativeKeyboardScope"
import {
  NativeOrdinaryEditorKeysContext,
  useNativeOrdinaryEditorKeys,
  type TNativeOrdinaryEditorKeyEvent,
} from "./ordinaryEditorKeys"
import type { NativeScopedKeyData } from "./specs/CUIKeyboardScopeNativeComponent"

export type TNativeOriginalEditorActionFrame = Readonly<{
  ownerId: string
  policyId: string
  policyRevision: number
  bindingId: string
  bindingRevision: string
  windowId: string
  epoch: number
  targetTag: number
  dispatchId: number
  admitted: boolean
  isComposing: boolean
  key: string
  nativeCode: number
  characters: string
  repeat: boolean
  shiftKey: boolean
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  capsLock: boolean
  nativeModifierData: string
  timestamp: number
}>
let originalEditorBindings = 0
type TOptions<T extends TextInput> = {
  enabled: boolean
  actionEnabled?: boolean
  lifetimeKey: string
  tokens: readonly string[]
  current: () => T | null
  canAct: () => boolean
  onAction: (frame: TNativeOriginalEditorActionFrame) => void
  receive: (event: TNativeOrdinaryEditorKeyEvent<T>) => void
}

// The internal action packet is independent of public propagation; never expose its ScopeHost event.
export const createNativeOriginalEditorActionReceiver = (options: {
  current: () => {
    original: TextInput | null
    target: TextInput | null
    enabled: boolean
    tokens: readonly string[]
    lifetimeKey: string
    canAct: () => boolean
  }
  session: () => { ownerId: string; windowId: string; epoch: number; policyRevision: number; ready: boolean }
  onAction: (frame: TNativeOriginalEditorActionFrame) => void
  binding: (original: TextInput, frame: TNativeOriginalEditorActionFrame) => boolean
}) => {
  let lifetime = "",
    namespace = "",
    lastDispatchId = 0
  return (event: NativeSyntheticEvent<NativeScopedKeyData>) => {
    const current = options.current(),
      session = options.session(),
      data = event.nativeEvent
    if (lifetime !== current.lifetimeKey) {
      lifetime = current.lifetimeKey
      namespace = ""
      lastDispatchId = 0
    }
    if (
      !current.enabled ||
      !current.original ||
      current.target !== current.original ||
      !current.canAct() ||
      !session.ready ||
      data.ownerId !== session.ownerId ||
      data.windowId !== session.windowId ||
      data.epoch !== session.epoch ||
      data.policyRevision !== session.policyRevision ||
      data.kind !== "keyboard" ||
      data.phase !== "down" ||
      data.cancelled ||
      !data.nativeDefaultHandled ||
      typeof data.originalEditorAction !== "string"
    )
      return false
    let frame: TNativeOriginalEditorActionFrame
    try {
      frame = JSON.parse(data.originalEditorAction)
    } catch {
      return false
    }
    if (
      !frame ||
      frame.admitted !== true ||
      !options.binding(current.original, frame) ||
      frame.isComposing !== false ||
      frame.ownerId !== data.ownerId ||
      frame.policyId !== data.policyId ||
      frame.policyRevision !== data.policyRevision ||
      frame.windowId !== data.windowId ||
      frame.epoch !== data.epoch ||
      frame.targetTag !== findNodeHandle(current.original) ||
      data.focusedTarget !== frame.targetTag ||
      !Number.isSafeInteger(frame.dispatchId) ||
      frame.dispatchId <= 0 ||
      (namespace ===
        JSON.stringify([
          frame.ownerId,
          frame.windowId,
          frame.epoch,
          frame.policyId,
          frame.policyRevision,
          frame.bindingId,
          frame.bindingRevision,
        ]) &&
        frame.dispatchId <= lastDispatchId) ||
      !current.tokens.includes(nativeKeyToken(data)) ||
      frame.key !== data.key ||
      frame.nativeCode !== data.nativeCode ||
      frame.characters !== data.characters ||
      frame.repeat !== data.repeat ||
      frame.shiftKey !== data.shiftKey ||
      frame.altKey !== data.altKey ||
      frame.ctrlKey !== data.ctrlKey ||
      frame.metaKey !== data.metaKey ||
      frame.capsLock !== data.capsLock ||
      frame.nativeModifierData !== data.nativeModifierData ||
      frame.timestamp !== data.timestamp
    )
      return false
    namespace = JSON.stringify([
      frame.ownerId,
      frame.windowId,
      frame.epoch,
      frame.policyId,
      frame.policyRevision,
      frame.bindingId,
      frame.bindingRevision,
    ])
    lastDispatchId = frame.dispatchId
    options.onAction(frame)
    return true
  }
}

export const useNativeOriginalEditorKeyPolicy = <T extends TextInput>(original: T | null, options: TOptions<T>) => {
  const scope = useNativeKeyScope()
  const registry = useContext(NativeOrdinaryEditorKeysContext)
  const lifetimeKey = useMemo(
    () => `${options.lifetimeKey}:${++originalEditorBindings}`,
    [original, scope, options.lifetimeKey, options.enabled, options.actionEnabled, JSON.stringify(options.tokens)],
  )
  const current = useRef({ original, options, scope, registry, lifetimeKey })
  useInsertionEffect(() => {
    current.current = { original, options, scope, registry, lifetimeKey }
  })
  const receiver = useRef<ReturnType<typeof createNativeOriginalEditorActionReceiver> | null>(null)
  if (!receiver.current)
    receiver.current = createNativeOriginalEditorActionReceiver({
      current: () => ({
        original: current.current.original,
        target: current.current.options.current(),
        enabled: current.current.options.enabled && current.current.options.actionEnabled !== false,
        tokens: current.current.options.tokens,
        lifetimeKey: current.current.lifetimeKey,
        canAct: current.current.options.canAct,
      }),
      session: () => ({
        ownerId: current.current.scope?.ownerId ?? "",
        windowId: current.current.scope?.acknowledgedSession().windowId ?? "",
        epoch: current.current.scope?.acknowledgedSession().epoch ?? 0,
        policyRevision: current.current.scope?.policyRevision() ?? -1,
        ready: current.current.scope?.isNativeReady() === true,
      }),
      onAction: (frame) => current.current.options.onAction(frame),
      binding: (target, frame) => current.current.registry?.isCurrentActionBinding(target, frame) === true,
    })
  const canAct = () =>
    current.current.original === current.current.options.current() &&
    current.current.options.enabled &&
    current.current.options.canAct()
  useNativeKeyPolicy({
    tokens: options.tokens,
    excludeEditable: false,
    excludeComposing: true,
    originalEditorAction: true,
    targetTag: original ? (findNodeHandle(original) ?? 0) : 0,
    isEnabled: !!original && options.enabled && options.actionEnabled !== false,
    lifetimeKey,
    canAct,
    onKey: (event) => receiver.current?.(event as NativeSyntheticEvent<NativeScopedKeyData>),
  })
  return useNativeOrdinaryEditorKeys(original, options.enabled, lifetimeKey, {
    originalEditorAction: true,
    current: () => current.current.options.current(),
    canAct,
    receive: (event) => current.current.options.receive(event),
  })
}
