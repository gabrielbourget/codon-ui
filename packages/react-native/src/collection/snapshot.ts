import type { ListState } from "react-stately/useListState"

type TSourceCollection<T> = ListState<T>["collection"]
type TSourceNode<T> = NonNullable<ReturnType<TSourceCollection<T>["getItem"]>>
export type TNativeCollectionKey = TSourceNode<unknown>["key"]

export type TNativeCollectionItem<T> = Readonly<{
  key: TNativeCollectionKey
  type: string
  value: T | null
  rendered: TSourceNode<T>["rendered"]
  textValue: string
  props: TSourceNode<T>["props"]
  render?: TSourceNode<T>["render"]
  children?: readonly TNativeCollectionItem<T>[]
  "aria-label"?: string
  colSpan?: number | null
  colIndex?: number | null
}>

export type TNativeCollectionNode<T> = Readonly<
  Omit<TSourceNode<T>, "childNodes"> & {
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
export type TNativeCollectionNodeIdentity = Readonly<{ itemId: string; itemRevision: string }>
const nodeIdentities = new WeakMap<object, TNativeCollectionNodeIdentity>()
export const getNativeCollectionNodeIdentity = (node: object): TNativeCollectionNodeIdentity | undefined =>
  nodeIdentities.get(node)
// Filtered state views retain logical identity. This never proves that a native receiver is mounted.
export const copyNativeCollectionNodeIdentity = <T extends object>(original: object, copy: T): T => {
  const identity = nodeIdentities.get(original)
  if (identity) nodeIdentities.set(copy, identity)
  return copy
}
type TNodeFields<T> = {
  -readonly [P in keyof Omit<TNativeCollectionNode<T>, "childNodes">]: TNativeCollectionNode<T>[P]
}
const ownedNode = <T>(fields: TNodeFields<T>, identity?: TNativeCollectionNodeIdentity): TNativeCollectionNode<T> => {
  const node = Object.freeze(
    Object.defineProperty(fields, "childNodes", {
      get: () => {
        throw new Error("childNodes is not supported")
      },
    }),
  ) as TNativeCollectionNode<T>
  if (identity) nodeIdentities.set(node, identity)
  return node
}

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
  at = (_index: number): TNativeCollectionNode<T> | null => {
    throw new Error("Not implemented")
  }

  filter = (predicate: TFilter<T>): TNativeCollectionSnapshot<T> => {
    const membership = new Map<TNativeCollectionKey, TNodeFields<T>>()
    const identities = new Map<TNativeCollectionKey, TNativeCollectionNodeIdentity | undefined>()
    const addDescendants = (node: TNodeFields<T>) => {
      membership.set(node.key, { ...node })
      identities.set(node.key, nodeIdentities.get(node))
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
        } else if (node.type === "submenutrigger") {
          const trigger = node.firstChildKey == null ? null : this.getItem(node.firstChildKey)
          if (trigger && predicate(trigger.textValue, node)) {
            filtered = { ...node }
            addDescendants(filtered)
          }
        } else if (node.type !== "item" || predicate(node.textValue, node)) {
          filtered = { ...node }
          addDescendants(filtered)
        }
        if (filtered) {
          identities.set(filtered.key, nodeIdentities.get(node))
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
    const nodes = new Map([...membership].map(([key, fields]) => [key, ownedNode(fields, identities.get(key))]))
    return new NativeCollectionSnapshot(nodes, first, last)
  }
}

export type TNativeCollectionSnapshot<T> = Pick<NativeCollectionSnapshot<T>, keyof NativeCollectionSnapshot<T>>

let nextIdentity = 0
const sourceItems = new WeakMap<object, object>()

// The caller supplies complete ordered membership; renderers may materialize any subset.
// Constructing a candidate is pure apart from opaque identity allocation. Only a committed model may admit actions.
export const createNativeCollectionSnapshot = <T>(
  items: readonly TNativeCollectionItem<T>[],
  previous?: TNativeCollectionSnapshot<T> | null,
): TNativeCollectionSnapshot<T> => {
  const built = new Map<TNativeCollectionKey, TNativeCollectionNode<T>>()
  const keys = new Set<TNativeCollectionKey>()
  const visiting = new Set<object>()
  const buildSiblings = (
    siblings: readonly TNativeCollectionItem<T>[],
    parentKey: TNativeCollectionKey | null,
    level: number,
  ): readonly TNativeCollectionNode<T>[] => {
    if (!Array.isArray(siblings)) throw new Error("Collection items must be a complete ordered array")
    let previousSibling: TNativeCollectionNode<T> | null = null
    return siblings.map((item, index) => {
      if (!item || typeof item !== "object" || visiting.has(item)) throw new Error("Invalid collection item tree")
      if (
        (typeof item.key !== "string" && typeof item.key !== "number") ||
        (typeof item.key === "number" && !Number.isFinite(item.key)) ||
        !item.type ||
        typeof item.type !== "string" ||
        typeof item.textValue !== "string"
      )
        throw new Error("Collection items require explicit stable keys, types and text values")
      if (keys.has(item.key)) throw new Error("Duplicate collection item key")
      keys.add(item.key)
      visiting.add(item)
      const prior = previous?.getItem(item.key)
      const priorIdentity = prior && nodeIdentities.get(prior)
      const identity =
        priorIdentity && sourceItems.get(prior!) === item
          ? priorIdentity
          : Object.freeze({
              itemId: priorIdentity?.itemId ?? `cui-item:${++nextIdentity}`,
              itemRevision: `cui-item-revision:${++nextIdentity}`,
            })
      const descendants = buildSiblings(item.children ?? [], item.key, level + (item.type === "item" ? 1 : 0))
      visiting.delete(item)
      const { children: _children, ...content } = item
      const node = ownedNode<T>(
        {
          ...content,
          "aria-label": item["aria-label"] || prior?.["aria-label"],
          level,
          index,
          parentKey,
          prevKey: siblings[index - 1]?.key ?? null,
          nextKey: siblings[index + 1]?.key ?? null,
          hasChildNodes: descendants.length > 0,
          firstChildKey: descendants[0]?.key ?? null,
          lastChildKey: descendants.at(-1)?.key ?? null,
          colSpan: item.colSpan ?? prior?.colSpan ?? null,
          colIndex:
            previousSibling && (previousSibling.colSpan != null || previousSibling.colIndex != null)
              ? (previousSibling.colIndex ?? previousSibling.index) + (previousSibling.colSpan ?? 1)
              : (item.colIndex ?? prior?.colIndex ?? null),
        },
        identity,
      )
      sourceItems.set(node, item)
      built.set(node.key, node)
      previousSibling = node
      return node
    })
  }
  const roots = buildSiblings(items, null, 0)
  const membership = new Map<TNativeCollectionKey, TNativeCollectionNode<T>>()
  // Keep source lookup insertion history independently of current linked navigation order.
  if (previous)
    for (const key of previous.getKeys()) {
      const node = built.get(key)
      if (node) membership.set(key, node)
    }
  for (const [key, node] of built) if (!membership.has(key)) membership.set(key, node)
  return new NativeCollectionSnapshot(membership, roots[0]?.key ?? null, roots.at(-1)?.key ?? null)
}
