import { createContext } from "react"

import type { NativeCollectionActionData } from "../input/specs/CUICollectionRootNativeComponent"

import type { NativeCollectionSession } from "./session"
import { getNativeCollectionMetadataIdentity, type TNativeCollectionNode } from "./snapshot"

export type TNativeCollectionActionOutcome = "accepted" | "rejected" | "failed"

type TLease = NonNullable<ReturnType<NativeCollectionSession<unknown>["getSnapshot"]>["receipt"]["lease"]>
type TRequest = Readonly<{
  requestId: string
  actionSequence: number
  binding: string
  visibleTarget: number
}>
type TPending = {
  request: TRequest
  node: TNativeCollectionNode<unknown> | null
  lease: TLease
  action: () => void
  settled?: (outcome: TNativeCollectionActionOutcome) => void
}

// A JS collection receipt selects a candidate. Only the original native root can admit its current visible binding.
export class NativeCollectionActions {
  readonly #session: NativeCollectionSession<unknown>
  readonly #pending = new Map<string, TPending>()
  readonly #listeners = new Set<() => void>()
  #sequence = 0
  #requests = "[]"

  constructor(session: NativeCollectionSession<unknown>) {
    this.#session = session
    session.subscribe(() => {
      const { receipt } = session.getSnapshot()
      const retired: TPending[] = []
      for (const [id, pending] of this.#pending)
        if (receipt.status !== "confirmed" || receipt.lease !== pending.lease) {
          this.#pending.delete(id)
          retired.push(pending)
        }
      this.#publish()
      for (const pending of retired) pending.settled?.("rejected")
    })
  }
  getSnapshot = () => this.#requests
  subscribe = (listener: () => void) => {
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
    }
  }

  bindingFor = (node: TNativeCollectionNode<unknown> | null) => {
    const { collection, receipt } = this.#session.getSnapshot()
    const identity = node
      ? getNativeCollectionMetadataIdentity(node)
      : { descriptorId: "", descriptorRevision: "", metadataTarget: receipt.lease?.target }
    if (
      !identity ||
      receipt.status !== "confirmed" ||
      !receipt.lease ||
      (node !== null && !this.#matchesNode(node, collection.getItem(node.key)))
    )
      return ""
    const { ownerId, rootId, rootRevision, target, surfaceId, windowId, epoch, sequence } = receipt.lease
    return JSON.stringify({ ownerId, rootId, rootRevision, target, surfaceId, windowId, epoch, sequence, ...identity })
  }

  request = (
    node: TNativeCollectionNode<unknown> | null,
    visibleTarget: number,
    action: () => void,
    settled?: (outcome: TNativeCollectionActionOutcome) => void,
  ) => {
    const binding = this.bindingFor(node),
      { receipt } = this.#session.getSnapshot()
    if (
      !binding ||
      !Number.isSafeInteger(visibleTarget) ||
      visibleTarget <= 0 ||
      visibleTarget > 2147483647 ||
      !receipt.lease
    ) {
      settled?.("rejected")
      return false
    }
    const requestId = `${this.#session.scope.rootRevision}:action:${++this.#sequence}`
    const request = Object.freeze({ requestId, actionSequence: this.#sequence, binding, visibleTarget })
    this.#pending.set(requestId, { request, node, lease: receipt.lease, action, settled })
    this.#publish()
    return true
  }

  receive = (packet: NativeCollectionActionData) => {
    const pending = this.#pending.get(packet.requestId)
    if (!pending) return false
    const { request, node, lease, action, settled } = pending
    const identity = ["ownerId", "rootId", "rootRevision", "target"] as const
    if (!identity.every((field) => packet[field] === lease[field]) || packet.visibleTarget !== request.visibleTarget)
      return false
    this.#pending.delete(packet.requestId)
    this.#publish()
    const current = this.#session.getSnapshot()
    const matches = ["surfaceId", "windowId", "epoch", "sequence"] as const
    if (
      !packet.accepted ||
      !matches.every((field) => packet[field] === lease[field]) ||
      current.receipt.lease !== lease ||
      current.receipt.status !== "confirmed" ||
      (node !== null && !this.#matchesNode(node, current.collection.getItem(node.key)))
    ) {
      settled?.("rejected")
      return false
    }
    try {
      action()
    } catch (error) {
      settled?.("failed")
      throw error
    }
    settled?.("accepted")
    return true
  }

  reset = () => {
    const retired = [...this.#pending.values()]
    this.#pending.clear()
    this.#publish()
    for (const pending of retired) pending.settled?.("rejected")
  }
  #matchesNode = (node: TNativeCollectionNode<unknown>, current: TNativeCollectionNode<unknown> | null) => {
    const identity = getNativeCollectionMetadataIdentity(node)
    const confirmed = current && getNativeCollectionMetadataIdentity(current)
    return (
      !!identity &&
      !!confirmed &&
      identity.descriptorId === confirmed.descriptorId &&
      identity.descriptorRevision === confirmed.descriptorRevision &&
      identity.metadataTarget === confirmed.metadataTarget
    )
  }
  #publish = () => {
    const next = JSON.stringify([...this.#pending.values()].map(({ request }) => request))
    if (next === this.#requests) return
    this.#requests = next
    for (const listener of this.#listeners) listener()
  }
}

export const NativeCollectionActionsContext = createContext<NativeCollectionActions | null>(null)
