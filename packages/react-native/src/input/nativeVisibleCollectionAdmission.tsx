import { useLayoutEffect, useState, useRef, useSyncExternalStore, type ElementRef, type ReactNode } from "react"
import { findNodeHandle, type View } from "react-native"

import { NativeCollectionActionAdmissionContext, type TNativeCollectionActionAdmission } from "../collection/actions"
import type { TNativeCollectionActionScope } from "../collection/model"

import NativeCollectionPublisher, { Commands } from "./specs/CUICollectionRootNativeComponent"

type TScope = TNativeCollectionActionScope
type TModel = Pick<TScope, "ownerId" | "generation" | "revision"> & {
  items: readonly { itemId: string; itemRevision: string }[]
}
type TRegistration = { id: string; original: object; scope: TScope; tag: number }
type TAcknowledgement = { id: string; tag: number; binding: string }
type TPending = {
  id: string
  sequence: number
  registration: TRegistration
  binding: string
  receive: (accepted: boolean) => void
}
export type TNativeVisibleCollectionAdmission = TNativeCollectionActionAdmission & {
  registerReceiver: (scope: TScope, original: object) => () => void
}
type TOriginalAccess = { binding: () => string; focusTextInput: () => boolean }
const originals = new WeakMap<object, Map<string, TOriginalAccess>>()
// null means unrelated to collection admission; empty means registered but unavailable.
export const nativeCollectionFocusBinding = (original: object): string | null => {
  const entries = originals.get(original)
  if (!entries) return null
  return entries.size === 1 ? [...entries.values()][0]!.binding() : ""
}
export const requestNativeCollectionTextInputFocus = (original: object): boolean | null => {
  const entries = originals.get(original)
  if (!entries) return null
  return entries.size === 1 && [...entries.values()][0]!.focusTextInput()
}
const owned = new WeakSet<object>()
export const isNativeVisibleCollectionAdmission = (value: object) => owned.has(value)
const sameOwner = (left: TScope, right: TScope) =>
  left.ownerId === right.ownerId && left.generation === right.generation && left.revision === right.revision
const sameScope = (left: TScope, right: TScope) =>
  sameOwner(left, right) && left.itemId === right.itemId && left.itemRevision === right.itemRevision
const validTag = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) > 0 && Number(value) <= 2147483647
const parseModel = (binding: string): TModel | null => {
  try {
    const value: unknown = JSON.parse(binding)
    if (!value || typeof value !== "object") return null
    const model = value as TModel
    if (
      ![model.ownerId, model.generation, model.revision].every((id) => typeof id === "string" && id.length > 0) ||
      !Array.isArray(model.items)
    )
      return null
    const ids = new Set<string>()
    for (const item of model.items) {
      if (
        !item ||
        typeof item.itemId !== "string" ||
        !item.itemId ||
        typeof item.itemRevision !== "string" ||
        !item.itemRevision ||
        ids.has(item.itemId)
      )
        return null
      ids.add(item.itemId)
    }
    return {
      ownerId: model.ownerId,
      generation: model.generation,
      revision: model.revision,
      items: model.items.map(({ itemId, itemRevision }) => ({ itemId, itemRevision })),
    }
  } catch {
    return null
  }
}
let nextAdapter = 0

