import type { NativeInputModalityData, NativeScopeStatus } from "./specs/CUIKeyboardScopeNativeComponent"
import type { TNativeKeyboardData, TNativeKeyboardEvent } from "./types"

export type TNativeKeyPolicy = Readonly<{
  tokens: readonly string[]
  excludeEditable: boolean
  isEnabled: boolean
  lifetimeKey: string
  targetTag?: number
  excludeComposing?: boolean
  canAct: () => boolean
  onKey: (event: TNativeKeyboardEvent) => void
}>
export type TNativeKeyPolicySnapshot = Readonly<{
  id: string
  tokens: readonly string[]
  excludeEditable: boolean
  excludeComposing: boolean
  targetTag: number
}>

export const nativeKeyToken = (
  data: Pick<TNativeKeyboardData, "key" | "shiftKey" | "altKey" | "ctrlKey" | "metaKey">,
) => `${+data.shiftKey}${+data.altKey}${+data.ctrlKey}${+data.metaKey}:${data.key}`

export const nativeKeyTokens = (key: string) =>
  Array.from({ length: 16 }, (_, mask) =>
    nativeKeyToken({ key, shiftKey: !!(mask & 8), altKey: !!(mask & 4), ctrlKey: !!(mask & 2), metaKey: !!(mask & 1) }),
  )

export const createNativeKeyScope = (ownerId: string) => {
  type TEntry = { lease: symbol; policy: TNativeKeyPolicy; id: string }
  const entries = new Map<string, TEntry>()
  const listeners = new Set<() => void>()
  let revision = 0
  let serial = 0
  let published = ""
  let disposed = false
  let enabled = true
  let nativeRevision = 0
  let nativeReady = false
  let session = { windowId: "", epoch: 0 }
  let input: NativeInputModalityData | null = null
  let physicalWindowActive: boolean | null = null
  const changed = () => {
    nativeRevision++
    nativeReady = false
  }
  const retire = () => {
    for (const entry of entries.values()) entry.id = `${ownerId}:${++serial}`
    changed()
  }
  const copyPolicy = (policy: TNativeKeyPolicy): TNativeKeyPolicy => ({
    ...policy,
    tokens: [...new Set(policy.tokens)].sort(),
    targetTag: policy.targetTag ?? 0,
    excludeComposing: policy.excludeComposing ?? true,
  })
  const signature = (policy: TNativeKeyPolicy) =>
    JSON.stringify([
      policy.tokens,
      policy.excludeEditable,
      policy.excludeComposing,
      policy.isEnabled,
      policy.lifetimeKey,
      policy.targetTag,
    ])
  const policies = (): readonly TNativeKeyPolicySnapshot[] =>
    !enabled || disposed
      ? []
      : [...entries.values()]
          .filter(({ policy }) => policy.isEnabled)
          .reverse()
          .map(({ id, policy }) => ({
            id,
            tokens: [...policy.tokens],
            excludeEditable: policy.excludeEditable,
            excludeComposing: policy.excludeComposing ?? true,
            targetTag: policy.targetTag ?? 0,
          }))
  const flush = () => {
    const signature = JSON.stringify([policies(), session, nativeReady, nativeRevision, physicalWindowActive])
    if (signature === published) return
    published = signature
    revision++
    for (const listener of listeners) listener()
  }
  return {
    ownerId,
    snapshot: () => revision,
    policies,
    policyRevision: () => nativeRevision,
    acknowledgedSession: () => ({ ...session }),
    isNativeReady: () => nativeReady && enabled && !disposed,
    isWindowActive: () => physicalWindowActive,
    lastInput: () => input,
    recordInput: (next: NativeInputModalityData) => {
      if (disposed || next.ownerId !== ownerId || next.windowId !== session.windowId || next.epoch !== session.epoch)
        return
      if (input && next.timestamp < input.timestamp) return
      input = next
    },
    acceptNativeStatus: (status: NativeScopeStatus) => {
      if (disposed || status.ownerId !== ownerId || status.epoch < session.epoch) return false
      if (status.epoch === session.epoch && status.windowId !== session.windowId) return false
      if (status.epoch === session.epoch && status.policyRevision < nativeRevision && nativeReady) return true
      if (physicalWindowActive === true && !status.windowActive && status.epoch === session.epoch) {
        retire()
        input = null
      }
      if (status.epoch !== session.epoch || status.windowId !== session.windowId) {
        session = { windowId: status.windowId, epoch: status.epoch }
        input = null
        retire()
      }
      physicalWindowActive = status.windowActive
      nativeReady =
        !!status.windowId && enabled && status.ready && status.windowActive && status.policyRevision === nativeRevision
      flush()
      return nativeReady
    },
    flush,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    setEnabled: (next: boolean) => {
      if (enabled !== next) retire()
      enabled = next
    },
    register: (key: string, policy: TNativeKeyPolicy) => {
      if (disposed) throw new Error("Native key scope is disposed")
      const lease = Symbol(key)
      const entry: TEntry = { lease, policy: copyPolicy(policy), id: `${ownerId}:${++serial}` }
      entries.set(key, entry)
      changed()
      return {
        update: (next: TNativeKeyPolicy) => {
          if (entries.get(key)?.lease !== lease) return
          const normalized = copyPolicy(next)
          if (signature(entry.policy) !== signature(normalized)) {
            entry.id = `${ownerId}:${++serial}`
            changed()
          }
          entry.policy = normalized
        },
        unregister: () => {
          if (entries.get(key)?.lease === lease) {
            entries.delete(key)
            changed()
          }
        },
      }
    },
    dispatch: (
      policyId: string,
      event: TNativeKeyboardEvent,
      nativeSession = { ...session, policyRevision: nativeRevision },
    ) => {
      if (
        disposed ||
        !enabled ||
        !nativeReady ||
        event.nativeEvent.ownerId !== ownerId ||
        !event.nativeEvent.nativeDefaultHandled
      )
        return false
      if (
        nativeSession.windowId !== session.windowId ||
        nativeSession.epoch !== session.epoch ||
        nativeSession.policyRevision !== nativeRevision
      )
        return false
      const entry = [...entries.values()].find(({ id }) => id === policyId)
      if (!entry || !entry.policy.isEnabled || !entry.policy.canAct()) return false
      if (!entry.policy.tokens.includes(nativeKeyToken(event.nativeEvent))) return false
      entry.policy.onKey(event)
      return true
    },
    dispose: () => {
      if (disposed) return
      disposed = true
      input = null
      physicalWindowActive = false
      entries.clear()
      listeners.clear()
      changed()
      flush()
    },
  }
}
export type TNativeKeyScope = ReturnType<typeof createNativeKeyScope>
