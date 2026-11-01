import { createContext, useContext, useId, useInsertionEffect, useLayoutEffect, useRef } from "react"
import { findNodeHandle, type NativeSyntheticEvent, type TextInput, type View } from "react-native"

import type { NativeOrdinaryEditorKeyData } from "./specs/CUIFocusViewNativeComponent"
import type { NativeEditorKeyboardStatus } from "./specs/CUIKeyboardScopeNativeComponent"

type TSession = { windowId?: string; epoch?: number; active: boolean }
type TOptions<TTarget extends View, TReceiver extends View = TTarget> = {
  original: TTarget
  current: () => TTarget | null
  canAct: () => boolean
  subtree?: boolean
  currentTarget?: () => TReceiver | null
  receive: (event: TNativeOrdinaryEditorKeyEvent<TTarget, TReceiver>) => void
}
export type TNativeOrdinaryEditorKeyEvent<
  TTarget extends View = TextInput,
  TReceiver extends View = TTarget,
> = NativeSyntheticEvent<Omit<NativeOrdinaryEditorKeyData, "kind"> & { kind: "keyboard" }> & {
  target: TTarget
  currentTarget: TReceiver
}

export const createNativeOrdinaryEditorKeys = (ownerId: string, session: () => TSession) => {
  type TEntry = {
    bindingId: string
    bindingRevision: string
    targetTag: number
    original: View | TextInput
    keys: Set<string>
    observers: Set<string>
    ready: boolean
    sequence: number
    windowId: string
    epoch: number
  }
  const entries = new Map<string, TEntry>()
  const targets = new Map<View | TextInput, TEntry>()
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
      [...targets.values()].map(({ bindingId, bindingRevision, targetTag, observers }) => ({
        bindingId,
        bindingRevision,
        targetTag,
        subtree: observers.size > 0,
      })),
    register: <TTarget extends View, TReceiver extends View = TTarget>(
      key: string,
      options: TOptions<TTarget, TReceiver>,
    ) => {
      if (disposed || entries.has(key)) throw new Error("Ordinary editor binding is unavailable or duplicated")
      const targetTag = findNodeHandle(options.original)
      if (!targetTag || targetTag <= 0) throw new Error("Ordinary editor keys require the original native focus target")
      if ([...targets.values()].some((entry) => entry.targetTag === targetTag && entry.original !== options.original))
        throw new Error("Ordinary editor target tag belongs to a different original native control")
      const existing = targets.get(options.original)
      const entry: TEntry = existing ?? {
        bindingId: `${ownerId}:ordinary:${key}`,
        bindingRevision: String(++revision),
        targetTag,
        original: options.original,
        keys: new Set(),
        observers: new Set(),
        ready: false,
        sequence: 0,
        windowId: "",
        epoch: 0,
      }
      const wasSubtree = entry.observers.size > 0
      entry.keys.add(key)
      if (options.subtree) entry.observers.add(key)
      entries.set(key, entry)
      targets.set(options.original, entry)
      let eventId = 0
      if (!existing || wasSubtree !== entry.observers.size > 0) changed()
      return {
        receive: (event: NativeSyntheticEvent<NativeOrdinaryEditorKeyData>) => {
          const data = event.nativeEvent
          const current = session()
          let observed = false
          if (options.subtree) {
            try {
              const observers: unknown = JSON.parse(data.observerBindings)
              observed =
                Array.isArray(observers) &&
                observers.some(
                  (value) =>
                    value?.bindingId === entry.bindingId &&
                    value?.bindingRevision === entry.bindingRevision &&
                    value?.targetTag === entry.targetTag,
                )
            } catch {
              return false
            }
          }
          if (
            disposed ||
            entries.get(key) !== entry ||
            !entry.ready ||
            !current.active ||
            options.current() !== options.original ||
            !options.canAct() ||
            (options.subtree ? !observed : event.target !== options.original) ||
            event.currentTarget !== (options.currentTarget ? options.currentTarget() : options.original) ||
            data.kind !== "keyboard" ||
            data.ownerId !== ownerId ||
            (!options.subtree &&
              (data.bindingId !== entry.bindingId || data.bindingRevision !== entry.bindingRevision)) ||
            data.target !== findNodeHandle(event.target as View) ||
            data.windowId !== entry.windowId ||
            data.windowId !== current.windowId ||
            data.epoch !== entry.epoch ||
            data.epoch !== current.epoch ||
            (data.phase !== "down" && data.phase !== "up") ||
            (data.phase === "down" && data.cancelled) ||
            !Number.isSafeInteger(data.eventId) ||
            data.eventId <= eventId
          )
            return false
          eventId = data.eventId
          event.persist?.()
          // The native event already proceeds independently; there is no default acknowledgment.
          options.receive(event as TNativeOrdinaryEditorKeyEvent<TTarget, TReceiver>)
          return true
        },
        unregister: () => {
          if (entries.get(key) !== entry) return
          entries.delete(key)
          const wasSubtree = entry.observers.size > 0
          entry.keys.delete(key)
          entry.observers.delete(key)
          if (!entry.keys.size) {
            targets.delete(options.original)
            changed()
          } else if (wasSubtree !== entry.observers.size > 0) changed()
        },
      }
    },
    acceptStatus: (status: NativeEditorKeyboardStatus) => {
      if (disposed || status.ownerId !== ownerId) return
      const entry = [...targets.values()].find((entry) => entry.bindingId === status.bindingId)
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
      if (entry.observers.size > 0) changed()
    },
    dispose: () => {
      disposed = true
      entries.clear()
      targets.clear()
      listeners.clear()
    },
  }
}

export const NativeOrdinaryFocusParticipantsContext = createContext<((target: object) => boolean) | null>(null)
export const NativeOrdinaryFieldGroupKeysContext = createContext(false)

export const NativeOrdinaryEditorKeysContext = createContext<ReturnType<typeof createNativeOrdinaryEditorKeys> | null>(
  null,
)

export const useNativeOrdinaryEditorKeys = <TTarget extends View, TReceiver extends View = TTarget>(
  target: TTarget | null,
  enabled: boolean,
  revisionKey: string,
  options: Omit<TOptions<TTarget, TReceiver>, "original">,
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
    const registration = registry.register<TTarget, TReceiver>(key, {
      original: target,
      current: () => current.current.current(),
      canAct: () => current.current.canAct(),
      subtree: options.subtree,
      ...(options.currentTarget ? { currentTarget: () => current.current.currentTarget?.() ?? null } : {}),
      receive: (event) => current.current.receive(event),
    })
    lease.current = registration
    return () => {
      if (lease.current === registration) lease.current = null
      registration.unregister()
    }
  }, [registry, key, target, enabled, revisionKey, options.subtree])
  return (event: NativeSyntheticEvent<NativeOrdinaryEditorKeyData>) => lease.current?.receive(event)
}
