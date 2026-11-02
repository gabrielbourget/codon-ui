import { getNativeCollectionNodeIdentity, type TNativeCollectionSnapshot } from "./snapshot"

export type TNativeCollectionModelSnapshot<T> = Readonly<{
  ownerId: string
  generation: string
  revision: string
  collection: TNativeCollectionSnapshot<T>
}>
export type TNativeCollectionActionScope = Readonly<{
  ownerId: string
  generation: string
  revision: string
  itemId: string
  itemRevision: string
}>

let nextGeneration = 0
let nextRevision = 0

// Logical ownership only. Native attachment, window and original-target admission belong to the visible host adapter.
export class NativeCollectionModel<T> {
  readonly generation = `cui-collection-generation:${++nextGeneration}`
  readonly #listeners = new Set<() => void>()
  #current: TNativeCollectionModelSnapshot<T> | null = null

  constructor(readonly ownerId: string) {}

  prepare = (collection: TNativeCollectionSnapshot<T>): TNativeCollectionModelSnapshot<T> =>
    Object.freeze({
      ownerId: this.ownerId,
      generation: this.generation,
      revision: `cui-collection-revision:${++nextRevision}`,
      collection,
    })

  getSnapshot = () => this.#current
  subscribe = (listener: () => void) => {
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
    }
  }
  commit = (snapshot: TNativeCollectionModelSnapshot<T>) => {
    if (snapshot.ownerId !== this.ownerId || snapshot.generation !== this.generation)
      throw new Error("Foreign collection model")
    this.#current = snapshot
    this.#notify()
    return () => {
      if (this.#current !== snapshot) return
      this.#current = null
      this.#notify()
    }
  }
  #notify = () => {
    for (const listener of this.#listeners) listener()
  }
}

// Attach to the actual visible collection root. This explicit membership list is not a native authoring tree.
export const nativeCollectionOwnerBinding = <T>(snapshot: TNativeCollectionModelSnapshot<T>) =>
  JSON.stringify({
    ownerId: snapshot.ownerId,
    generation: snapshot.generation,
    revision: snapshot.revision,
    items: [...snapshot.collection.getKeys()].map((key) => {
      const identity = getNativeCollectionNodeIdentity(snapshot.collection.getItem(key)!)
      if (!identity) throw new Error("Collection item has no logical identity")
      return identity
    }),
  })
