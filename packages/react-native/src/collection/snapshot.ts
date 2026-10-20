import type { ListState } from "react-stately/useListState"

type TSourceCollection<T> = ListState<T>["collection"]
type TSourceNode<T> = NonNullable<ReturnType<TSourceCollection<T>["getItem"]>>
export type TNativeCollectionKey = TSourceNode<unknown>["key"]

export type TNativeCollectionDescriptor<T> = Readonly<{
  descriptorId: string
  descriptorRevision: string
  key: TNativeCollectionKey
  type: string
  value: T | null
  rendered: TSourceNode<T>["rendered"]
  textValue: string
  props: TSourceNode<T>["props"]
  render?: TSourceNode<T>["render"]
  "aria-label"?: string
  colSpan?: number | null
  colIndex?: number | null
}>

export type TNativeCollectionHierarchyEntry = Readonly<{
  descriptorId: string
  descriptorRevision: string
  parentDescriptorId: string
  target: number
  index: number
  retainedIndex: number
  hasRetainedChildren: boolean
}>

export type TNativeCollectionNode<T> = Readonly<
  Omit<TSourceNode<T>, "childNodes"> & {
    descriptorId: string
    descriptorRevision: string
    metadataTarget: number
    parentKey: TNativeCollectionKey | null
    prevKey: TNativeCollectionKey | null
    nextKey: TNativeCollectionKey | null
    firstChildKey: TNativeCollectionKey | null
    lastChildKey: TNativeCollectionKey | null
    childNodes: Iterable<TNativeCollectionNode<T>>
    colSpan: number | null
    colIndex: number | null
  }
>

type TFilter<T> = (textValue: string, node: TSourceNode<T>) => boolean
type TNodeFields<T> = {
  -readonly [P in keyof Omit<TNativeCollectionNode<T>, "childNodes">]: TNativeCollectionNode<T>[P]
}
const ownedNode = <T>(fields: TNodeFields<T>): TNativeCollectionNode<T> =>
  Object.freeze(
    Object.defineProperty(fields, "childNodes", {
      get: () => {
        throw new Error("childNodes is not supported")
      },
    }),
  ) as TNativeCollectionNode<T>

// Navigation follows react-aria 3.48.0 collections/BaseCollection (Apache-2.0, Copyright 2024 Adobe).
// The owned shell is immutable; caller values, props, renderers and refs retain their original identities.
class NativeCollectionSnapshot<T> implements TSourceCollection<T> {
  readonly #nodes: ReadonlyMap<TNativeCollectionKey, TNativeCollectionNode<T>>
  readonly #firstKey: TNativeCollectionKey | null
  readonly #lastKey: TNativeCollectionKey | null
  readonly size: number

  constructor(
    nodes: ReadonlyMap<TNativeCollectionKey, TNativeCollectionNode<T>>,
    firstKey: TNativeCollectionKey | null,
    lastKey: TNativeCollectionKey | null,
  ) {
    this.#nodes = new Map(nodes)
    this.#firstKey = firstKey
    this.#lastKey = lastKey
    this.size = [...nodes.values()].filter((node) => node.type === "item").length
    Object.freeze(this)
  }

