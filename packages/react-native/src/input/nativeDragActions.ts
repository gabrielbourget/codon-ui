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
export type TNativeDragActionRegistration = Readonly<{
  bindingId: string
  revision: string
  rootTarget: number
  itemTargets: ReadonlySet<number>
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
  const entries = new Map<string, { moduleId: string; value: TNativeDragActionRegistration; live: boolean }>()
  const lastTokens = new Map<string, number>()
  let disposed = false
  let cleanupErrors: unknown[] = []
  const current = (entry: { moduleId: string; value: TNativeDragActionRegistration; live: boolean }) =>
    !disposed &&
    entry.live &&
    entries.get(entry.value.bindingId) === entry &&
    scope.isNativeReady() &&
    entry.value.current()
  return {
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
      const entry = { moduleId, value: { ...value, itemTargets: new Set(value.itemTargets) }, live: true }
      entries.set(value.bindingId, entry)
      return {
        moduleId,
        current: () => current(entry),
        unregister: () => {
          if (!entry.live) return
          entry.live = false
          if (entries.get(value.bindingId) === entry) entries.delete(value.bindingId)
          value.retire()
        },
      }
    },
    dispatch: (encoded: string) => {
      const native = NativeModule
      const packet = parseNativeDragAction(encoded),
        identity = packet.identity
      const entry = entries.get(identity.bindingId),
        session = scope.acknowledgedSession()
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
        (identity.itemTarget !== 0 && !entry.value.itemTargets.has(identity.itemTarget)) ||
        packet.token <= (lastTokens.get(identity.moduleId) ?? 0) ||
        !native.acceptsAction(encoded)
      )
        throw new Error("Native drag action: original collection/window/action authority is unavailable")
      lastTokens.set(identity.moduleId, packet.token)
      const accepts = () =>
        current(entry) &&
        scope.acknowledgedSession().windowId === identity.windowId &&
        scope.acknowledgedSession().epoch === identity.epoch &&
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
      if (failed) throw failure
    },
  }
}
export type TNativeDragActions = ReturnType<typeof createNativeDragActions>
export const NativeDragActionsContext = createContext<TNativeDragActions | null>(null)
