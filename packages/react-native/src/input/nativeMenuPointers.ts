import type { NativeSyntheticEvent } from "react-native"

import type { TNativeKeyScope } from "./keyScope"
import type { NativeMenuPointerData } from "./specs/CUIKeyboardScopeNativeComponent"

export type TNativeMenuPointerData = Omit<NativeMenuPointerData, "hitPath"> & { readonly hitPath: readonly number[] }
export type TNativeMenuPointerEvent = NativeSyntheticEvent<TNativeMenuPointerData>
type TTargets = Readonly<{
  parentTarget: number
  submenuTarget: number
  triggerTarget: number
  parentBinding: string
  submenuBinding: string
  triggerBinding: string
}>
export type TNativeMenuPointerPolicy = TTargets & {
  enabled: boolean
  current: () => boolean
  observe: (event: TNativeMenuPointerEvent) => void
  retire: () => void
}
type TEntry = { id: string; options: TNativeMenuPointerPolicy; ready: boolean; sequence: number }
const target = (value: number) => Number.isSafeInteger(value) && value > 0 && value <= 2147483647
const fields = [
  "parentTarget",
  "submenuTarget",
  "triggerTarget",
  "parentBinding",
  "submenuBinding",
  "triggerBinding",
] as const
const signature = (options: TNativeMenuPointerPolicy) =>
  JSON.stringify([options.enabled, ...fields.map((field) => options[field])])