  #siblings = (firstKey: TNativeCollectionKey | null): Iterable<TNativeCollectionNode<T>> => {
    const nodes = this.#nodes
    return {
      *[Symbol.iterator]() {
        let node = firstKey != null ? nodes.get(firstKey) : undefined
        while (node) {
          yield node
          node = node.nextKey != null ? nodes.get(node.nextKey) : undefined
        }
      },
    }
  };
  [Symbol.iterator] = (): Iterator<TNativeCollectionNode<T>> => this.#siblings(this.#firstKey)[Symbol.iterator]()
  getKeys = (): IterableIterator<TNativeCollectionKey> => this.#nodes.keys()
  getItem = (key: TNativeCollectionKey): TNativeCollectionNode<T> | null => this.#nodes.get(key) ?? null
  getChildren = (key: TNativeCollectionKey): Iterable<TNativeCollectionNode<T>> =>
    this.#siblings(this.#nodes.get(key)?.firstChildKey ?? null)
  getTextValue = (key: TNativeCollectionKey) => this.#nodes.get(key)?.textValue ?? ""
  getFirstKey = (): TNativeCollectionKey | null => this.#firstKey
  getLastKey = (): TNativeCollectionKey | null => {
    let node = this.#lastKey != null ? this.#nodes.get(this.#lastKey) : undefined
    while (node?.lastChildKey != null) node = this.#nodes.get(node.lastChildKey)
    return node?.key ?? null
  }
  getKeyBefore = (key: TNativeCollectionKey): TNativeCollectionKey | null => {
    let node = this.#nodes.get(key)
    if (!node) return null
    if (node.prevKey == null) return node.parentKey
    node = this.#nodes.get(node.prevKey)
    while (node && node.type !== "item" && node.lastChildKey != null) node = this.#nodes.get(node.lastChildKey)
    return node?.key ?? null
  }
  getKeyAfter = (key: TNativeCollectionKey): TNativeCollectionKey | null => {
    let node = this.#nodes.get(key)
    if (!node) return null
    if (node.type !== "item" && node.firstChildKey != null) return node.firstChildKey
    while (node) {
      if (node.nextKey != null) return node.nextKey
      node = node.parentKey != null ? this.#nodes.get(node.parentKey) : undefined
    }
    return null
  }
  at = (_index: number): TNativeCollectionNode<T> => {
    throw new Error("Not implemented")
  }

  filter = (predicate: TFilter<T>): NativeCollectionSnapshot<T> => {
    const membership = new Map<TNativeCollectionKey, TNodeFields<T>>()
    const addDescendants = (node: TNodeFields<T>) => {
      membership.set(node.key, { ...node })
      for (const child of this.getChildren(node.key)) addDescendants(child)
    }
    const filterSiblings = (
      firstKey: TNativeCollectionKey | null,
    ): [TNativeCollectionKey | null, TNativeCollectionKey | null] => {
      let current = firstKey != null ? this.getItem(firstKey) : null
      let first: TNodeFields<T> | null = null
      let last: TNodeFields<T> | null = null
      while (current) {
        const node = current
        let filtered: TNodeFields<T> | null = null
        if (node.type === "section") {
          const [firstChildKey, lastChildKey] = filterSiblings(node.firstChildKey)
          if (lastChildKey != null && this.getItem(lastChildKey)?.type !== "header") {
            filtered = { ...node, firstChildKey, lastChildKey }
          }
        } else if (node.type !== "item" || predicate(node.textValue, node)) {
          filtered = { ...node }
          addDescendants(filtered)
        }
        if (filtered) {
          filtered = { ...filtered, nextKey: null }
          if (last) {
            last.nextKey = filtered.key
            filtered = { ...filtered, prevKey: last.key }
          }
          if (!first) first = filtered
          membership.set(filtered.key, filtered)
          last = filtered
        }
        // Preserve the pinned source's falsy-key filter behavior, separately from null-aware navigation.
        current = current.nextKey ? this.getItem(current.nextKey) : null
      }
      if (last?.type === "separator") {
        membership.delete(last.key)
        last = last.prevKey ? (membership.get(last.prevKey) ?? null) : null
        if (last) last.nextKey = null
      }
      return [first?.key ?? null, last?.key ?? null]
    }
    const [first, last] = filterSiblings(this.#firstKey)
    const nodes = new Map([...membership].map(([key, fields]) => [key, ownedNode(fields)]))
    return new NativeCollectionSnapshot(nodes, first, last)
  }
}

export type TNativeCollectionSnapshot<T> = NativeCollectionSnapshot<T>

