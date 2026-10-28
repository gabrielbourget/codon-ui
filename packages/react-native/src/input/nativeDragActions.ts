import { createContext } from "react"

import type { TNativeKeyScope } from "./keyScope"
import NativeModule from "./specs/NativeCUIDragAndDrop"

export type TNativeDragActionIdentity = Readonly<{
  moduleId: string
  ownerId: string
  bindingId: string
  revision: string
  windowId: string
  sessionId: string
  kind: "lift" | "move" | "target" | "exit" | "activate" | "drop" | "end"
  surfaceId: number
  scopeTarget: number
  rootTarget: number
  itemTarget: number
  epoch: number
}>
export type TNativeDragActionPacket = Readonly<{
  version: 1
  token: number
  identity: TNativeDragActionIdentity
  payload: Readonly<Record<string, unknown>>
}>
export type TNativeDragMemberBinding = Readonly<{
  key: string
  instanceId: string
  targetTag: number
  handleTag: number
  role?: "source" | "target" | "both"
}>
export type TNativeDragViewBinding = Readonly<{
  draggable: boolean
  droppable: boolean
  members: readonly TNativeDragMemberBinding[]
  scrollTarget?: number
  scrollInstanceId?: string
  previewTarget: number
  previewInstanceId: string
  previewX: number
  previewY: number
}>
export type TNativeDragWindow = Readonly<{
  windowId: string
  epoch: number
  surfaceId: number
  scopeTarget: number
  available: boolean
  canLift: boolean
  canDrop: boolean
}>
export type TNativeDragActionRegistration = Readonly<{
  bindingId: string
  revision: string
  rootTarget: number
  itemTargets: ReadonlySet<number>
  native?: TNativeDragViewBinding
  current: () => boolean
  retire: () => void
  dispatch: (packet: TNativeDragActionPacket, current: () => boolean) => unknown
}>
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Native drag action: original packet object required")
  return value as Record<string, unknown>
}
const positive = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0
const target = (value: unknown): value is number => positive(value) && value <= 2147483647
export const parseNativeDragAction = (encoded: string): TNativeDragActionPacket => {
  const packet = object(JSON.parse(encoded)),
    identity = object(packet.identity)
  if (packet.version !== 1 || !positive(packet.token)) throw new Error("Native drag action: original token required")
  for (const key of ["moduleId", "ownerId", "bindingId", "revision", "windowId", "sessionId"])
    if (typeof identity[key] !== "string" || !identity[key])
      throw new Error("Native drag action: original identity required")
  if (
    typeof identity.kind !== "string" ||
    !["lift", "move", "target", "exit", "activate", "drop", "end"].includes(identity.kind) ||
    !positive(identity.epoch) ||
    ![identity.surfaceId, identity.scopeTarget, identity.rootTarget].every(target) ||
    (identity.itemTarget !== 0 && !target(identity.itemTarget))
  )
    throw new Error("Native drag action: original native targets required")
  return {
    version: 1,
    token: packet.token,
    identity: identity as TNativeDragActionIdentity,
    payload: object(packet.payload),
  }
}

