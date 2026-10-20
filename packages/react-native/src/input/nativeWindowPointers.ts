import type { NativeSyntheticEvent } from "react-native"

import type { TNativeKeyScope } from "./keyScope"
import type { NativePointerStatus, NativeWindowPointerData } from "./specs/CUIKeyboardScopeNativeComponent"

export type TNativeWindowPointerEvent = NativeSyntheticEvent<NativeWindowPointerData>
type TRegistration = {
  targetTag: number
  global: boolean
  stopPropagation: boolean
  current: () => boolean
  start: (event: TNativeWindowPointerEvent, current: () => boolean) => boolean
  move: (event: TNativeWindowPointerEvent) => void
  end: (event: TNativeWindowPointerEvent, success: boolean) => void
  activate: (event: TNativeWindowPointerEvent) => void
  retire: () => void
}
type TEntry = {
  id: string
  order: number
  options: TRegistration
  bornRevision: number
  acknowledged: boolean
  pointer?: number
  current: () => boolean
}
const windows = new Map<string, ReturnType<typeof createNativeWindowPointers>>()
const sequences = new Map<string, number>()
let serial = 0
const primary = (data: NativeWindowPointerData) => (data.pointerType === "mouse" ? data.button <= 0 : data.isPrimary)

// One native packet preserves ordering across scopes. Claims never touch the original event/defaults.
export const dispatchNativeWindowPointer = (event: TNativeWindowPointerEvent) => {
  const data = event.nativeEvent
  const emitter = windows.get(data.ownerId)
  if (!emitter?.acceptSequence(data)) return false
  if (data.sequence <= (sequences.get(data.windowId) ?? 0)) return false
  sequences.set(data.windowId, data.sequence)
  const seen = new Set<string>()
  const selected = data.registrations.flatMap((registration) => {
    if (seen.has(registration.id)) return []
    seen.add(registration.id)
    const scope = windows.get(registration.ownerId)
    const entry = scope?.select(data, registration)
    return entry ? [{ entry, id: registration.id, depth: registration.depth }] : []
  })
  selected.sort((left, right) =>
    left.entry.options.global !== right.entry.options.global
      ? left.entry.options.global
        ? 1
        : -1
      : left.entry.options.global
        ? left.entry.order - right.entry.order
        : left.depth - right.depth || left.entry.order - right.entry.order,
  )
  let claimed = false
  const errors: unknown[] = []
  for (const { entry, id, depth } of selected) {
    const current = () => entry.id === id && entry.current()
    if (!current()) continue
    const options = entry.options
    try {
      if (data.phase === "activation") {
        if (!claimed && (options.global || depth >= 0)) {
          options.activate(event)
          claimed ||= options.stopPropagation
        }
      } else if (data.phase === "start") {
        if (claimed || !primary(data) || (!options.global && depth < 0) || entry.pointer !== undefined) continue
        if (options.start(event, current)) {
          entry.pointer = data.pointerId
          claimed ||= options.stopPropagation
        }
      } else if (entry.pointer === data.pointerId) {
        if (data.phase === "move") options.move(event)
        else {
          entry.pointer = undefined
          options.end(event, data.phase === "end" && primary(data) && (options.global || depth >= 0))
        }
      }
    } catch (error) {
      errors.push(error)
    }
  }
  if (errors.length) throw new AggregateError(errors, "Native window pointer callbacks failed")
  return true
}