// This registry admits original native policy receipts. It never prevents a public event or repairs focus.
export const createNativeMenuPointers = (scope: TNativeKeyScope) => {
  const entries = new Map<string, TEntry>()
  const listeners = new Set<() => void>()
  let revision = 0,
    version = 0,
    serial = 0
  let enabled = true,
    disposed = false
  let session = scope.acknowledgedSession()
  const active = () => !disposed && enabled && !!session.windowId && scope.isWindowActive() === true
  let wasActive = active()
  const changed = () => {
    revision++
    version++
    for (const entry of entries.values()) {
      const wasReady = entry.ready
      entry.ready = false
      if (wasReady) entry.options.retire()
    }
  }
  const flush = () => {
    for (const listener of [...listeners]) listener()
  }
  const retire = (entry: TEntry) => {
    entry.ready = false
    entry.sequence = 0
    entry.id = `${scope.ownerId}:menu-pointer:${++serial}`
    entry.options.retire()
  }
  const retireAll = () => {
    for (const entry of entries.values()) retire(entry)
    changed()
  }
  const validTargets = (options: TNativeMenuPointerPolicy) => {
    const targets = [options.parentTarget, options.submenuTarget, options.triggerTarget]
    if (!targets.every(target) || new Set(targets).size !== 3) return false
    try {
      const [parent, submenu, trigger] = [options.parentBinding, options.submenuBinding, options.triggerBinding].map(
        (binding) => JSON.parse(binding),
      )
      const identity = ["ownerId", "rootId", "rootRevision", "target", "surfaceId", "windowId", "epoch", "sequence"]
      return (
        [parent, submenu, trigger].every(
          (binding) =>
            binding &&
            typeof binding === "object" &&
            ["ownerId", "rootId", "rootRevision"].every(
              (field) => typeof binding[field] === "string" && binding[field],
            ) &&
            target(binding.target) &&
            target(binding.metadataTarget) &&
            [binding.surfaceId, binding.epoch, binding.sequence].every(
              (value) => Number.isSafeInteger(value) && value >= 0,
            ) &&
            binding.windowId === session.windowId &&
            typeof binding.descriptorId === "string" &&
            typeof binding.descriptorRevision === "string",
        ) &&
        parent.descriptorId === "" &&
        parent.descriptorRevision === "" &&
        parent.metadataTarget === parent.target &&
        submenu.descriptorId === "" &&
        submenu.descriptorRevision === "" &&
        submenu.metadataTarget === submenu.target &&
        !!trigger.descriptorId &&
        !!trigger.descriptorRevision &&
        identity.every((field) => parent[field] === trigger[field]) &&
        parent.surfaceId === submenu.surfaceId
      )
    } catch {
      return false
    }
  }
  const api = {
    snapshot: () => version,
    revision: () => revision,
    flush,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    syncSession: () => {
      const next = scope.acknowledgedSession()
      if (session.windowId !== next.windowId || session.epoch !== next.epoch) {
        session = next
        retireAll()
        flush()
      } else if (wasActive && !active()) {
        retireAll()
        flush()
      }
      wasActive = active()
    },
    setEnabled: (next: boolean) => {
      if (enabled === next) return
      enabled = next
      retireAll()
      wasActive = active()
    },
    policies: () =>
      active()
        ? [...entries.values()]
            .filter(({ options }) => options.enabled && options.current() && validTargets(options))
            .map(({ id, options }) => ({
              id,
              parentTarget: options.parentTarget,
              submenuTarget: options.submenuTarget,
              triggerTarget: options.triggerTarget,
              parentBinding: options.parentBinding,
              submenuBinding: options.submenuBinding,
              triggerBinding: options.triggerBinding,
            }))
        : [],
    register: (key: string, options: TNativeMenuPointerPolicy) => {
      if (disposed || entries.has(key)) throw new Error("Native Menu requires a unique live pointer-policy lease")
      const entry: TEntry = {
        id: `${scope.ownerId}:menu-pointer:${++serial}`,
        options: { ...options },
        ready: false,
        sequence: 0,
      }
      entries.set(key, entry)
      changed()
      return {
        update: (next: TNativeMenuPointerPolicy) => {
          if (entries.get(key) !== entry) return
          if (signature(entry.options) !== signature(next)) {
            retire(entry)
            changed()
          }
          entry.options = { ...next }
        },
        unregister: () => {
          if (entries.get(key) !== entry) return
          entries.delete(key)
          retire(entry)
          changed()
        },
      }
    },
    dispatch: (event: TNativeMenuPointerEvent) => {
      api.syncSession()
      const data = event.nativeEvent
      if (
        !active() ||
        data.ownerId !== scope.ownerId ||
        data.windowId !== session.windowId ||
        data.epoch !== session.epoch ||
        data.revision !== revision
      )
        return false
      const entry = [...entries.values()].find(({ id }) => id === data.policyId)
      if (
        !entry ||
        !entry.options.enabled ||
        !entry.options.current() ||
        !validTargets(entry.options) ||
        !Number.isSafeInteger(data.sequence) ||
        data.sequence <= entry.sequence ||
        ![data.pageX, data.pageY, data.timestamp].every(Number.isFinite)
      )
        return false
      if (data.phase !== "status" && data.phase !== "retired" && (!entry.ready || !data.ready)) return false
      if (
        ["move", "handoff"].includes(data.phase) &&
        (data.pointerType !== "mouse" || !Number.isSafeInteger(data.observationId) || data.observationId <= 0)
      )
        return false
      if (
        data.phase === "down" &&
        (!["mouse", "touch", "pen"].includes(data.pointerType) ||
          !Number.isSafeInteger(data.observationId) ||
          data.observationId <= 0)
      )
        return false
      if (
        data.phase === "handoff" &&
        (!target(data.target) || data.hitPath[0] !== data.target || !data.hitPath.includes(entry.options.parentTarget))
      )
        return false
      entry.sequence = data.sequence
      if (data.phase === "status" || data.phase === "retired") {
        const next = data.phase === "status" && data.ready
        const wasReady = entry.ready
        entry.ready = next
        if (wasReady && !next) entry.options.retire()
      }
      entry.options.observe(event)
      return true
    },
    dispose: () => {
      if (disposed) return
      disposed = true
      retireAll()
      entries.clear()
      listeners.clear()
    },
  }
  return api
}
export type TNativeMenuPointers = ReturnType<typeof createNativeMenuPointers>
