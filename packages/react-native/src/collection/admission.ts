import type { NativeCollectionCommitData } from "../input/specs/CUICollectionRootNativeComponent"

import {
  createNativeCollectionSnapshot,
  type TNativeCollectionDescriptor,
  type TNativeCollectionHierarchyEntry,
  type TNativeCollectionSnapshot,
} from "./snapshot"

type TRootIdentity = Readonly<Pick<NativeCollectionCommitData, "ownerId" | "rootId" | "rootRevision" | "target">>
type TLease = Readonly<Omit<NativeCollectionCommitData, "hierarchy">>
type TAdmission<T> = Readonly<{
  status: "pending" | "confirmed" | "rejected" | "retired"
  collection: TNativeCollectionSnapshot<T> | null
  lease: TLease | null
  error: string
}>

const integer = (value: unknown, minimum: number): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= minimum

const parseHierarchy = (serialized: string, rootTarget: number): readonly TNativeCollectionHierarchyEntry[] => {
  if (typeof serialized !== "string") throw new Error("invalid-descriptor-hierarchy")
  const value: unknown = JSON.parse(serialized)
  if (!Array.isArray(value)) throw new Error("invalid-descriptor-hierarchy")
  return Object.freeze(
    value.map((entry: unknown) => {
      if (
        typeof entry !== "object" ||
        entry === null ||
        !("descriptorId" in entry) ||
        typeof entry.descriptorId !== "string" ||
        !("descriptorRevision" in entry) ||
        typeof entry.descriptorRevision !== "string" ||
        !("parentDescriptorId" in entry) ||
        typeof entry.parentDescriptorId !== "string" ||
        !("target" in entry) ||
        !integer(entry.target, 1) ||
        entry.target === rootTarget ||
        !("index" in entry) ||
        !integer(entry.index, 0) ||
        !("retainedIndex" in entry) ||
        !integer(entry.retainedIndex, 0) ||
        !("hasRetainedChildren" in entry) ||
        typeof entry.hasRetainedChildren !== "boolean"
      ) {
        throw new Error("invalid-descriptor-hierarchy")
      }
      return Object.freeze({
        descriptorId: entry.descriptorId,
        descriptorRevision: entry.descriptorRevision,
        parentDescriptorId: entry.parentDescriptorId,
        target: entry.target,
        index: entry.index,
        retainedIndex: entry.retainedIndex,
        hasRetainedChildren: entry.hasRetainedChildren,
      })
    }),
  )
}