export const createNativeWindowPointers = (scope: TNativeKeyScope) => {
  const entries = new Map<string, TEntry>()
  const identities = new Map<string, TEntry>()
  const listeners = new Set<() => void>()
  let revision = 0,
    version = 0,
    sequence = 0,
    statusRevision = -1
  let session = scope.acknowledgedSession()
  let ready = false,
    disposed = false,
    enabled = true
  let failure = ""
  const changed = () => {
    revision++
    version++
  }
  const flush = () => {
    for (const listener of [...listeners]) listener()
  }
  const retire = () => {
    for (const entry of entries.values()) {
      entry.pointer = undefined
      entry.options.retire()
    }
  }
  const active = () => !disposed && enabled && scope.isWindowActive() === true
  const api = {
    snapshot: () => version,
    flush,
    revision: () => revision,
    error: () => failure,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    registrations: () =>
      active() ? [...entries.values()].map(({ id, options }) => ({ id, targetTag: options.targetTag })) : [],
    syncSession: () => {
      const next = scope.acknowledgedSession()
      if (session.windowId !== next.windowId || session.epoch !== next.epoch) {
        retire()
        session = next
        sequence = 0
        statusRevision = -1
        ready = false
        identities.clear()
        for (const entry of entries.values()) {
          entry.id = `${scope.ownerId}:pointer:${++serial}`
          identities.set(entry.id, entry)
          entry.bornRevision = revision + 1
          entry.acknowledged = false
        }
        changed()
        flush()
      }
      if (!active()) {
        retire()
        ready = false
      }
    },
    setEnabled: (next: boolean) => {
      if (enabled === next) return
      enabled = next
      retire()
      ready = false
      identities.clear()
      for (const entry of entries.values()) {
        entry.id = `${scope.ownerId}:pointer:${++serial}`
        identities.set(entry.id, entry)
        entry.bornRevision = revision + 1
        entry.acknowledged = false
      }
      changed()
    },
    register: (key: string, options: TRegistration) => {
      if (disposed || entries.has(key) || !Number.isSafeInteger(options.targetTag) || options.targetTag <= 0)
        throw new Error("Native motion: an actual unique pointer host is required")
      const entry: TEntry = {
        id: `${scope.ownerId}:pointer:${++serial}`,
        order: serial,
        options,
        bornRevision: revision + 1,
        acknowledged: false,
        current: () => active() && ready && entry.acknowledged && entries.get(key) === entry && options.current(),
      }
      entries.set(key, entry)
      identities.set(entry.id, entry)
      windows.set(scope.ownerId, api)
      changed()
      return () => {
        if (entries.get(key) !== entry) return
        entries.delete(key)
        identities.delete(entry.id)
        options.retire()
        changed()
        flush()
      }
    },
    acceptStatus: (status: NativePointerStatus) => {
      api.syncSession()
      if (
        disposed ||
        status.ownerId !== scope.ownerId ||
        status.windowId !== session.windowId ||
        status.epoch !== session.epoch ||
        !Number.isSafeInteger(status.revision) ||
        status.revision < 0 ||
        status.revision < statusRevision ||
        status.revision > revision
      )
        return
      statusRevision = status.revision
      const next = active() && status.ready
      failure = status.error
      if (!next) retire()
      for (const entry of entries.values()) {
        if (!next) entry.acknowledged = false
        else if (entry.bornRevision <= status.revision) entry.acknowledged = true
      }
      if (ready !== next || failure) {
        ready = next
        version++
        flush()
      }
    },
    acceptSequence: (data: NativeWindowPointerData) => {
      api.syncSession()
      if (
        !active() ||
        !ready ||
        data.windowId !== session.windowId ||
        data.epoch !== session.epoch ||
        !Number.isSafeInteger(data.sequence) ||
        data.sequence <= sequence ||
        ![data.pageX, data.pageY, data.timestamp].every(Number.isFinite)
      )
        return false
      sequence = data.sequence
      return true
    },
    select: (data: NativeWindowPointerData, registration: NativeWindowPointerData["registrations"][number]) => {
      api.syncSession()
      if (
        !active() ||
        !ready ||
        data.windowId !== session.windowId ||
        registration.epoch !== session.epoch ||
        !Number.isSafeInteger(registration.revision) ||
        registration.revision > revision
      )
        return
      const entry = identities.get(registration.id)
      return entry &&
        entry.options.targetTag === registration.targetTag &&
        registration.revision >= entry.bornRevision &&
        entry.current()
        ? entry
        : undefined
    },
    dispose: () => {
      retire()
      disposed = true
      ready = false
      entries.clear()
      identities.clear()
      listeners.clear()
      if (windows.get(scope.ownerId) === api) windows.delete(scope.ownerId)
      if (![...windows.values()].some((window) => window.windowId() === session.windowId))
        sequences.delete(session.windowId)
    },
    windowId: () => session.windowId,
  }
  return api
}
export type TNativeWindowPointers = ReturnType<typeof createNativeWindowPointers>
