import { createContext, useContext, useId, useInsertionEffect, useLayoutEffect, useRef } from "react"
import { findNodeHandle, type TextInput, type View } from "react-native"

export const AVAILABLE_NATIVE_EDITOR_WHEEL_SOURCES = ["mouse", "trackpad"] as const

export type TNativeEditorWheelStatus = Readonly<{
  ownerId: string
  bindingId: string
  bindingRevision: string
  target: number
  groupTarget: number
  windowId: string
  epoch: number
  sequence: number
  ready: boolean
  windowActive: boolean
  sourceKind: string
  error: string
}>
export type TNativeEditorWheelData = Readonly<{
  ownerId: string
  bindingId: string
  bindingRevision: string
  target: number
  groupTarget: number
  focusedTarget: number
  windowId: string
  epoch: number
  sequence: number
  timestamp: number
  deltaX: number
  deltaY: number
  rawAxisX: number
  rawAxisY: number
  sourceKind: string
  nativeDefaultHandled: boolean
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
}>

type TSession = { windowId?: string; epoch?: number; active: boolean }
type TOptions = {
  enabled: boolean
  lifetimeKey: string
  group: View | null
  current: () => TextInput | null
  currentGroup: () => View | null
  canAct: () => boolean
  onAction: (direction: -1 | 1, frame: TNativeEditorWheelData) => void
}
type TRegistration = Pick<TOptions, "current" | "currentGroup" | "canAct" | "onAction">
const positiveTag = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 2147483647
const serial = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0
const epoch = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0
const supported = (sourceKind: string) => AVAILABLE_NATIVE_EDITOR_WHEEL_SOURCES.some((source) => source === sourceKind)
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
const address = (value: Record<string, unknown>) =>
  ["ownerId", "bindingId", "bindingRevision", "windowId", "sourceKind"].every(
    (key) => typeof value[key] === "string",
  ) &&
  !!value.windowId &&
  positiveTag(value.target) &&
  positiveTag(value.groupTarget) &&
  epoch(value.epoch) &&
  serial(value.sequence)
const isStatus = (value: unknown): value is TNativeEditorWheelStatus =>
  record(value) &&
  address(value) &&
  typeof value.ready === "boolean" &&
  typeof value.windowActive === "boolean" &&
  typeof value.error === "string"
const isAction = (value: unknown): value is TNativeEditorWheelData =>
  record(value) &&
  address(value) &&
  positiveTag(value.focusedTarget) &&
  ["timestamp", "deltaX", "deltaY", "rawAxisX", "rawAxisY"].every(
    (key) => typeof value[key] === "number" && Number.isFinite(value[key]),
  ) &&
  ["nativeDefaultHandled", "altKey", "ctrlKey", "metaKey", "shiftKey"].every((key) => typeof value[key] === "boolean")

let nativeWheelRegistryGeneration = 0