export const createNativeDragActions = (scope: TNativeKeyScope) => {
  type TEntry = { moduleId: string; value: TNativeDragActionRegistration; live: boolean; nativeReady: boolean }
  const entries = new Map<string, TEntry>()
  const listeners = new Set<() => void>()
  let revision = 0,
    published = 0,
    enabled = true,
    failure = ""
  let window: TNativeDragWindow = {
    windowId: "",
    epoch: 0,
    surfaceId: 0,
    scopeTarget: 0,
    available: false,
    canLift: false,
    canDrop: false,
  }
  const flush = () => {
    if (published === revision) return
    published = revision
    for (const listener of listeners) listener()
  }
  const changed = () => {
    revision++
    flush()
  }
  const lastTokens = new Map<string, number>()
  let disposed = false
  let cleanupErrors: unknown[] = []
  const current = (entry: TEntry) =>
    !disposed &&
    enabled &&
    window.available &&
    entry.live &&
    entries.get(entry.value.bindingId) === entry &&
    entry.value.current()
  const checkedNative = (value: TNativeDragViewBinding) => {
    const keys = new Set<string>(),
      instances = new Set<string>()
    if (
      typeof value.draggable !== "boolean" ||
      typeof value.droppable !== "boolean" ||
      !Array.isArray(value.members) ||
      (value.scrollTarget !== undefined &&
        value.scrollTarget !== 0 &&
        (!target(value.scrollTarget) || !value.scrollInstanceId)) ||
      typeof value.previewInstanceId !== "string" ||
      !Number.isFinite(value.previewX) ||
      !Number.isFinite(value.previewY) ||
      (value.previewTarget !== 0 && (!target(value.previewTarget) || !value.previewInstanceId))
    )
      throw new Error("Native drag action: invalid native view metadata")
    for (const member of value.members) {
      if (
        typeof member.key !== "string" ||
        typeof member.instanceId !== "string" ||
        !member.instanceId ||
        !target(member.targetTag) ||
        (member.handleTag !== 0 && !target(member.handleTag)) ||
        (member.role !== undefined && !["both", "source", "target"].includes(member.role)) ||
        keys.has(`${member.key}:${member.role ?? "both"}`) ||
        instances.has(member.instanceId)
      )
        throw new Error("Native drag action: duplicate or invalid original member metadata")
      keys.add(`${member.key}:${member.role ?? "both"}`)
      instances.add(member.instanceId)
    }
    return { ...value, members: value.members.map((member) => ({ ...member })) }
  }
  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    ownerId: scope.ownerId,
    snapshot: () => revision,
    flush,
    window: () => ({ ...window }),
    error: () => failure,
    setEnabled: (next: boolean) => {
      if (enabled === next) return
      enabled = next
      revision++
    },
    bindings: () =>
      JSON.stringify(
        !enabled || disposed
          ? []
          : [...entries.values()].flatMap((entry) =>
              entry.live && entry.value.native && entry.value.current()
                ? [
                    {
                      ...entry.value.native,
                      moduleId: entry.moduleId,
                      bindingId: entry.value.bindingId,
                      revision: entry.value.revision,
                      rootTarget: entry.value.rootTarget,
                    },
                  ]
                : [],
            ),
      ),
    acceptStatus: (encoded: string) => {
      const status = object(JSON.parse(encoded))
      if (
        disposed ||
        status.ownerId !== scope.ownerId ||
        typeof status.windowId !== "string" ||
        !positive(status.epoch)
      )
        return
      if (
        status.epoch < window.epoch ||
        (status.epoch === window.epoch && window.windowId && status.windowId !== window.windowId)
      )
        return
      if (status.kind === "window") {
        if (
          !target(status.surfaceId) ||
          !target(status.scopeTarget) ||
          typeof status.available !== "boolean" ||
          typeof status.canLift !== "boolean" ||
          typeof status.canDrop !== "boolean"
        )
          throw new Error("Native drag action: invalid original window status")
        const next = {
          windowId: status.windowId,
          epoch: status.epoch,
          surfaceId: status.surfaceId,
          scopeTarget: status.scopeTarget,
          available: status.available,
          canLift: status.canLift,
          canDrop: status.canDrop,
        }
        if (
          next.epoch !== window.epoch ||
          next.windowId !== window.windowId ||
          next.surfaceId !== window.surfaceId ||
          next.scopeTarget !== window.scopeTarget ||
          !next.available
        ) {
          for (const entry of entries.values()) {
            entry.nativeReady = false
            entry.value.retire()
          }
        }
        if (JSON.stringify(next) !== JSON.stringify(window)) {
          window = next
          changed()
        }
        return
      }
      if (status.epoch !== window.epoch || status.windowId !== window.windowId || !window.available) return
      const entry = typeof status.bindingId === "string" ? entries.get(status.bindingId) : undefined
      if (
        !entry ||
        status.moduleId !== entry.moduleId ||
        status.revision !== entry.value.revision ||
        status.rootTarget !== entry.value.rootTarget
      )
        return
      if (status.kind === "retired") {
        entry.value.retire()
        changed()
        return
      }
      if (status.kind !== "binding" || typeof status.ready !== "boolean" || typeof status.error !== "string")
        throw new Error("Native drag action: invalid original binding status")
      if (status.error && !failure) failure = status.error
      if (entry.nativeReady !== status.ready || status.error) {
        entry.nativeReady = status.ready
        changed()
      }
    },
    register: (value: TNativeDragActionRegistration) => {
      if (
        disposed ||
        !NativeModule ||
        !value.bindingId ||
        !value.revision ||
        !target(value.rootTarget) ||
        [...value.itemTargets].some((tag) => !target(tag)) ||
        entries.has(value.bindingId)
      )
        throw new Error("Native drag action: invalid or duplicate original collection binding")
      const moduleId = NativeModule.getLease()
      if (!moduleId) throw new Error("Native drag action: original native module is unavailable")
      const entry: TEntry = {
        moduleId,
        value: {
          ...value,
          native: value.native ? checkedNative(value.native) : undefined,
          itemTargets: new Set(value.itemTargets),
        },
        live: true,
        nativeReady: false,
      }
      entries.set(value.bindingId, entry)
      changed()
      return {
        moduleId,
        current: () => current(entry),
        ready: () => current(entry) && (!entry.value.native || entry.nativeReady),
        updateNative: (native: TNativeDragViewBinding) => {
          if (!entry.live || disposed || entries.get(value.bindingId) !== entry)
            throw new Error("Native drag action: original registration retired")
          const checked = checkedNative(native)
          if (JSON.stringify(checked) === JSON.stringify(entry.value.native)) return
          entry.value = {
            ...entry.value,
            native: checked,
            itemTargets: new Set(checked.members.map((member) => member.targetTag)),
          }
          entry.nativeReady = false
          changed()
        },
        unregister: () => {
          if (!entry.live) return
          entry.live = false
          if (entries.get(value.bindingId) === entry) entries.delete(value.bindingId)
          value.retire()
          changed()
        },
      }
    },
    dispatch: (encoded: string) => {
      const native = NativeModule
      const packet = parseNativeDragAction(encoded),
        identity = packet.identity
      const entry = entries.get(identity.bindingId),
        session = window
      if (
        !native ||
        !entry ||
        !current(entry) ||
        entry.moduleId !== identity.moduleId ||
        scope.ownerId !== identity.ownerId ||
        identity.windowId !== session.windowId ||
        identity.epoch !== session.epoch ||
        identity.revision !== entry.value.revision ||
        identity.rootTarget !== entry.value.rootTarget ||
        identity.surfaceId !== session.surfaceId ||
        identity.scopeTarget !== session.scopeTarget ||
        (identity.kind === "lift" && (!window.canLift || (!!entry.value.native && !entry.nativeReady))) ||
        (["target", "activate", "drop"].includes(identity.kind) && !window.canDrop) ||
        (identity.itemTarget !== 0 && !entry.value.itemTargets.has(identity.itemTarget)) ||
        packet.token <= (lastTokens.get(identity.moduleId) ?? 0) ||
        !native.acceptsAction(encoded)
      )
        throw new Error("Native drag action: original collection/window/action authority is unavailable")
      lastTokens.set(identity.moduleId, packet.token)
      const accepts = () =>
        current(entry) &&
        window.windowId === identity.windowId &&
        window.epoch === identity.epoch &&
        native.acceptsAction(encoded)
      let response: unknown,
        failure: unknown,
        failed = false
      try {
        response = entry.value.dispatch(packet, accepts)
        if (response && typeof response === "object" && "then" in response)
          throw new Error("Native drag action: synchronous original action response required")
        if (!accepts()) throw new Error("Native drag action: original authority retired during callback")
      } catch (error) {
        failure = error
        failed = true
        response = { error: error instanceof Error ? error.message : String(error) }
      }
      try {
        const serialized = JSON.stringify(response)
        if (serialized === undefined) throw new Error("Native drag action: explicit native response required")
        const settled = native.settleAction(
          JSON.stringify({ version: 1, token: packet.token, identity, response: serialized }),
        )
        if (!settled && !failed) {
          failed = true
          failure = new Error("Native drag action: original native acknowledgement was refused")
        }
      } catch (error) {
        if (!failed) {
          failed = true
          failure = error
        }
      }
      if (failed) {
        try {
          entry.value.retire()
        } catch (error) {
          cleanupErrors.push(error)
        }
        throw failure
      }
      return response
    },
    takeCleanupErrors: () => {
      const errors = cleanupErrors
      cleanupErrors = []
      return errors
    },
    dispose: () => {
      disposed = true
      let failure: unknown,
        failed = false
      for (const entry of entries.values()) {
        entry.live = false
        try {
          entry.value.retire()
        } catch (error) {
          if (!failed) {
            failure = error
            failed = true
          }
        }
      }
      entries.clear()
      lastTokens.clear()
      listeners.clear()
      if (failed) throw failure
    },
  }
}
export type TNativeDragActions = ReturnType<typeof createNativeDragActions>
export const NativeDragActionsContext = createContext<TNativeDragActions | null>(null)