// This joins committed JS payloads to native hierarchy receipts. It does not authorize business actions:
// visible input bindings still require native acknowledgement of the current root/descriptor lease.
export class NativeCollectionAdmission<T> {
  readonly #root: TRootIdentity
  readonly #descriptors = new Map<string, TNativeCollectionDescriptor<T>>()
  readonly #seen = new Map<string, { key: TNativeCollectionDescriptor<T>["key"]; revisions: Set<string> }>()
  #knownDescriptors = new WeakSet<TNativeCollectionDescriptor<T>>()
  readonly #lifetimes = new Map<string, symbol>()
  readonly #listeners = new Set<() => void>()
  #packet: NativeCollectionCommitData | null = null
  #watermark: NativeCollectionCommitData | null = null
  #resolvedPacket: NativeCollectionCommitData | null = null
  #dependencies = new Map<string, TNativeCollectionDescriptor<T> | undefined>()
  #previous: TNativeCollectionSnapshot<T> | null = null
  #state: TAdmission<T> = Object.freeze({
    status: "pending",
    collection: null,
    lease: null,
    error: "awaiting-native-commit",
  })

  constructor(root: TRootIdentity, previous?: TNativeCollectionSnapshot<T>) {
    if (!root.ownerId || !root.rootId || !root.rootRevision || !integer(root.target, 1)) {
      throw new Error("invalid-collection-root")
    }
    this.#root = Object.freeze({ ...root })
    this.#previous = previous ?? null
  }

  getSnapshot = () => this.#state
  subscribe = (listener: () => void) => {
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
    }
  }

  // Call only from a committed descriptor lifetime, never from render or to establish sibling order.
  commitDescriptor = (descriptor: TNativeCollectionDescriptor<T>) => {
    if (this.#state.status === "retired") throw new Error("retired-collection-root")
    if (
      !descriptor.descriptorId ||
      !descriptor.descriptorRevision ||
      !descriptor.type ||
      (typeof descriptor.key !== "string" && typeof descriptor.key !== "number") ||
      (typeof descriptor.key === "number" && Number.isNaN(descriptor.key))
    ) {
      throw new Error("invalid-collection-descriptor")
    }
    const versions = this.#seen.get(descriptor.descriptorId) ?? { key: descriptor.key, revisions: new Set<string>() }
    if (versions.key !== descriptor.key) throw new Error("Cannot change the id of an item")
    if (versions.revisions.has(descriptor.descriptorRevision) && !this.#knownDescriptors.has(descriptor)) {
      throw new Error("reused-descriptor-revision")
    }
    Object.freeze(descriptor)
    versions.revisions.add(descriptor.descriptorRevision)
    this.#knownDescriptors.add(descriptor)
    this.#seen.set(descriptor.descriptorId, versions)
    this.#descriptors.set(descriptor.descriptorId, descriptor)
    const lifetime = Symbol()
    this.#lifetimes.set(descriptor.descriptorId, lifetime)
    this.#resolve()
    return () => {
      if (this.#lifetimes.get(descriptor.descriptorId) !== lifetime) return
      this.#descriptors.delete(descriptor.descriptorId)
      this.#lifetimes.delete(descriptor.descriptorId)
      this.#resolve()
    }
  }

  receive = (packet: NativeCollectionCommitData): boolean => {
    if (
      this.#state.status === "retired" ||
      packet.ownerId !== this.#root.ownerId ||
      packet.rootId !== this.#root.rootId ||
      packet.rootRevision !== this.#root.rootRevision ||
      packet.target !== this.#root.target
    ) {
      return false
    }
    if (
      !integer(packet.sequence, 1) ||
      !integer(packet.epoch, 0) ||
      !integer(packet.surfaceId, 0) ||
      typeof packet.windowId !== "string" ||
      !packet.windowId
    ) {
      this.#packet = null
      this.#publish("rejected", null, null, "invalid-collection-lease")
      return false
    }
    const previous = this.#watermark
    if (
      previous &&
      (packet.sequence <= previous.sequence ||
        packet.epoch < previous.epoch ||
        (packet.epoch === previous.epoch &&
          (packet.windowId !== previous.windowId || packet.surfaceId !== previous.surfaceId)))
    ) {
      return false
    }
    this.#packet = Object.freeze({ ...packet })
    this.#watermark = this.#packet
    this.#resolve()
    return true
  }

  dispose = () => {
    if (this.#state.status === "retired") return
    this.#packet = null
    this.#watermark = null
    this.#resolvedPacket = null
    this.#descriptors.clear()
    this.#seen.clear()
    this.#knownDescriptors = new WeakSet()
    this.#lifetimes.clear()
    this.#dependencies.clear()
    this.#previous = null
    this.#publish("retired", null, null, "retired-collection-root")
    this.#listeners.clear()
  }

  #publish = (
    status: TAdmission<T>["status"],
    collection: TNativeCollectionSnapshot<T> | null,
    lease: TLease | null,
    error: string,
  ) => {
    if (
      this.#state.status === status &&
      this.#state.collection === collection &&
      this.#state.lease === lease &&
      this.#state.error === error
    )
      return
    this.#state = Object.freeze({ status, collection, lease, error })
    for (const listener of this.#listeners) listener()
  }

  #resolve = () => {
    const packet = this.#packet
    if (!packet || this.#state.status === "retired") return
    if (
      this.#resolvedPacket === packet &&
      [...this.#dependencies].every(([id, descriptor]) => this.#descriptors.get(id) === descriptor)
    )
      return
    this.#resolvedPacket = packet
    this.#dependencies = new Map()
    const { hierarchy: serialized, ...lease } = packet
    Object.freeze(lease)
    if (
      packet.attached !== true ||
      packet.complete !== true ||
      packet.metadataOnly !== true ||
      typeof packet.error !== "string" ||
      packet.error ||
      typeof packet.mountRevision !== "string" ||
      !packet.mountRevision
    ) {
      this.#publish(
        "rejected",
        null,
        lease,
        typeof packet.error === "string" && packet.error ? packet.error : "incomplete-collection-commit",
      )
      return
    }
    try {
      const hierarchy = parseHierarchy(serialized, this.#root.target)
      this.#dependencies = new Map(
        hierarchy.map((entry) => [entry.descriptorId, this.#descriptors.get(entry.descriptorId)]),
      )
      const collection = createNativeCollectionSnapshot(hierarchy, this.#descriptors, this.#previous)
      this.#previous = collection
      this.#publish("confirmed", collection, lease, "")
    } catch (error) {
      const message = error instanceof Error ? error.message : "invalid-collection-commit"
      this.#publish(message === "uncommitted-descriptor" ? "pending" : "rejected", null, lease, message)
    }
  }
}
