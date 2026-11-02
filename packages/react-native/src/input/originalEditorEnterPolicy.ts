import { useContext, useInsertionEffect, useLayoutEffect, useRef } from "react"
import { findNodeHandle, type TextInput } from "react-native"

import { nativeKeyTokens } from "./keyScope"
import { useNativeKeyScope } from "./NativeKeyboardScope"
import { NativeOrdinaryEditorKeysContext, type TNativeOrdinaryEditorKeyEvent } from "./ordinaryEditorKeys"
import { useNativeOriginalEditorKeyPolicy, type TNativeOriginalEditorActionFrame } from "./originalEditorKeyPolicy"

const enterTokens = nativeKeyTokens("Enter")
const actionNamespace = (frame: TNativeOriginalEditorActionFrame) =>
  JSON.stringify([
    frame.ownerId,
    frame.windowId,
    frame.epoch,
    frame.policyId,
    frame.policyRevision,
    frame.bindingId,
    frame.bindingRevision,
  ])
const originalFields = [
  "ownerId",
  "bindingId",
  "bindingRevision",
  "windowId",
  "epoch",
  "key",
  "nativeCode",
  "characters",
  "repeat",
  "shiftKey",
  "altKey",
  "ctrlKey",
  "metaKey",
  "capsLock",
  "nativeModifierData",
  "timestamp",
] as const

type TEnterCurrent<T extends TextInput> = {
  original: T | null
  enabled: boolean
  lifetimeKey: string
  canAct: () => boolean
}

// Pair real action metadata with its original key receipt, never with an unrelated stock submit event.
export const createNativeOriginalEditorEnterAdapter = <T extends TextInput>(options: {
  current: () => TEnterCurrent<T>
  isCurrent: (original: T, frame: TNativeOriginalEditorActionFrame) => boolean
  onSubmit: () => void
}) => {
  let owner: T | null = null,
    lifetime = "",
    namespace = "",
    lastDispatch = 0
  const pending = new Map<string, { original: T; frame: TNativeOriginalEditorActionFrame }>()
  const current = () => {
    const value = options.current()
    if (owner !== value.original || lifetime !== value.lifetimeKey) {
      pending.clear()
      owner = value.original
      lifetime = value.lifetimeKey
    }
    if (!value.enabled || !value.original || !value.canAct()) pending.clear()
    return value
  }
  return {
    onAction: (frame: TNativeOriginalEditorActionFrame) => {
      const value = current()
      if (
        !value.enabled ||
        !value.original ||
        !value.canAct() ||
        !options.isCurrent(value.original, frame) ||
        frame.admitted !== true ||
        frame.isComposing !== false ||
        frame.key !== "Enter" ||
        frame.targetTag !== findNodeHandle(value.original) ||
        !Number.isSafeInteger(frame.dispatchId) ||
        frame.dispatchId <= 0
      )
        return false
      const identity = actionNamespace(frame)
      if (identity === namespace && frame.dispatchId <= lastDispatch) return false
      if (identity !== namespace) pending.clear()
      namespace = identity
      lastDispatch = frame.dispatchId
      pending.set(`${identity}:${frame.dispatchId}`, { original: value.original, frame: Object.freeze({ ...frame }) })
      return true
    },
    receive: (event: TNativeOrdinaryEditorKeyEvent<T>) => {
      const value = current(),
        data = event.nativeEvent
      if (
        !value.enabled ||
        !value.original ||
        !value.canAct() ||
        event.target !== value.original ||
        event.currentTarget !== value.original ||
        data.kind !== "keyboard"
      )
        return false
      if (data.phase === "up") {
        for (const [key, entry] of pending)
          if (
            entry.original === value.original &&
            data.ownerId === entry.frame.ownerId &&
            data.windowId === entry.frame.windowId &&
            data.epoch === entry.frame.epoch &&
            data.bindingId === entry.frame.bindingId &&
            data.bindingRevision === entry.frame.bindingRevision &&
            data.nativeCode === entry.frame.nativeCode &&
            data.timestamp >= entry.frame.timestamp
          )
            pending.delete(key)
        return false
      }
      if (
        data.phase !== "down" ||
        data.cancelled ||
        data.isComposing !== false ||
        data.nativeDefaultHandled !== true ||
        typeof data.originalEditorAction !== "string"
      )
        return false
      let frame: TNativeOriginalEditorActionFrame
      try {
        frame = JSON.parse(data.originalEditorAction)
      } catch {
        return false
      }
      if (!frame || typeof frame !== "object") return false
      const key = `${actionNamespace(frame)}:${frame.dispatchId}`,
        entry = pending.get(key)
      if (
        !entry ||
        entry.original !== value.original ||
        data.target !== entry.frame.targetTag ||
        !options.isCurrent(value.original, entry.frame) ||
        !Object.entries(entry.frame).every(([field, expected]) => frame[field as keyof typeof frame] === expected) ||
        !originalFields.every((field) => data[field] === entry.frame[field])
      )
        return false
      pending.delete(key)
      options.onSubmit()
      return true
    },
    retire: () => pending.clear(),
  }
}

export const useNativeOriginalEditorEnterPolicy = <T extends TextInput>(
  original: T | null,
  options: {
    enabled: boolean
    lifetimeKey: string
    current: () => T | null
    canAct: () => boolean
    onSubmit: () => void
  },
) => {
  const scope = useNativeKeyScope()
  const registry = useContext(NativeOrdinaryEditorKeysContext)
  const committed = useRef({ original, options, scope, registry })
  const live = useRef(false)
  useInsertionEffect(() => {
    committed.current = { original, options, scope, registry }
  })
  const adapter = useRef<ReturnType<typeof createNativeOriginalEditorEnterAdapter<T>> | null>(null)
  if (!adapter.current)
    adapter.current = createNativeOriginalEditorEnterAdapter<T>({
      current: () => ({
        original:
          committed.current.original === committed.current.options.current() ? committed.current.original : null,
        enabled: live.current && committed.current.options.enabled,
        lifetimeKey: committed.current.options.lifetimeKey,
        canAct: committed.current.options.canAct,
      }),
      isCurrent: (target, frame) => {
        const { scope, registry } = committed.current,
          session = scope?.acknowledgedSession()
        return (
          scope?.isNativeReady() === true &&
          scope.isWindowActive() === true &&
          frame.ownerId === scope.ownerId &&
          frame.windowId === session?.windowId &&
          frame.epoch === session.epoch &&
          frame.policyRevision === scope.policyRevision() &&
          registry?.isCurrentActionBinding(target, frame) === true
        )
      },
      onSubmit: () => committed.current.options.onSubmit(),
    })
  useInsertionEffect(() => {
    live.current = true
    return () => {
      live.current = false
      adapter.current?.retire()
    }
  }, [])
  useLayoutEffect(
    () => () => adapter.current?.retire(),
    [original, scope, registry, options.enabled, options.lifetimeKey],
  )
  return useNativeOriginalEditorKeyPolicy(original, {
    ...options,
    tokens: enterTokens,
    onAction: (frame) => adapter.current?.onAction(frame),
    receive: (event) => adapter.current?.receive(event),
  })
}
