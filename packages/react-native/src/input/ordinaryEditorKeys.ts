import { createContext, useContext, useId, useInsertionEffect, useLayoutEffect, useRef } from "react"
import { findNodeHandle, type NativeSyntheticEvent, type TextInput, type View } from "react-native"

import type { NativeDateSegmentKeyData } from "./specs/CUIDateSegmentNativeComponent"
import type { NativeOrdinaryEditorKeyData } from "./specs/CUIFocusViewNativeComponent"
import type { NativeEditorKeyboardStatus } from "./specs/CUIKeyboardScopeNativeComponent"

type TSession = { windowId?: string; epoch?: number; active: boolean }
type TOptions<TTarget extends View, TReceiver extends View = TTarget> = {
  focusOnly?: false
  original: TTarget
  current: () => TTarget | null
  canAct: () => boolean
  subtree?: boolean
  toolbar?: boolean
  originalEditorAction?: boolean
  currentTarget?: () => TReceiver | null
  receive: (event: TNativeOrdinaryEditorKeyEvent<TTarget, TReceiver>) => void
  receiveDate?: (event: TNativeToolbarDateKeyEvent) => void
}
type TFocusOptions<TTarget extends View> = {
  original: TTarget
  current: () => TTarget | null
  canAct: () => boolean
  focusOnly: true
  subtree?: never
  toolbar?: never
  originalEditorAction?: never
  currentTarget?: never
  receive?: never
  receiveDate?: never
}

export type TNativeOrdinaryEditorKeyEvent<
  TTarget extends View = TextInput,
  TReceiver extends View = TTarget,
> = NativeSyntheticEvent<Omit<NativeOrdinaryEditorKeyData, "kind"> & { kind: "keyboard" }> & {
  target: TTarget
  currentTarget: TReceiver
}

export type TNativeToolbarDateKeyEvent = NativeSyntheticEvent<
  Omit<NativeDateSegmentKeyData, "kind"> & { kind: "keyboard" }
> & { target: View; currentTarget: View }

type TOriginalFocusCapture = (original: TextInput, expected: { windowId: string }) => (() => boolean) | null
const originalFocusCaptures = new WeakMap<object, TOriginalFocusCapture>()
export const captureNativeOrdinaryEditorFocus = (
  registry: object | null,
  original: TextInput,
  expected: { windowId: string },
) => (registry ? (originalFocusCaptures.get(registry)?.(original, expected) ?? null) : null)

