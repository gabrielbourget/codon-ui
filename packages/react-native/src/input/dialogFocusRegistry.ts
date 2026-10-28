import type { TNativeKeyScope } from "./keyScope"
import type { NativeDialogAction, NativeDialogStatus } from "./specs/CUIKeyboardScopeNativeComponent"

export type TNativeDialogTarget = Readonly<{ node: object | null; tag: number }>
export type TNativeDialogDescription = Readonly<{
  parentId: string
  ownerId?: string
  target: () => TNativeDialogTarget
  entryOwner: () => number
  entryAllowed: boolean
  canAct: () => boolean
}>
export type TNativeDialogOwner = Readonly<{
  parentId: string
  target: () => TNativeDialogTarget
  reserved: () => boolean
  contain?: () => boolean
  canAct: () => boolean
}>
export const createNativeDialogFocusRegistry = (scope: TNativeKeyScope) => {
  type TEntry = {
    lease: symbol
    description: TNativeDialogDescription
    identity: string
    bindingId: string
    reservedIdentity?: string
    reserved?: boolean
  }
  type TOwner = {
    lease: symbol
    description: TNativeDialogOwner
    requested: boolean
    identity: string
    bindingId: string
  }
  const entries = new Map<string, TEntry>()
  const owners = new Map<string, TOwner>()
  const requests = new Set<string>()
  const members = new Map<
    string,
    { lease: symbol; id: string; ownerId: string; target: () => TNativeDialogTarget; canAct: () => boolean }
  >()
  const nodes = new WeakMap<object, number>()
  const listeners = new Set<() => void>()
  let serial = 0,
    revision = 0,
    notification = 0,
    published = "",
    failure = "",
    disposed = false
  let bindings: {
    id: string
    parentId: string
    bindingId: string
    targetTag: number
    memberTargets: { id: string; targetTag: number }[]
    entryTargets: { id: string; targetTag: number; allowed: boolean }[]
    enabled: boolean
    entryAllowed: boolean
  }[] = []
  let lastAction: NativeDialogAction | null = null
  const nodeIdentity = (node: object) => {
    let id = nodes.get(node)
    if (id === undefined) {
      id = ++serial
      nodes.set(node, id)
    }
    return id
  }
  const valid = (target: TNativeDialogTarget) =>
    target.node !== null && Number.isSafeInteger(target.tag) && target.tag > 0
  const notify = () => {
    notification++
    for (const listener of listeners) listener()
  }
  const nativeId = (entry: TEntry | TOwner, target: TNativeDialogTarget, parentId: string) => {
    const identity = JSON.stringify([nodeIdentity(target.node!), target.tag, parentId, scope.acknowledgedSession()])
    if (identity !== entry.identity) {
      entry.identity = identity
      entry.bindingId = `${scope.ownerId}:dialog:${++serial}`
    }
    return entry.bindingId
  }
  const parentScope = (id: string) => entries.get(id)?.description.ownerId ?? id
  const memberTargets = (id: string) =>
    [
      ...new Map(
        [...members.values()]
          .filter((member) => member.canAct() && (parentScope(member.id) === id || member.ownerId === id))
          .map((member) => member.target())
          .filter(valid)
          .map(
            (member) =>
              [
                member.tag,
                { id: `${scope.ownerId}:member:${nodeIdentity(member.node!)}`, targetTag: member.tag },
              ] as const,
          ),
      ).values(),
    ].sort((a, b) => a.targetTag - b.targetTag)
  const flush = () => {
    if (disposed || (!entries.size && !bindings.length && !requests.size)) return
    const next: typeof bindings = []
    for (const [id, owner] of owners) {
      owner.requested ||= requests.has(id) || owner.description.contain?.() === true
      const target = owner.description.target()
      if (!owner.requested || !valid(target)) continue
      const entryTargets = [...entries]
        .filter(([, entry]) => entry.description.ownerId === id)
        .flatMap(([, entry]) => {
          const target = entry.description.target()
          if (!valid(target)) return []
          const entryId = nativeId(entry, target, id)
          if (entry.reservedIdentity !== entryId) {
            entry.reservedIdentity = entryId
            entry.reserved = owner.description.reserved()
          }
          return [
            {
              id: entryId,
              targetTag: target.tag,
              allowed: entry.description.entryAllowed && entry.description.canAct() && !entry.reserved,
            },
          ]
        })
      next.push({
        id,
        parentId: owner.description.parentId,
        bindingId: nativeId(owner, target, owner.description.parentId),
        targetTag: target.tag,
        memberTargets: memberTargets(id),
        entryTargets,
        enabled: scope.isNativeReady() && owner.description.canAct(),
        entryAllowed: false,
      })
    }
    for (const [id, entry] of entries) {
      const description = entry.description,
        target = description.target()
      if (description.ownerId || !valid(target)) continue
      next.push({
        id,
        parentId: parentScope(description.parentId),
        bindingId: nativeId(entry, target, description.parentId),
        targetTag: target.tag,
        memberTargets: memberTargets(id),
        entryTargets: [],
        enabled: scope.isNativeReady() && description.canAct(),
        entryAllowed: description.entryAllowed,
      })
    }
    const available = new Map(next.map((binding) => [binding.id, binding]))
    const complete = next.filter((binding) => {
      const seen = new Set([binding.id])
      let parent = binding.parentId
      while (parent) {
        if (seen.has(parent) || !available.has(parent)) return false
        seen.add(parent)
        parent = available.get(parent)!.parentId
      }
      return true
    })
    const signature = JSON.stringify([complete, scope.acknowledgedSession()])
    if (signature === published) return
    published = signature
    bindings = complete
    failure = ""
    lastAction = null
    revision++
    notify()
  }
  const sameSession = (data: { ownerId: string; windowId: string; epoch: number; revision: number }) => {
    const session = scope.acknowledgedSession()
    return (
      !disposed &&
      data.ownerId === scope.ownerId &&
      data.windowId === session.windowId &&
      data.epoch === session.epoch &&
      data.revision === revision
    )
  }
  return {
    snapshot: () => notification,
    revision: () => revision,
    bindings: () => bindings,
    error: () => failure,
    lastAction: () => lastAction,
    flush,
    hasRequested: (id: string) => entries.has(id) || requests.has(id) || owners.get(id)?.requested === true,
    hasEntryFor: (tag: number) =>
      bindings.some(
        (binding) =>
          binding.enabled &&
          ((owners.has(binding.id) && binding.targetTag === tag) ||
            (binding.entryAllowed && entries.get(binding.id)?.description.entryOwner() === tag)),
      ),
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    registerOwner: (id: string, description: TNativeDialogOwner) => {
      if (disposed) throw new Error("Native Dialog focus registry is disposed")
      const lease = Symbol(id)
      owners.set(id, { lease, description, requested: requests.has(id), identity: "", bindingId: "" })
      return {
        update: (value: TNativeDialogOwner) => {
          const entry = owners.get(id)
          if (entry?.lease === lease) entry.description = value
        },
        unregister: () => {
          if (owners.get(id)?.lease === lease) {
            owners.delete(id)
            requests.delete(id)
          }
        },
      }
    },
    register: (id: string, description: TNativeDialogDescription) => {
      if (disposed) throw new Error("Native Dialog focus registry is disposed")
      const lease = Symbol(id)
      if (description.ownerId) requests.add(description.ownerId)
      entries.set(id, { lease, description, identity: "", bindingId: "" })
      return {
        update: (value: TNativeDialogDescription) => {
          const entry = entries.get(id)
          if (entry?.lease === lease) {
            entry.description = value
            if (value.ownerId) requests.add(value.ownerId)
          }
        },
        unregister: () => {
          if (entries.get(id)?.lease === lease) {
            entries.delete(id)
          }
        },
      }
    },
    registerMember: (
      key: string,
      id: string,
      target: () => TNativeDialogTarget,
      canAct: () => boolean,
      ownerId = "",
    ) => {
      const lease = Symbol(key)
      if (!disposed) members.set(key, { lease, id, ownerId, target, canAct })
      return () => {
        if (members.get(key)?.lease === lease) {
          members.delete(key)
        }
      }
    },
    acceptStatus: (data: NativeDialogStatus) => {
      flush()
      if (!sameSession(data)) return false
      const previous = failure
      failure = data.error
      flush()
      if (failure !== previous) notify()
      return data.ready && !failure
    },
    acceptAction: (data: NativeDialogAction) => {
      flush()
      if (
        !sameSession(data) ||
        !scope.isNativeReady() ||
        !Number.isSafeInteger(data.target) ||
        data.target <= 0 ||
        !bindings.some((binding) => binding.id === data.id && binding.bindingId === data.bindingId && binding.enabled)
      )
        return false
      lastAction = data
      return true
    },
    dispose: () => {
      disposed = true
      bindings = []
      entries.clear()
      owners.clear()
      requests.clear()
      members.clear()
      listeners.clear()
      failure = ""
      lastAction = null
    },
  }
}
export type TNativeDialogFocusRegistry = ReturnType<typeof createNativeDialogFocusRegistry>
