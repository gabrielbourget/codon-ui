import { createContext, useContext, useId, useInsertionEffect, useLayoutEffect, useRef } from "react"
import { findNodeHandle, type NativeSyntheticEvent, type TextInput } from "react-native"

import type { NativeOrdinaryEditorKeyData } from "./specs/CUIFocusViewNativeComponent"
import type { NativeEditorKeyboardStatus } from "./specs/CUIKeyboardScopeNativeComponent"

type TSession = { windowId?: string; epoch?: number; active: boolean }
type TOptions = {
  original: TextInput
  current: () => TextInput | null
  canAct: () => boolean
  receive: (event: TNativeOrdinaryEditorKeyEvent) => void
}
export type TNativeOrdinaryEditorKeyEvent = NativeSyntheticEvent<
  Omit<NativeOrdinaryEditorKeyData, "kind"> & { kind: "keyboard" }
> & { target: TextInput; currentTarget: TextInput }

export const createNativeOrdinaryEditorKeys = (ownerId: string, session: () => TSession) => {
  type TEntry = {
    bindingId: string
    bindingRevision: string
    targetTag: number
    options: TOptions
    ready: boolean
    sequence: number
    eventId: number
    windowId: string
    epoch: number
  }
  const entries = new Map<string, TEntry>()
  const listeners = new Set<() => void>()
  let revision = 0
  let version = 0
  let disposed = false
  const changed = () => {
    if (disposed) return
    version++
    for (const listener of [...listeners]) listener()
  }
  return {
    snapshot: () => version,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    bindings: () =>
      [...entries.values()].map(({ bindingId, bindingRevision, targetTag }) => ({
        bindingId,
        bindingRevision,
        targetTag,
      })),
    register: (key: string, options: TOptions) => {
      if (disposed || entries.has(key)) throw new Error("Ordinary editor binding is unavailable or duplicated")
      const targetTag = findNodeHandle(options.original)
      if (!targetTag || targetTag <= 0) throw new Error("Ordinary editor keys require the original TextInput target")
      const entry: TEntry = {
        bindingId: `${ownerId}:ordinary:${key}`,
        bindingRevision: String(++revision),
        targetTag,
        options,
        ready: false,
        sequence: 0,
        eventId: 0,
        windowId: "",
        epoch: 0,
      }
      entries.set(key, entry)
      changed()
      return {
        receive: (event: NativeSyntheticEvent<NativeOrdinaryEditorKeyData>) => {
          const data = event.nativeEvent
          const current = session()
          if (
            disposed ||
            entries.get(key) !== entry ||
            !entry.ready ||
            !current.active ||
            options.current() !== options.original ||
            !options.canAct() ||
            event.target !== options.original ||
            event.currentTarget !== options.original ||
            data.kind !== "keyboard" ||
            data.ownerId !== ownerId ||
            data.bindingId !== entry.bindingId ||
            data.bindingRevision !== entry.bindingRevision ||
            data.target !== targetTag ||
            data.windowId !== entry.windowId ||
            data.windowId !== current.windowId ||
            data.epoch !== entry.epoch ||
            data.epoch !== current.epoch ||
            (data.phase !== "down" && data.phase !== "up") ||
            (data.phase === "down" && data.cancelled) ||
            !Number.isSafeInteger(data.eventId) ||
            data.eventId <= entry.eventId
          )
            return false
          entry.eventId = data.eventId
          event.persist?.()
          // The native event already proceeds independently; there is no default acknowledgment.
          options.receive(event as TNativeOrdinaryEditorKeyEvent)
          return true
        },
        unregister: () => {
          if (entries.get(key) !== entry) return
          entries.delete(key)
          changed()
        },
      }
    },
    acceptStatus: (status: NativeEditorKeyboardStatus) => {
      if (disposed || status.ownerId !== ownerId) return
      const entry = [...entries.values()].find((entry) => entry.bindingId === status.bindingId)
      if (
        !entry ||
        status.bindingRevision !== entry.bindingRevision ||
        status.target !== entry.targetTag ||
        !Number.isSafeInteger(status.sequence) ||
        status.sequence <= entry.sequence
      )
        return
      entry.sequence = status.sequence
      entry.windowId = status.windowId
      entry.epoch = status.epoch
      entry.ready = status.ready && status.windowActive
    },
    dispose: () => {
      disposed = true
      entries.clear()
      listeners.clear()
    },
  }
}

export const NativeOrdinaryEditorKeysContext = createContext<ReturnType<typeof createNativeOrdinaryEditorKeys> | null>(
  null,
)

export const useNativeOrdinaryEditorKeys = (
  target: TextInput | null,
  enabled: boolean,
  revisionKey: string,
  options: Omit<TOptions, "original">,
) => {
  const registry = useContext(NativeOrdinaryEditorKeysContext)
  const key = useId()
  const current = useRef(options)
  useInsertionEffect(() => {
    current.current = options
  })
  const lease = useRef<ReturnType<NonNullable<typeof registry>["register"]> | null>(null)
  useLayoutEffect(() => {
    if (!enabled || !target) return
    if (!registry) throw new Error("Ordinary editor keys require a same-window NativeFloatingLayerHost")
    const registration = registry.register(key, {
      original: target,
      current: () => current.current.current(),
      canAct: () => current.current.canAct(),
      receive: (event) => current.current.receive(event),
    })
    lease.current = registration
    return () => {
      if (lease.current === registration) lease.current = null
      registration.unregister()
    }
  }, [registry, key, target, enabled, revisionKey])
  return (event: NativeSyntheticEvent<NativeOrdinaryEditorKeyData>) => lease.current?.receive(event)
}
