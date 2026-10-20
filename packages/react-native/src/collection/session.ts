import type { NativeCollectionCommitData } from "../input/specs/CUICollectionRootNativeComponent"

import { NativeCollectionAdmission } from "./admission"
import {
  createNativeCollectionSnapshot,
  type TNativeCollectionDescriptor,
  type TNativeCollectionSnapshot,
} from "./snapshot"

export type TNativeCollectionScope = Readonly<Pick<NativeCollectionCommitData, "ownerId" | "rootId" | "rootRevision">>
type TReceipt<T> = ReturnType<NativeCollectionAdmission<T>["getSnapshot"]>
export type TNativeCollectionSessionSnapshot<T> = Readonly<{
  collection: TNativeCollectionSnapshot<T>
  receipt: TReceipt<T>
}>
type TCommittedDescriptor<T> = {
  descriptor: TNativeCollectionDescriptor<T>
  release?: () => void
}

export class NativeCollectionSession<T> {
  readonly scope: TNativeCollectionScope
  readonly #descriptors = new Map<string, TCommittedDescriptor<T>>()
  readonly #listeners = new Set<() => void>()
  readonly #earlyPackets = new Map<number, NativeCollectionCommitData>()
  #admission: NativeCollectionAdmission<T> | null = null
  #unsubscribe: (() => void) | null = null
  #target: number | null = null
  #generatedId = 0
  #revision = 0
  #snapshot: TNativeCollectionSessionSnapshot<T>

  constructor(scope: TNativeCollectionScope) {
    this.scope = Object.freeze({ ...scope })
    this.#snapshot = Object.freeze({
      collection: createNativeCollectionSnapshot<T>([], new Map()),
      receipt: Object.freeze({ status: "pending", collection: null, lease: null, error: "awaiting-native-root" }),
    })
  }

  getSnapshot = (): TNativeCollectionSessionSnapshot<T> => this.#snapshot
  subscribe = (listener: () => void) => {
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
    }
  }

  // Commit-only identity allocation. Neither counter establishes logical membership or navigation order.
  generateKey = () => `react-aria-${++this.#generatedId}`
  nextDescriptorRevision = () => `${this.scope.rootRevision}:descriptor:${++this.#revision}`

  commitDescriptor = (descriptor: TNativeCollectionDescriptor<T>) => {
    const entry: TCommittedDescriptor<T> = { descriptor }
    if (this.#admission) entry.release = this.#admission.commitDescriptor(descriptor)
    this.#descriptors.set(descriptor.descriptorId, entry)
    return () => {
      if (this.#descriptors.get(descriptor.descriptorId) !== entry) return
      this.#descriptors.delete(descriptor.descriptorId)
      entry.release?.()
    }
  }

  bindRootTarget = (target: number | null) => {
    if (target === this.#target) return
    if (target !== null && (!Number.isSafeInteger(target) || target <= 0))
      throw new Error("invalid-collection-root-target")
    this.#unsubscribe?.()
    this.#admission?.dispose()
    this.#unsubscribe = null
    this.#admission = null
    this.#target = target
    if (target === null) {
      this.#earlyPackets.clear()
      this.#publish(Object.freeze({ status: "pending", collection: null, lease: null, error: "awaiting-native-root" }))
      return
    }
    const admission = new NativeCollectionAdmission<T>({ ...this.scope, target }, this.#snapshot.collection)
    this.#admission = admission
    this.#unsubscribe = admission.subscribe(() => this.#publish(admission.getSnapshot()))
    for (const entry of this.#descriptors.values()) entry.release = admission.commitDescriptor(entry.descriptor)
    this.#publish(admission.getSnapshot())
    const early = this.#earlyPackets.get(target)
    this.#earlyPackets.clear()
    if (early) admission.receive(early)
  }

  receive = (packet: NativeCollectionCommitData): boolean => {
    if (
      packet.ownerId !== this.scope.ownerId ||
      packet.rootId !== this.scope.rootId ||
      packet.rootRevision !== this.scope.rootRevision
    )
      return false
    if (this.#admission) return this.#admission.receive(packet)
    // The candidate cannot publish before an independently committed native ref binds this exact target.
    const previous = this.#earlyPackets.get(packet.target)
    if (!previous || packet.sequence > previous.sequence)
      this.#earlyPackets.set(packet.target, Object.freeze({ ...packet }))
    return false
  }

  #publish = (receipt: TReceipt<T>) => {
    if (this.#snapshot.receipt === receipt) return
    const collection =
      receipt.status === "confirmed" && receipt.collection ? receipt.collection : this.#snapshot.collection
    this.#snapshot = Object.freeze({ collection, receipt })
    for (const listener of this.#listeners) listener()
  }
}
