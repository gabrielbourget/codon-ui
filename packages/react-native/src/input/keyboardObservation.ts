import type { NativeSyntheticEvent } from "react-native"

export type TNativeObservedKeyData = Readonly<{
  ownerId: string
  windowId: string
  epoch: number
  observationRevision: number
  eventId: number
  observerIds: readonly string[]
  target: number
  focusedTarget: number
  key: string
  code: string
  nativeCode: number
  legacyKeyCode: number
  location: number
  repeat: boolean
  cancelled: boolean
  isComposing: boolean
  shiftKey: boolean
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  capsLock: boolean
  nativeModifierData: string
  defaultCaptured: boolean
  timestamp: number
}>
export type TNativeObservedKeyboardEvent = NativeSyntheticEvent<TNativeObservedKeyData>
export type TNativeKeyboardObservationStatus = Readonly<{
  ownerId: string
  windowId: string
  epoch: number
  observationRevision: number
  ready: boolean
  windowActive: boolean
}>
export type TNativeKeyboardObservation = Readonly<{
  isEnabled: boolean
  targetTag?: number
  lifetimeKey: string
  canAct: () => boolean
  onKeyDown: (event: TNativeObservedKeyboardEvent) => void
}>

export const createNativeKeyboardObservations = (ownerId: string) => {
  type TEntry = {
    key: string
    id: string
    lease: symbol
    options: TNativeKeyboardObservation
    bornRevision: number
    acknowledged: boolean
  }
  const entries = new Map<string, TEntry>()
  const listeners = new Set<() => void>()
  let serial = 0,
    revision = 0,
    version = 0,
    published = ""
  let disposed = false,
    enabled = true,
    ready = false,
    active = false
  let windowId = "",
    epoch = 0,
    lastEventId = 0,
    statusRevision = -1
  const changed = () => {
    revision++
    ready = false
  }
  const retire = () => {
    for (const entry of entries.values()) {
      entry.id = `${ownerId}:observe:${++serial}`
      entry.bornRevision = revision + 1
      entry.acknowledged = false
    }
    changed()
  }
  const signature = (options: TNativeKeyboardObservation) =>
    JSON.stringify([options.isEnabled, options.targetTag ?? 0, options.lifetimeKey])
  const registrations = () =>
    !enabled || disposed
      ? []
      : [...entries.values()]
          .filter(({ options }) => options.isEnabled)
          .map(({ id, options }) => ({ id, targetTag: options.targetTag ?? 0 }))
  const flush = () => {
    const next = JSON.stringify([registrations(), revision, ready, active, windowId, epoch])
    if (next === published) return
    console.warn("CUI_TIMEPICKER_OBSERVE", JSON.stringify({ stage: "js-registration", ownerId, wire: next }))
    published = next
    version++
    for (const listener of [...listeners]) listener()
  }
  return {
    ownerId,
    snapshot: () => version,
    registrations,
    revision: () => revision,
    session: () => ({ windowId, epoch }),
    isNativeReady: () => !disposed && enabled && active && ready,
    flush,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    setEnabled: (next: boolean) => {
      if (enabled === next) return
      enabled = next
      retire()
    },
    register: (key: string, options: TNativeKeyboardObservation) => {
      if (disposed) throw new Error("Native keyboard observation scope is disposed")
      if (entries.has(key)) throw new Error("Native keyboard observation identity is already registered")
      const entry: TEntry = {
        key,
        id: `${ownerId}:observe:${++serial}`,
        lease: Symbol(key),
        options,
        bornRevision: revision + 1,
        acknowledged: false,
      }
      entries.set(key, entry)
      changed()
      return {
        update: (next: TNativeKeyboardObservation) => {
          if (entries.get(key) !== entry) return
          if (signature(next) !== signature(entry.options)) {
            entry.id = `${ownerId}:observe:${++serial}`
            entry.bornRevision = revision + 1
            entry.acknowledged = false
            changed()
          }
          entry.options = next
        },
        unregister: () => {
          if (entries.get(key) === entry) {
            entries.delete(key)
            changed()
          }
        },
      }
    },
    acceptStatus: (status: TNativeKeyboardObservationStatus) => {
      console.warn(
        "CUI_TIMEPICKER_OBSERVE",
        JSON.stringify({ stage: "js-status", status, ownerId, windowId, epoch, revision, statusRevision }),
      )
      if (
        disposed ||
        status.ownerId !== ownerId ||
        !Number.isSafeInteger(status.epoch) ||
        !Number.isSafeInteger(status.observationRevision) ||
        status.observationRevision < 0 ||
        status.observationRevision > revision ||
        status.epoch < epoch ||
        (status.epoch === epoch && status.windowId !== windowId)
      )
        return false
      if (status.epoch !== epoch || status.windowId !== windowId) {
        windowId = status.windowId
        epoch = status.epoch
        lastEventId = 0
        statusRevision = -1
        retire()
      }
      if (status.observationRevision < statusRevision) return false
      statusRevision = status.observationRevision
      if (active && !status.windowActive) retire()
      active = status.windowActive
      const nativeReady = !!windowId && enabled && active && status.ready
      if (status.observationRevision === revision) {
        ready = nativeReady
        if (!nativeReady) for (const entry of entries.values()) entry.acknowledged = false
      } else if (!enabled || !active) ready = false
      // A native revision acknowledges every still-live identity born at or before that revision.
      if (nativeReady) {
        for (const entry of entries.values())
          if (entry.options.isEnabled && entry.bornRevision <= status.observationRevision) entry.acknowledged = true
      }
      flush()
      return ready
    },
    dispatch: (event: TNativeObservedKeyboardEvent) => {
      const data = event.nativeEvent
      console.warn(
        "CUI_TIMEPICKER_OBSERVE",
        JSON.stringify({
          stage: "js-dispatch",
          data,
          ownerId,
          enabled,
          active,
          ready,
          windowId,
          epoch,
          revision,
          statusRevision,
          lastEventId,
          registrations: [...entries.values()].map(({ id, options, bornRevision, acknowledged }) => ({
            id,
            bornRevision,
            acknowledged,
            enabled: options.isEnabled,
            target: options.targetTag ?? 0,
            lifetime: options.lifetimeKey,
          })),
        }),
      )
      if (
        disposed ||
        !enabled ||
        !active ||
        data.ownerId !== ownerId ||
        data.windowId !== windowId ||
        data.epoch !== epoch ||
        !Number.isSafeInteger(data.observationRevision) ||
        data.observationRevision < 0 ||
        data.observationRevision > revision ||
        !Number.isSafeInteger(data.eventId) ||
        data.eventId <= lastEventId ||
        data.cancelled
      )
        return false
      lastEventId = data.eventId
      const session = { windowId, epoch }
      const selected = new Set(data.observerIds)
      const initial = [...entries.values()]
        .filter(
          (entry) =>
            selected.has(entry.id) &&
            entry.options.isEnabled &&
            entry.acknowledged &&
            data.observationRevision >= entry.bornRevision,
        )
        .map((entry) => ({ entry, id: entry.id, lease: entry.lease }))
      let delivered = false
      const errors: unknown[] = []
      for (const { entry, id, lease } of initial) {
        if (
          disposed ||
          !enabled ||
          !active ||
          session.windowId !== windowId ||
          session.epoch !== epoch ||
          entries.get(entry.key) !== entry ||
          entry.id !== id ||
          entry.lease !== lease ||
          !entry.options.isEnabled ||
          !entry.acknowledged ||
          data.observationRevision < entry.bornRevision
        )
          continue
        try {
          const canAct = entry.options.canAct()
          console.warn("CUI_TIMEPICKER_OBSERVE", JSON.stringify({ stage: "js-caller", id, canAct }))
          if (!canAct) continue
          delivered = true
          entry.options.onKeyDown(event)
        } catch (error) {
          errors.push(error)
        }
      }
      if (errors.length)
        throw errors.length === 1
          ? errors[0]
          : new AggregateError(errors, "Native keyboard observation callbacks failed")
      return delivered
    },
    dispose: () => {
      if (disposed) return
      disposed = true
      ready = active = false
      entries.clear()
      changed()
      listeners.clear()
      flush()
    },
  }
}

export type TNativeKeyboardObservations = ReturnType<typeof createNativeKeyboardObservations>