export const createNativeCollectionSnapshot = <T>(
  hierarchy: readonly TNativeCollectionHierarchyEntry[],
  descriptors: ReadonlyMap<string, TNativeCollectionDescriptor<T>>,
  previous?: NativeCollectionSnapshot<T> | null,
): NativeCollectionSnapshot<T> => {
  const byId = new Map<string, TNativeCollectionHierarchyEntry>()
  const children = new Map<string, TNativeCollectionHierarchyEntry[]>()
  const activeParents = [""]
  const targets = new Set<number>()
  for (const entry of hierarchy) {
    if (!entry.descriptorId || !entry.descriptorRevision || byId.has(entry.descriptorId)) {
      throw new Error("invalid-descriptor-identity")
    }
    while (activeParents.length > 0 && activeParents.at(-1) !== entry.parentDescriptorId) activeParents.pop()
    if (activeParents.length === 0) throw new Error("invalid-descriptor-preorder")
    const siblings = children.get(entry.parentDescriptorId) ?? []
    if (
      entry.index !== siblings.length ||
      !Number.isSafeInteger(entry.retainedIndex) ||
      entry.retainedIndex < entry.index ||
      (siblings.length > 0 && entry.retainedIndex <= siblings.at(-1)!.retainedIndex) ||
      typeof entry.hasRetainedChildren !== "boolean" ||
      !Number.isSafeInteger(entry.target) ||
      entry.target <= 0 ||
      targets.has(entry.target)
    ) {
      throw new Error("invalid-descriptor-position")
    }
    const descriptor = descriptors.get(entry.descriptorId)
    if (!descriptor || descriptor.descriptorRevision !== entry.descriptorRevision)
      throw new Error("uncommitted-descriptor")
    targets.add(entry.target)
    byId.set(entry.descriptorId, entry)
    siblings.push(entry)
    children.set(entry.parentDescriptorId, siblings)
    activeParents.push(entry.descriptorId)
  }
  for (const entry of hierarchy) {
    if (children.has(entry.descriptorId) && !entry.hasRetainedChildren) throw new Error("invalid-descriptor-children")
  }

  const built = new Map<TNativeCollectionKey, TNativeCollectionNode<T>>()
  const buildSiblings = (parentId: string, level: number): readonly TNativeCollectionNode<T>[] => {
    const siblings = children.get(parentId) ?? []
    let previousSibling: TNativeCollectionNode<T> | null = null
    return Object.freeze(
      siblings.map((entry, index) => {
        const descriptor = descriptors.get(entry.descriptorId)!
        const prior = previous?.getItem(descriptor.key)
        const retained = prior?.descriptorId === descriptor.descriptorId ? prior : null
        const descendants = buildSiblings(entry.descriptorId, level + (descriptor.type === "item" ? 1 : 0))
        const keyAt = (position: number) => {
          const sibling = siblings[position]
          return sibling ? descriptors.get(sibling.descriptorId)!.key : null
        }
        const node = ownedNode<T>({
          ...descriptor,
          metadataTarget: entry.target,
          level,
          index: entry.retainedIndex,
          parentKey: parentId === "" ? null : descriptors.get(parentId)!.key,
          prevKey: keyAt(index - 1),
          nextKey: keyAt(index + 1),
          hasChildNodes: entry.hasRetainedChildren,
          firstChildKey: descendants[0]?.key ?? null,
          lastChildKey: descendants.at(-1)?.key ?? null,
          colSpan: descriptor.colSpan ?? retained?.colSpan ?? null,
          colIndex:
            previousSibling && (previousSibling.colSpan != null || previousSibling.colIndex != null)
              ? (previousSibling.colIndex ?? previousSibling.index) + (previousSibling.colSpan ?? 1)
              : (descriptor.colIndex ?? retained?.colIndex ?? null),
        })
        built.set(node.key, node)
        previousSibling = node
        return node
      }),
    )
  }
  const roots = buildSiblings("", 0)
  const membership = new Map<TNativeCollectionKey, TNativeCollectionNode<T>>()
  if (previous) {
    for (const key of previous.getKeys()) {
      const node = built.get(key)
      if (node && previous.getItem(key)?.descriptorId === node.descriptorId) membership.set(key, node)
    }
  }
  for (const [key, node] of built) if (!membership.has(key)) membership.set(key, node)
  return new NativeCollectionSnapshot(membership, roots[0]?.key ?? null, roots.at(-1)?.key ?? null)
}
