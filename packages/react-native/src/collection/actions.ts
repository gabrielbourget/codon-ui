import { createContext } from "react"

import type { NativeCollectionModel, TNativeCollectionActionScope, TNativeCollectionModelSnapshot } from "./model"
import { getNativeCollectionNodeIdentity, type TNativeCollectionNode } from "./snapshot"

export type TNativeCollectionActionOutcome = "accepted" | "rejected" | "failed"

// Native acceptance rechecks the current original object, model, visibility and window.
// Unobserved clip-out/clip-in may preserve an intent; JS scope alone is never admission.
export type TNativeCollectionActionAdmission = {
  // Registration must resolve this original renderer ref, acknowledge native attachment, and retire only its own registration.
  registerOwner: (binding: string, originalRoot: object) => () => void
  registerReceiver?: (scope: TNativeCollectionActionScope, originalReceiver: object) => () => void
  // Historical native acknowledgement; observed changes invalidate it. Every action revalidates current state.
  ownerLifetimeFor: (ownerId: string, generation: string) => string
  bindingFor: (scope: TNativeCollectionActionScope) => string
  request: (
    scope: TNativeCollectionActionScope,
    binding: string,
    visibleTarget: number,
    receive: (accepted: boolean) => void,
  ) => () => void
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => number
}
export const NativeCollectionActionAdmissionContext = createContext<TNativeCollectionActionAdmission | null>(null)

type TPending = {
  reject: () => void
}
export class NativeCollectionActions {
  readonly #pending = new Set<TPending>()

  constructor(
    readonly model: Pick<NativeCollectionModel<unknown>, "getSnapshot" | "subscribe">,
    readonly admission: TNativeCollectionActionAdmission | null,
    readonly snapshot: TNativeCollectionModelSnapshot<unknown>,
  ) {}

  connect = () => this.model.subscribe(this.reset)

  #scope = (node: TNativeCollectionNode<unknown> | null): TNativeCollectionActionScope | null => {
    const snapshot = this.snapshot
    const identity = node && getNativeCollectionNodeIdentity(node)
    const current = node && snapshot.collection.getItem(node.key)
    const currentIdentity = current && getNativeCollectionNodeIdentity(current)
    if (node && (!identity || identity !== currentIdentity)) return null
    return Object.freeze({
      ownerId: snapshot.ownerId,
      generation: snapshot.generation,
      revision: snapshot.revision,
      itemId: identity?.itemId ?? "",
      itemRevision: identity?.itemRevision ?? "",
    })
  }

  registerReceiver = (node: TNativeCollectionNode<unknown>, original: object) => {
    const scope = this.#scope(node)
    return scope ? (this.admission?.registerReceiver?.(scope, original) ?? (() => {})) : () => {}
  }

  ownerLifetime = () => this.admission?.ownerLifetimeFor(this.snapshot.ownerId, this.snapshot.generation) ?? ""

  bindingFor = (node: TNativeCollectionNode<unknown> | null) => {
    const scope = this.#scope(node)
    return scope ? (this.admission?.bindingFor(scope) ?? "") : ""
  }

  request = (
    node: TNativeCollectionNode<unknown> | null,
    visibleTarget: number,
    action: () => void,
    settled?: (outcome: TNativeCollectionActionOutcome) => void,
  ) => {
    const snapshot = this.snapshot
    const scope = this.#scope(node)
    const binding = scope && this.admission?.bindingFor(scope)
    if (
      this.model.getSnapshot() !== snapshot ||
      !scope ||
      !binding ||
      !this.admission ||
      !Number.isSafeInteger(visibleTarget) ||
      visibleTarget <= 0 ||
      visibleTarget > 2147483647
    ) {
      settled?.("rejected")
      return false
    }
    let completed = false
    const finish = (outcome: TNativeCollectionActionOutcome) => {
      if (completed) return
      completed = true
      this.#pending.delete(pending)
      settled?.(outcome)
    }
    const pending: TPending = { reject: () => finish("rejected") }
    this.#pending.add(pending)
    const receive = (accepted: boolean) => {
      if (completed) return
      if (
        !accepted ||
        this.model.getSnapshot() !== snapshot ||
        !this.#scope(node) ||
        this.bindingFor(node) !== binding
      ) {
        finish("rejected")
        return
      }
      // Consume before invoking caller code: a reentrant model update cannot settle this operation twice.
      completed = true
      this.#pending.delete(pending)
      try {
        action()
      } catch (error) {
        settled?.("failed")
        throw error
      }
      settled?.("accepted")
    }
    try {
      const cancel = this.admission.request(scope, binding, visibleTarget, receive)
      pending.reject = () => {
        finish("rejected")
        cancel()
      }
      if (completed) cancel()
    } catch (error) {
      finish("failed")
      throw error
    }
    return true
  }

  reset = () => {
    for (const pending of [...this.#pending]) pending.reject()
  }
}

export const NativeCollectionActionsContext = createContext<NativeCollectionActions | null>(null)
