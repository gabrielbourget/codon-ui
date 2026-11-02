import {
  createContext,
  useContext,
  useId,
  useInsertionEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react"
import { findNodeHandle, type NativeSyntheticEvent, type View } from "react-native"

import {
  useNativeOrdinaryEditorKeys,
  type TNativeOrdinaryEditorKeyEvent,
  type TNativeToolbarDateKeyEvent,
} from "./ordinaryEditorKeys"
import type { TNativeKeyboardEvent } from "./types"

type TSession = { windowId?: string; epoch?: number; active: boolean }
export type TNativeToolbarKeyData = Readonly<{
  ownerId: string
  bindingId: string
  bindingRevision: string
  rootTarget: number
  target: number
  focusedTarget: number
  requestedTarget: number
  destinationTarget: number
  focusObserved: boolean
  windowId: string
  epoch: number
  eventId: number
  key: string
  nativeCode: number
  characters: string
  phase: "down" | "up"
  repeat: boolean
  cancelled: boolean
  isComposing: boolean
  shiftKey: boolean
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  capsLock: boolean
  nativeModifierData: string
  nativeDefaultHandled: boolean
  disposition: "arrow" | "tab" | "ordinary"
  timestamp: number
}>
// This is a genuine scope observation, not the original child synthetic key event.
export type TNativeToolbarKeyboardEvent = NativeSyntheticEvent<Readonly<{ packet: string }>>
export type TNativeToolbarKeyboardOptions = {
  orientation: "horizontal" | "vertical"
  current: () => View | null
  canAct: () => boolean
  receive: (data: TNativeToolbarKeyData, observation: TNativeToolbarKeyboardEvent) => void
}
export type TNativeToolbarOriginalKeyEvent = TNativeOrdinaryEditorKeyEvent<View, View>
export type TNativeToolbarObservedKeyEvent = TNativeToolbarOriginalKeyEvent | TNativeToolbarDateKeyEvent
export type TNativeToolbarListenerProps = {
  onNativeOrdinaryEditorKeyCapture: (event: TNativeOrdinaryEditorKeyEvent<View, View>) => void
  onNativeOrdinaryEditorKey: (event: TNativeOrdinaryEditorKeyEvent<View, View>) => void
  onNativeDateKeyCapture: (event: TNativeToolbarDateKeyEvent) => void
  onNativeDateKey: (event: TNativeToolbarDateKeyEvent) => void
}
export type TNativeToolbarCallbacks = {
  onKeyDownCapture?: (event: TNativeKeyboardEvent) => void
  onKeyUpCapture?: (event: TNativeKeyboardEvent) => void
  onKeyDown?: (event: TNativeKeyboardEvent) => void
  onKeyUp?: (event: TNativeKeyboardEvent) => void
}
type TOriginalRoute = TNativeToolbarKeyData & { physicalPath: number[] }
const originalAdmissions = new Map<string, (data: TOriginalRoute) => boolean>()
export const readNativeToolbarOriginalRoute = (event: TNativeToolbarObservedKeyEvent): TOriginalRoute | null => {
  const packet = event.nativeEvent.toolbarRoute
  if (typeof packet !== "string") return null
  let data: TOriginalRoute
  try {
    data = JSON.parse(packet) as TOriginalRoute
  } catch {
    return null
  }
  if (
    event.nativeEvent.kind !== "keyboard" ||
    !data ||
    (data.phase !== "down" && data.phase !== "up") ||
    (data.phase === "down" && data.cancelled) ||
    !Array.isArray(data.physicalPath) ||
    !data.physicalPath.includes(findNodeHandle(event.currentTarget) ?? -1) ||
    !data.physicalPath.includes(event.nativeEvent.target) ||
    event.nativeEvent.target !== findNodeHandle(event.target) ||
    event.nativeEvent.key !== data.key ||
    event.nativeEvent.nativeCode !== data.nativeCode ||
    event.nativeEvent.phase !== data.phase ||
    event.nativeEvent.cancelled !== data.cancelled ||
    !originalAdmissions.get(data.ownerId)?.(data)
  )
    return null
  return data
}

type TStatus = {
  ownerId: string
  bindingId: string
  bindingRevision: string
  rootTarget: number
  windowId: string
  epoch: number
  sequence: number
  ready: boolean
  observationReady?: boolean
  windowActive: boolean
  nestedToolbar: boolean
  error: string
}
const parse = (packet: string): unknown => {
  try {
    return JSON.parse(packet)
  } catch {
    return null
  }
}

export const createNativeToolbarKeyboard = (ownerId: string, session: () => TSession) => {
  type TEntry = {
    bindingId: string
    bindingRevision: string
    rootTarget: number
    original: View
    options: TNativeToolbarKeyboardOptions
    status: TStatus | null
    lastEventId: number
  }
  const entries = new Map<string, TEntry>()
  const listeners = new Set<() => void>()
  let serial = 0
  let version = 0
  let disposed = false
  let enabled = true
  const changed = () => {
    version++
    for (const listener of [...listeners]) listener()
  }
  const matches = (entry: TEntry, data: TStatus | TNativeToolbarKeyData) => {
    const current = session()
    return (
      !disposed &&
      enabled &&
      current.active &&
      entry.options.current() === entry.original &&
      entry.options.canAct() &&
      findNodeHandle(entry.original) === entry.rootTarget &&
      data.ownerId === ownerId &&
      data.bindingId === entry.bindingId &&
      data.bindingRevision === entry.bindingRevision &&
      data.rootTarget === entry.rootTarget &&
      !!data.windowId &&
      data.windowId === current.windowId &&
      data.epoch === current.epoch
    )
  }
  const admitOriginal = (data: TOriginalRoute) => {
    const entry = [...entries.values()].find((candidate) => candidate.bindingId === data.bindingId)
    return (
      !!entry &&
      matches(entry, data) &&
      !!(entry.status?.observationReady ?? entry.status?.ready) &&
      !!entry.status?.windowActive &&
      entry.status.windowId === data.windowId &&
      entry.status.epoch === data.epoch &&
      Number.isSafeInteger(data.eventId) &&
      data.eventId > 0
    )
  }
  originalAdmissions.set(ownerId, admitOriginal)
  return {
    snapshot: () => version,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    bindings: () =>
      JSON.stringify(
        (enabled ? [...entries.values()] : []).map(({ bindingId, bindingRevision, rootTarget, options }) => ({
          bindingId,
          bindingRevision,
          rootTarget,
          orientation: options.orientation,
        })),
      ),
    setEnabled: (next: boolean) => {
      if (enabled === next) return
      enabled = next
      for (const entry of entries.values()) {
        entry.bindingRevision = String(++serial)
        entry.status = null
        entry.lastEventId = 0
      }
      changed()
    },
    status: (key: string) => {
      const entry = entries.get(key)
      const status = entry?.status
      return {
        ready: !!entry && !!status?.ready && status.windowActive && matches(entry, status),
        nestedToolbar: status && entry && matches(entry, status) ? status.nestedToolbar : false,
        error: status?.error ?? "",
      }
    },
    register: (key: string, original: View, options: TNativeToolbarKeyboardOptions) => {
      if (disposed || entries.has(key)) throw new Error("Native toolbar binding is unavailable or duplicated")
      const rootTarget = findNodeHandle(original)
      if (!rootTarget || rootTarget <= 0) throw new Error("Native toolbar requires its original native root")
      if ([...entries.values()].some((entry) => entry.rootTarget === rootTarget))
        throw new Error("Native toolbar root is already registered")
      const entry: TEntry = {
        bindingId: `${ownerId}:toolbar:${key}`,
        bindingRevision: String(++serial),
        rootTarget,
        original,
        options,
        status: null,
        lastEventId: 0,
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
    acceptStatus: (packet: string) => {
      const parsed = parse(packet)
      if (!parsed || typeof parsed !== "object") return false
      const data = parsed as TStatus
      const entry = [...entries.values()].find((candidate) => candidate.bindingId === data.bindingId)
      if (
        !entry ||
        !matches(entry, data) ||
        !Number.isSafeInteger(data.sequence) ||
        data.sequence <= 0 ||
        (entry.status?.windowId === data.windowId &&
          entry.status.epoch === data.epoch &&
          data.sequence <= entry.status.sequence)
      )
        return false
      const previous = entry.status
      entry.status = data
      if (
        !previous ||
        previous.ready !== data.ready ||
        previous.observationReady !== data.observationReady ||
        previous.windowActive !== data.windowActive ||
        previous.nestedToolbar !== data.nestedToolbar ||
        previous.error !== data.error ||
        previous.windowId !== data.windowId ||
        previous.epoch !== data.epoch
      )
        changed()
      return data.ready && data.windowActive
    },
    dispatch: (observation: TNativeToolbarKeyboardEvent) => {
      const parsed = parse(observation.nativeEvent.packet)
      if (!parsed || typeof parsed !== "object") return false
      const data = parsed as TNativeToolbarKeyData
      const entry = [...entries.values()].find((candidate) => candidate.bindingId === data.bindingId)
      if (
        !entry ||
        !matches(entry, data) ||
        !entry.status?.ready ||
        !entry.status.windowActive ||
        data.windowId !== entry.status.windowId ||
        data.epoch !== entry.status.epoch ||
        !Number.isSafeInteger(data.eventId) ||
        data.eventId <= entry.lastEventId ||
        !Number.isSafeInteger(data.target) ||
        data.target <= 0 ||
        (data.phase !== "down" && data.phase !== "up") ||
        (data.phase === "down" && data.cancelled) ||
        !["arrow", "tab", "ordinary"].includes(data.disposition) ||
        (data.disposition === "tab" && data.nativeDefaultHandled)
      )
        return false
      entry.lastEventId = data.eventId
      observation.persist?.()
      // This preserves the scope observation; target identity remains explicitly in the native payload.
      entry.options.receive(data, observation)
      return true
    },
    dispose: () => {
      disposed = true
      entries.clear()
      if (originalAdmissions.get(ownerId) === admitOriginal) originalAdmissions.delete(ownerId)
      listeners.clear()
    },
  }
}
export const NativeToolbarKeyboardContext = createContext<ReturnType<typeof createNativeToolbarKeyboard> | null>(null)

export const useNativeToolbarKeyboard = (
  target: View | null,
  enabled: boolean,
  revisionKey: string,
  options: TNativeToolbarKeyboardOptions,
) => {
  const registry = useContext(NativeToolbarKeyboardContext)
  const key = useId()
  useSyncExternalStore(registry?.subscribe ?? (() => () => {}), registry?.snapshot ?? (() => 0), () => 0)
  const current = useRef(options)
  useInsertionEffect(() => {
    current.current = options
  })
  useLayoutEffect(() => {
    if (!enabled || !target) return
    if (!registry) throw new Error("Native toolbar requires a same-window NativeFloatingLayerHost")
    const lease = registry.register(key, target, {
      orientation: options.orientation,
      current: () => current.current.current(),
      canAct: () => current.current.canAct(),
      receive: (data, observation) => current.current.receive(data, observation),
    })
    return () => lease.unregister()
  }, [registry, key, target, enabled, revisionKey, options.orientation])
  return registry?.status(key) ?? { ready: false, nestedToolbar: false, error: "" }
}

export const useNativeToggleGroupNavigation = ({
  rootRef,
  orientation,
  receive,
}: {
  rootRef: RefObject<View | null>
  orientation: "horizontal" | "vertical"
  receive?: TNativeToolbarKeyboardOptions["receive"]
}) => {
  const [target, setTarget] = useState<View | null>(null)
  useLayoutEffect(() => {
    if (target !== rootRef.current) setTarget(rootRef.current)
  })
  const navigation = useNativeToolbarKeyboard(target, true, "", {
    orientation,
    current: () => rootRef.current,
    canAct: () => rootRef.current !== null,
    receive: (data, observation) => receive?.(data, observation),
  })
  const capture = useNativeOrdinaryEditorKeys(target, true, "toolbar-root", {
    current: () => rootRef.current,
    canAct: () => rootRef.current !== null,
    subtree: true,
    toolbar: true,
    receive: (event) => captureToolbarOriginal(rootRef.current, event),
    receiveDate: (event) => captureToolbarOriginal(rootRef.current, event),
  })
  return {
    ...navigation,
    listenerProps: { onNativeOrdinaryEditorKeyCapture: capture, onNativeDateKeyCapture: capture.receiveDate },
  }
}

export const useNativeToggleGroupKeyboardListeners = ({
  containerRef,
  ...callbacks
}: TNativeToolbarCallbacks & { containerRef: RefObject<View | null> }) => {
  const [target, setTarget] = useState<View | null>(null)
  const committed = useRef({ containerRef, callbacks })
  useInsertionEffect(() => {
    committed.current = { containerRef, callbacks }
  })
  useLayoutEffect(() => {
    if (target !== containerRef.current) setTarget(containerRef.current)
  })
  const capture = useNativeOrdinaryEditorKeys(target, true, "toolbar-capture", {
    current: () => committed.current.containerRef.current,
    canAct: () => committed.current.containerRef.current !== null,
    subtree: true,
    toolbar: true,
    receive: (event) => deliverToolbarObserver(event, committed.current.callbacks, "capture"),
    receiveDate: (event) => deliverToolbarObserver(event, committed.current.callbacks, "capture"),
  })
  const bubble = useNativeOrdinaryEditorKeys(target, true, "toolbar-bubble", {
    current: () => committed.current.containerRef.current,
    canAct: () => committed.current.containerRef.current !== null,
    subtree: true,
    toolbar: true,
    receive: (event) => deliverToolbarObserver(event, committed.current.callbacks, "bubble"),
    receiveDate: (event) => deliverToolbarObserver(event, committed.current.callbacks, "bubble"),
  })
  return {
    listenerProps: {
      onNativeOrdinaryEditorKeyCapture: capture,
      onNativeOrdinaryEditorKey: bubble,
      onNativeDateKeyCapture: capture.receiveDate,
      onNativeDateKey: bubble.receiveDate,
    },
  }
}

export const deliverNativeToolbarTargetKey = (
  original: View | null,
  event: TNativeToolbarOriginalKeyEvent,
  callbacks: Pick<TNativeToolbarCallbacks, "onKeyDown" | "onKeyUp">,
) => {
  if (
    !original ||
    event.target !== original ||
    event.currentTarget !== original ||
    !readNativeToolbarOriginalRoute(event)
  )
    return false
  if (event.nativeEvent.phase === "down") callbacks.onKeyDown?.(event)
  else callbacks.onKeyUp?.(event)
  return true
}

export const captureToolbarOriginal = (root: View | null, event: TNativeToolbarObservedKeyEvent) => {
  const route = readNativeToolbarOriginalRoute(event)
  if (!route || route.rootTarget !== findNodeHandle(root) || route.phase !== "down") return
  if (route.disposition === "arrow" || route.disposition === "tab") {
    event.stopPropagation()
    if (route.disposition === "arrow") event.preventDefault()
  }
}
export const deliverToolbarObserver = (
  event: TNativeToolbarObservedKeyEvent,
  callbacks: TNativeToolbarCallbacks,
  phase: "capture" | "bubble",
) => {
  if (event.isPropagationStopped() || !readNativeToolbarOriginalRoute(event)) return false
  const callback =
    event.nativeEvent.phase === "down"
      ? phase === "capture"
        ? callbacks.onKeyDownCapture
        : callbacks.onKeyDown
      : phase === "capture"
        ? callbacks.onKeyUpCapture
        : callbacks.onKeyUp
  callback?.(event as TNativeKeyboardEvent)
  return true
}