export const createNativeOrdinaryEditorKeys = (ownerId: string, session: () => TSession) => {
  type TEntry = {
    bindingId: string
    bindingRevision: string
    targetTag: number
    original: View | TextInput
    keys: Set<string>
    observers: Set<string>
    toolbarKeys: Set<string>
    toolbarObservers: Set<string>
    actionKeys: Set<string>
    eligibility: Map<string, () => boolean>
    ready: boolean
    sequence: number
    windowId: string
    epoch: number
  }
  const entries = new Map<string, TEntry>()
  const dateReceivers = new Map<string, (event: NativeSyntheticEvent<NativeDateSegmentKeyData>) => boolean>()
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
  const purpose = (entry: TEntry) => ({
    toolbarTargetOnly: entry.keys.size > 0 && entry.toolbarKeys.size === entry.keys.size,
    toolbarSubtreeOnly: entry.observers.size > 0 && entry.toolbarObservers.size === entry.observers.size,
    ...(entry.actionKeys.size ? { originalEditorAction: true } : {}),
  })
  const captureOriginalFocus = (original: TextInput, expected: { windowId: string }): (() => boolean) | null => {
    const entry = targets.get(original)
    if (!entry) return null
    const revision = entry.bindingRevision
    const epoch = entry.epoch
    const admitted = () => {
      const current = session()
      return (
        !disposed &&
        targets.get(original) === entry &&
        [...entry.eligibility.values()].some((eligible) => eligible()) &&
        entry.ready &&
        entry.bindingRevision === revision &&
        current.active &&
        expected.windowId === entry.windowId &&
        expected.windowId === current.windowId &&
        entry.epoch === epoch &&
        entry.epoch === current.epoch
      )
    }
    return admitted() ? admitted : null
  }
  const registry = {
    snapshot: () => version,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    bindings: () =>
      [...targets.values()].map((entry) => ({
        bindingId: entry.bindingId,
        bindingRevision: entry.bindingRevision,
        targetTag: entry.targetTag,
        subtree: entry.observers.size > 0,
        ...purpose(entry),
      })),
    isCurrentActionBinding: (
      original: View,
      frame: {
        ownerId: string
        bindingId: string
        bindingRevision: string
        targetTag: number
        windowId: string
        epoch: number
      },
    ) => {
      const entry = targets.get(original),
        current = session()
      return (
        !disposed &&
        !!entry &&
        entry.ready &&
        current.active &&
        entry.original === original &&
        frame.ownerId === ownerId &&
        frame.bindingId === entry.bindingId &&
        frame.bindingRevision === entry.bindingRevision &&
        frame.targetTag === entry.targetTag &&
        frame.windowId === entry.windowId &&
        frame.windowId === current.windowId &&
        frame.epoch === entry.epoch &&
        frame.epoch === current.epoch
      )
    },
    register: <TTarget extends View, TReceiver extends View = TTarget>(
      key: string,
      options: TOptions<TTarget, TReceiver> | TFocusOptions<TTarget>,
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
        toolbarKeys: new Set(),
        toolbarObservers: new Set(),
        actionKeys: new Set(),
        eligibility: new Map(),
        ready: false,
        sequence: 0,
        windowId: "",
        epoch: 0,
      }
      const wasSubtree = entry.observers.size > 0
      const previousPurpose = JSON.stringify(purpose(entry))
      entry.keys.add(key)
      entry.eligibility.set(key, () => options.current() === options.original && options.canAct())
      if (options.toolbar) entry.toolbarKeys.add(key)
      if (options.originalEditorAction) entry.actionKeys.add(key)
      if (options.subtree) {
        entry.observers.add(key)
        if (options.toolbar) entry.toolbarObservers.add(key)
      }
      entries.set(key, entry)
      targets.set(options.original, entry)
      let eventId = 0
      const toolbarEventIds = new Map<string, number>()
      const dateSequences = new Map<string, number>()
      const dateEpochs = new Map<string, number>()
      if (!existing || wasSubtree !== entry.observers.size > 0 || previousPurpose !== JSON.stringify(purpose(entry)))
        changed()
      const receiveDate = (event: NativeSyntheticEvent<NativeDateSegmentKeyData>) => {
        const data = event.nativeEvent,
          current = session()
        if (!options.toolbar || !options.subtree || !options.receiveDate || typeof data.toolbarRoute !== "string")
          return false
        let observer: { ownerId?: string; windowId?: string; epoch?: number } | undefined
        try {
          const route = JSON.parse(data.toolbarRoute)
          if (!Array.isArray(route?.observerBindings)) return false
          observer = route.observerBindings.find(
            (binding: { bindingId?: string; bindingRevision?: string; targetTag?: number }) =>
              binding?.bindingId === entry.bindingId &&
              binding?.bindingRevision === entry.bindingRevision &&
              binding?.targetTag === entry.targetTag,
          )
        } catch {
          return false
        }
        const target = event.target as View
        const identity = JSON.stringify([
          data.ownerId,
          data.segmentId,
          data.bindingRevision,
          data.nativeInstance,
          data.windowId,
          data.epoch,
        ])
        const instance = JSON.stringify([data.target, data.nativeInstance])
        if (
          disposed ||
          entries.get(key) !== entry ||
          !entry.ready ||
          !current.active ||
          options.current() !== options.original ||
          !options.canAct() ||
          event.currentTarget !== (options.currentTarget ? options.currentTarget() : options.original) ||
          data.kind !== "keyboard" ||
          data.target !== findNodeHandle(target) ||
          data.windowId !== current.windowId ||
          entry.windowId !== current.windowId ||
          entry.epoch !== current.epoch ||
          observer?.ownerId !== ownerId ||
          observer.windowId !== entry.windowId ||
          observer.epoch !== entry.epoch ||
          !data.ownerId ||
          !data.segmentId ||
          !data.bindingRevision ||
          !data.nativeInstance ||
          !Number.isSafeInteger(data.epoch) ||
          data.epoch < 0 ||
          data.epoch < (dateEpochs.get(instance) ?? 0) ||
          !Number.isSafeInteger(data.sequence) ||
          data.sequence <= (dateSequences.get(identity) ?? 0) ||
          (data.phase !== "down" && data.phase !== "up") ||
          (data.phase === "down" && data.cancelled)
        )
          return false
        dateEpochs.set(instance, data.epoch)
        dateSequences.set(identity, data.sequence)
        event.persist?.()
        options.receiveDate(event as TNativeToolbarDateKeyEvent)
        return true
      }
      if (options.toolbar) dateReceivers.set(key, receiveDate)

      return {
        receive: (event: NativeSyntheticEvent<NativeOrdinaryEditorKeyData>) => {
          if (options.focusOnly) return false
          const data = event.nativeEvent
          const current = session()
          let observed = false
          let observerSession: { ownerId?: string; windowId?: string; epoch?: number } | undefined
          if (options.subtree) {
            try {
              const observers: unknown = JSON.parse(data.observerBindings)
              observed =
                Array.isArray(observers) &&
                observers.some((value) => {
                  const matches =
                    value?.bindingId === entry.bindingId &&
                    value?.bindingRevision === entry.bindingRevision &&
                    value?.targetTag === entry.targetTag
                  if (matches) observerSession = value
                  return matches
                })
            } catch {
              return false
            }
          }
          const scopedToolbar =
            options.toolbar &&
            typeof data.toolbarRoute === "string" &&
            observerSession?.ownerId === ownerId &&
            observerSession.windowId === entry.windowId &&
            observerSession.epoch === entry.epoch
          let scopedAction = false
          if (options.subtree && typeof data.originalEditorAction === "string") {
            try {
              const action = JSON.parse(data.originalEditorAction)
              scopedAction =
                action?.ownerId === data.ownerId &&
                action.windowId === data.windowId &&
                action.epoch === data.epoch &&
                typeof action.policyId === "string" &&
                Number.isSafeInteger(action.dispatchId) &&
                action.dispatchId > 0 &&
                observerSession?.ownerId === ownerId &&
                observerSession.windowId === entry.windowId &&
                observerSession.epoch === entry.epoch
            } catch {
              return false
            }
          }
          const scopedOriginal = scopedToolbar || scopedAction
          const toolbarIdentity = JSON.stringify([data.ownerId, data.windowId, data.epoch])
          const previousEventId = scopedOriginal ? (toolbarEventIds.get(toolbarIdentity) ?? 0) : eventId
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
            (data.ownerId !== ownerId && !scopedOriginal) ||
            (!options.subtree &&
              (data.bindingId !== entry.bindingId || data.bindingRevision !== entry.bindingRevision)) ||
            data.target !== findNodeHandle(event.target as View) ||
            data.windowId !== entry.windowId ||
            data.windowId !== current.windowId ||
            (data.epoch !== entry.epoch && !scopedOriginal) ||
            entry.epoch !== current.epoch ||
            (data.phase !== "down" && data.phase !== "up") ||
            (data.phase === "down" && data.cancelled) ||
            !Number.isSafeInteger(data.eventId) ||
            data.eventId <= previousEventId
          )
            return false
          if (scopedOriginal) toolbarEventIds.set(toolbarIdentity, data.eventId)
          else eventId = data.eventId
          event.persist?.()
          // The native event already proceeds independently; there is no default acknowledgment.
          options.receive(event as TNativeOrdinaryEditorKeyEvent<TTarget, TReceiver>)
          return true
        },
        unregister: () => {
          if (entries.get(key) !== entry) return
          entries.delete(key)
          const wasSubtree = entry.observers.size > 0
          const previousPurpose = JSON.stringify(purpose(entry))
          entry.keys.delete(key)
          entry.eligibility.delete(key)
          entry.observers.delete(key)
          entry.toolbarKeys.delete(key)
          entry.actionKeys.delete(key)
          entry.toolbarObservers.delete(key)
          if (!entry.keys.size) {
            targets.delete(options.original)
            changed()
          } else if (wasSubtree !== entry.observers.size > 0 || previousPurpose !== JSON.stringify(purpose(entry)))
            changed()
        },
      }
    },
    receiveDate: (key: string, event: NativeSyntheticEvent<NativeDateSegmentKeyData>) =>
      dateReceivers.get(key)?.(event) ?? false,
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
      dateReceivers.clear()
      targets.clear()
      listeners.clear()
    },
  }
  originalFocusCaptures.set(registry, captureOriginalFocus)
  return registry
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
      toolbar: options.toolbar,
      originalEditorAction: options.originalEditorAction,
      ...(options.currentTarget ? { currentTarget: () => current.current.currentTarget?.() ?? null } : {}),
      receive: (event) => current.current.receive(event),
      receiveDate: (event) => current.current.receiveDate?.(event),
    })
    lease.current = registration
    return () => {
      if (lease.current === registration) lease.current = null
      registration.unregister()
    }
  }, [registry, key, target, enabled, revisionKey, options.subtree, options.toolbar, options.originalEditorAction])
  return Object.assign((event: NativeSyntheticEvent<NativeOrdinaryEditorKeyData>) => lease.current?.receive(event), {
    receiveDate: (event: NativeSyntheticEvent<NativeDateSegmentKeyData>) =>
      lease.current ? registry?.receiveDate(key, event) : false,
  })
}

// Focus enrollment publishes an actual binding; it neither captures keys nor claims an ordinary-event observer.
export const useNativeOriginalEditorFocusBinding = <TTarget extends TextInput>(
  target: TTarget | null,
  enabled: boolean,
  lifetimeKey: string,
  options: Pick<TFocusOptions<TTarget>, "current" | "canAct">,
) => {
  const registry = useContext(NativeOrdinaryEditorKeysContext)
  const key = useId()
  const current = useRef(options)
  useInsertionEffect(() => {
    current.current = options
  })
  useLayoutEffect(() => {
    if (!enabled || !target) return
    if (!registry) throw new Error("Original editor focus requires a same-window NativeKeyboardScope")
    const registration = registry.register(key, {
      original: target,
      current: () => current.current.current(),
      canAct: () => current.current.canAct(),
      focusOnly: true,
    })
    return registration.unregister
  }, [registry, key, target, enabled, lifetimeKey])
}