// Bindings are native acknowledgements to revalidate, never certificates of continuous attachment.
export const createNativeVisibleCollectionAdmission = (
  resolveTag: (original: object) => number | null = (original) => findNodeHandle(original as View),
  dispatchTextInputFocus: (target: number, binding: string) => boolean = () => false,
) => {
  const identity = `visible-collection-${++nextAdapter}`
  const roots = new Map<string, TRegistration & { model: TModel }>()
  const receivers = new Map<string, TRegistration>()
  const acknowledged = new Map<string, TAcknowledgement>()
  const pending = new Map<string, TPending>()
  const listeners = new Set<() => void>()
  let serial = 0,
    version = 0,
    publicationVersion = 0,
    receiptSequence = 0
  let publisher = "",
    publisherInstance = 0,
    ownerLifetime = "",
    active = true
  const publish = () => {
    version++
    for (const listener of listeners) listener()
  }
  const root = () => (roots.size === 1 ? [...roots.values()][0] : undefined)
  const registrationFor = (scope: TScope) => {
    const owner = root()
    if (!owner || !sameOwner(owner.scope, scope)) return undefined
    if (!scope.itemId && !scope.itemRevision) return owner
    if (!owner.model.items.some((item) => item.itemId === scope.itemId && item.itemRevision === scope.itemRevision))
      return undefined
    const matches = [...receivers.values()].filter((receiver) => sameScope(receiver.scope, scope))
    return matches.length === 1 ? matches[0] : undefined
  }
  const finish = (request: TPending, accepted: boolean) => {
    if (!pending.delete(request.id)) return
    request.receive(accepted)
  }
  const invalidate = (id?: string) => {
    if (id) {
      acknowledged.delete(id)
      if (roots.has(id)) ownerLifetime = ""
    } else {
      acknowledged.clear()
      ownerLifetime = ""
    }
    for (const request of [...pending.values()]) if (!id || request.registration.id === id) finish(request, false)
  }
  const changed = () => {
    publicationVersion++
    publish()
  }
  const registration = (scope: TScope, original: object): TRegistration => ({
    id: `${identity}:registration:${++serial}`,
    original,
    scope: { ...scope },
    tag: resolveTag(original) ?? 0,
  })
  const retainOriginal = (entry: TRegistration) => {
    const entries = originals.get(entry.original) ?? new Map<string, TOriginalAccess>()
    const binding = () =>
      active && registrationFor(entry.scope) === entry && resolveTag(entry.original) === entry.tag
        ? (acknowledged.get(entry.id)?.binding ?? "")
        : ""
    entries.set(entry.id, {
      binding,
      focusTextInput: () => {
        const current = binding()
        return !!current && dispatchTextInputFocus(entry.tag, current)
      },
    })
    originals.set(entry.original, entries)
    return () => {
      entries.delete(entry.id)
      if (!entries.size) originals.delete(entry.original)
    }
  }
  const envelope = () => {
    const owner = root()
    return JSON.stringify({
      intent: `${identity}:publication:${publicationVersion}`,
      model: owner?.model ?? null,
      root: owner ? { id: owner.id, tag: owner.tag } : null,
      receivers: [...receivers.values()]
        .filter((receiver) => owner && sameOwner(receiver.scope, owner.scope))
        .map(({ id, tag, scope }) => ({ id, tag, itemId: scope.itemId, itemRevision: scope.itemRevision })),
    })
  }
  const adapter: TNativeVisibleCollectionAdmission = {
    registerOwner: (binding, original) => {
      const model = parseModel(binding)
      if (!model) throw new TypeError("Collection admission requires a complete explicit model")
      const entry = { ...registration({ ...model, itemId: "", itemRevision: "" }, original), model }
      roots.set(entry.id, entry)
      const release = retainOriginal(entry)
      invalidate()
      changed()
      return () => {
        if (roots.delete(entry.id)) {
          release()
          invalidate()
          changed()
        }
      }
    },
    registerReceiver: (scope, original) => {
      const entry = registration(scope, original)
      receivers.set(entry.id, entry)
      const release = retainOriginal(entry)
      // Duplicate receiver claims invalidate the earlier handle immediately, before native publication.
      for (const receiver of [...roots.values(), ...receivers.values()])
        if (
          sameScope(receiver.scope, scope) ||
          receiver.original === original ||
          (validTag(entry.tag) && receiver.tag === entry.tag)
        )
          invalidate(receiver.id)
      changed()
      return () => {
        if (receivers.delete(entry.id)) {
          release()
          invalidate(entry.id)
          changed()
        }
      }
    },
    ownerLifetimeFor: (ownerId, generation) => {
      const owner = root()
      return active && owner?.scope.ownerId === ownerId && owner.scope.generation === generation ? ownerLifetime : ""
    },
    bindingFor: (scope) => {
      const entry = registrationFor(scope)
      return active && entry ? (acknowledged.get(entry.id)?.binding ?? "") : ""
    },
    request: (scope, binding, target, receive) => {
      const entry = registrationFor(scope)
      if (
        !active ||
        !entry ||
        !binding ||
        !validTag(target) ||
        target !== entry.tag ||
        resolveTag(entry.original) !== target ||
        acknowledged.get(entry.id)?.binding !== binding
      ) {
        receive(false)
        return () => {}
      }
      const request = { id: `${identity}:request:${++serial}`, sequence: serial, registration: entry, binding, receive }
      pending.set(request.id, request)
      publish()
      return () => {
        if (pending.delete(request.id)) publish()
      }
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getSnapshot: () => version,
  }
  owned.add(adapter)
  return {
    adapter,
    publication: envelope,
    requests: () =>
      JSON.stringify(
        [...pending.values()].map(({ id, sequence, registration: entry, binding }) => ({
          id,
          sequence,
          binding,
          target: entry.tag,
        })),
      ),
    setActive: (next: boolean) => {
      if (active !== next) {
        active = next
        invalidate()
        changed()
      }
    },
    receiveCommit: (encoded: string) => {
      let value: {
        intent: string
        publisher: string
        instance: number
        sequence: number
        lifetime: string
        registrations: TAcknowledgement[]
      }
      try {
        value = JSON.parse(encoded)
      } catch {
        return
      }
      if (
        !active ||
        !value ||
        value.intent !== JSON.parse(envelope()).intent ||
        typeof value.publisher !== "string" ||
        !value.publisher ||
        !Number.isSafeInteger(value.sequence) ||
        !Array.isArray(value.registrations) ||
        typeof value.lifetime !== "string" ||
        !Number.isSafeInteger(value.instance) ||
        value.instance <= 0 ||
        value.instance < publisherInstance
      )
        return
      if (value.instance === publisherInstance && publisher && value.publisher !== publisher) return
      if (value.instance > publisherInstance) {
        invalidate()
        receiptSequence = 0
        publisherInstance = value.instance
      }
      if (value.sequence <= receiptSequence) return
      publisher = value.publisher
      receiptSequence = value.sequence
      const next = new Map<string, TAcknowledgement>()
      const duplicate = new Set<string>()
      const seenTags = new Map<number, string>()
      for (const ack of value.registrations) {
        if (!ack || typeof ack.id !== "string" || typeof ack.binding !== "string" || !ack.binding || !validTag(ack.tag))
          continue
        const entry = roots.get(ack.id) ?? receivers.get(ack.id)
        if (
          !entry ||
          registrationFor(entry.scope) !== entry ||
          entry.tag !== ack.tag ||
          resolveTag(entry.original) !== ack.tag
        )
          continue
        if (next.has(ack.id)) duplicate.add(ack.id)
        const earlier = seenTags.get(ack.tag)
        if (earlier) {
          duplicate.add(earlier)
          duplicate.add(ack.id)
        }
        seenTags.set(ack.tag, ack.id)
        next.set(ack.id, ack)
      }
      for (const id of duplicate) next.delete(id)
      const owner = root()
      ownerLifetime = owner && next.has(owner.id) ? value.lifetime : ""
      for (const [id, ack] of acknowledged) if (next.get(id)?.binding !== ack.binding) invalidate(id)
      if (root() !== owner || value.intent !== JSON.parse(envelope()).intent) {
        invalidate()
        publish()
        return
      }
      acknowledged.clear()
      for (const [id, ack] of next) acknowledged.set(id, ack)
      publish()
    },
    receiveAction: (encoded: string) => {
      let value: { id: string; publisher: string; binding: string; accepted: boolean }
      try {
        value = JSON.parse(encoded)
      } catch {
        return
      }
      if (!value || typeof value.id !== "string") return
      const request = pending.get(value.id)
      if (!request) return
      const entry = request.registration
      finish(
        request,
        active &&
          value.accepted === true &&
          value.publisher === publisher &&
          value.binding === request.binding &&
          registrationFor(entry.scope) === entry &&
          acknowledged.get(entry.id)?.binding === request.binding &&
          resolveTag(entry.original) === entry.tag,
      )
      publish()
    },
  }
}

export const NativeVisibleCollectionAdmission = ({ children }: { children: ReactNode }) => {
  const publisherRef = useRef<ElementRef<typeof NativeCollectionPublisher> | null>(null)
  const [state] = useState(() =>
    createNativeVisibleCollectionAdmission(undefined, (target, binding) => {
      if (!publisherRef.current) return false
      Commands.requestTextInputFocus(publisherRef.current, target, binding)
      return true
    }),
  )
  useSyncExternalStore(state.adapter.subscribe, state.adapter.getSnapshot, state.adapter.getSnapshot)
  useLayoutEffect(() => {
    state.setActive(true)
    return () => state.setActive(false)
  }, [state])
  return (
    <NativeCollectionActionAdmissionContext.Provider value={state.adapter}>
      <NativeCollectionPublisher
        ref={publisherRef}
        collapsable={false}
        accessible={false}
        pointerEvents="none"
        style={{ position: "absolute", width: 0, height: 0, opacity: 0 }}
        publication={state.publication()}
        actionRequests={state.requests()}
        onNativeCollectionCommit={(event) => state.receiveCommit(event.nativeEvent.data)}
        onNativeCollectionAction={(event) => state.receiveAction(event.nativeEvent.data)}
      />
      {children}
    </NativeCollectionActionAdmissionContext.Provider>
  )
}