export const createNativeOriginalEditorWheelPolicies = (ownerId: string, session: () => TSession) => {
  type TEntry = {
    bindingId: string
    bindingRevision: string
    targetTag: number
    groupTarget: number
    original: TextInput
    group: View
    options: TRegistration
    status: TNativeEditorWheelStatus | null
    ready: boolean
    sequences: Map<string, number>
  }
  const registryGeneration = ++nativeWheelRegistryGeneration
  const entries = new Map<string, TEntry>()
  const listeners = new Set<() => void>()
  let sequence = 0,
    version = 0,
    disposed = false
  const sessionSignature = (current: TSession) => JSON.stringify([current.windowId, current.epoch, current.active])
  let observedSession = { ...session() }
  const changed = () => {
    version++
    for (const listener of [...listeners]) listener()
  }
  const syncSession = () => {
    const current = session()
    if (sessionSignature(current) === sessionSignature(observedSession) || disposed) return
    const retired =
      current.windowId !== observedSession.windowId ||
      current.epoch !== observedSession.epoch ||
      (observedSession.active && !current.active)
    observedSession = { ...current }
    if (!retired) return
    for (const entry of entries.values()) entry.ready = false
    if (entries.size) changed()
  }
  const currentObjects = (entry: TEntry) =>
    entry.options.current() === entry.original &&
    entry.options.currentGroup() === entry.group &&
    findNodeHandle(entry.original) === entry.targetTag &&
    findNodeHandle(entry.group) === entry.groupTarget
  const matches = (entry: TEntry, data: TNativeEditorWheelStatus | TNativeEditorWheelData) => {
    const current = session()
    return (
      !disposed &&
      data.ownerId === ownerId &&
      data.bindingId === entry.bindingId &&
      data.bindingRevision === entry.bindingRevision &&
      data.target === entry.targetTag &&
      data.groupTarget === entry.groupTarget &&
      data.windowId === current.windowId &&
      data.epoch === current.epoch
    )
  }
  return {
    ownerId,
    snapshot: () => version,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    syncSession,
    bindings: () =>
      Object.freeze(
        [...entries.values()].map(({ bindingId, bindingRevision, targetTag, groupTarget }) =>
          Object.freeze({ bindingId, bindingRevision, targetTag, groupTarget }),
        ),
      ),
    status: (bindingId: string) => {
      const entry = [...entries.values()].find((entry) => entry.bindingId === bindingId)
      return {
        ready:
          !!entry &&
          !!entry.status &&
          matches(entry, entry.status) &&
          entry.ready &&
          session().active &&
          currentObjects(entry) &&
          entry.options.canAct(),
        packet: entry?.status ?? null,
      }
    },
    register: (key: string, original: TextInput, group: View, options: TRegistration) => {
      if (disposed || entries.has(key)) throw new Error("Native editor wheel binding is unavailable or duplicated")
      const targetTag = findNodeHandle(original),
        groupTarget = findNodeHandle(group)
      if (!positiveTag(targetTag) || !positiveTag(groupTarget))
        throw new Error("Native editor wheel requires its actual editor and group")
      if ([...entries.values()].some((entry) => entry.original === original || entry.targetTag === targetTag))
        throw new Error("Native editor wheel original is already registered")
      const identity = `${ownerId}:wheel:${registryGeneration}:${++sequence}`
      const entry: TEntry = {
        bindingId: identity,
        bindingRevision: `${identity}:revision`,
        targetTag,
        groupTarget,
        original,
        group,
        options,
        status: null,
        ready: false,
        sequences: new Map(),
      }
      entries.set(key, entry)
      changed()
      return {
        unregister: () => {
          if (entries.get(key) !== entry) return
          entries.delete(key)
          changed()
        },
      }
    },
    receiveStatus: (data: unknown) => {
      syncSession()
      if (!isStatus(data)) return false
      const entry = [...entries.values()].find((entry) => entry.bindingId === data.bindingId)
      if (!entry || !matches(entry, data)) return false
      const namespace = JSON.stringify([data.windowId, data.epoch])
      if (data.sequence <= (entry.sequences.get(namespace) ?? 0)) return false
      entry.sequences.set(namespace, data.sequence)
      entry.status = Object.freeze({ ...data })
      entry.ready =
        data.ready &&
        data.windowActive &&
        data.sourceKind === "android-generic-motion" &&
        data.error === "" &&
        currentObjects(entry)
      changed()
      return true
    },
    receive: (data: unknown) => {
      syncSession()
      if (!isAction(data)) return false
      const entry = [...entries.values()].find((entry) => entry.bindingId === data.bindingId)
      if (!entry || !matches(entry, data)) return false
      const namespace = JSON.stringify([data.windowId, data.epoch])
      if (data.sequence <= (entry.sequences.get(namespace) ?? 0)) return false
      // Refused current frames are still terminal: restoring a guard cannot replay them.
      entry.sequences.set(namespace, data.sequence)
      if (!session().active) return false
      if (!currentObjects(entry) || !entry.options.canAct()) {
        entry.ready = false
        return false
      }
      const status = entry.status
      if (
        !entry.ready ||
        !status ||
        status.windowId !== data.windowId ||
        status.epoch !== data.epoch ||
        status.sourceKind !== "android-generic-motion" ||
        !supported(data.sourceKind) ||
        !data.nativeDefaultHandled ||
        data.ctrlKey
      )
        return false
      if (Math.abs(data.deltaY) > Math.abs(data.deltaX)) entry.options.onAction(data.deltaY > 0 ? 1 : -1, data)
      return true
    },
    dispose: () => {
      if (disposed) return
      disposed = true
      entries.clear()
      // Scope disposal runs in insertion cleanup; it must not schedule React work.
      version++
      listeners.clear()
    },
  }
}

export const NativeOriginalEditorWheelContext = createContext<ReturnType<
  typeof createNativeOriginalEditorWheelPolicies
> | null>(null)

export const useNativeOriginalEditorWheelPolicy = (original: TextInput | null, options: TOptions) => {
  const registry = useContext(NativeOriginalEditorWheelContext)
  const key = useId()
  const committed = useRef({ original, options })
  useInsertionEffect(() => {
    committed.current = { original, options }
  })
  const group = options.group
  useLayoutEffect(() => {
    if (!registry || !original || !group || !options.enabled) return
    if (!positiveTag(findNodeHandle(original)) || !positiveTag(findNodeHandle(group))) return
    const lifetime = options.lifetimeKey
    const registration = registry.register(key, original, group, {
      current: () => committed.current.options.current(),
      currentGroup: () => committed.current.options.currentGroup(),
      canAct: () =>
        committed.current.original === original &&
        committed.current.options.group === group &&
        committed.current.options.enabled &&
        committed.current.options.lifetimeKey === lifetime &&
        committed.current.options.canAct(),
      onAction: (direction, frame) => committed.current.options.onAction(direction, frame),
    })
    return registration.unregister
  }, [registry, key, original, group, options.enabled, options.lifetimeKey])
}
