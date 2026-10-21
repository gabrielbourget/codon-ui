/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import {
  copyNativeCollectionNodeIdentity,
  type TNativeCollectionNode,
  type TNativeCollectionSnapshot,
} from "../../../collection/snapshot"
import type { Key } from "../../../collection/state/types"

type TNode<T> = TNativeCollectionNode<T>
type TDraft<T> = { -readonly [P in keyof TNode<T>]: TNode<T>[P] }

export class ListCollection<T> implements TNativeCollectionSnapshot<T> {
  private keyMap = new Map<Key, TDraft<T>>()
  private iterable: readonly TNode<T>[]
  private firstKey: Key | null = null
  private lastKey: Key | null = null
  readonly size: number

  constructor(nodes: Iterable<TNode<T>>) {
    const clone = (input: Iterable<TNode<T>>): TNode<T>[] =>
      [...input].map((node) => {
        const children = node.type === "section" ? clone(node.childNodes ?? []) : []
        const copy = copyNativeCollectionNodeIdentity(node, {
          ...node,
          childNodes: Object.freeze(children),
          firstChildKey: children[0]?.key ?? null,
          lastChildKey: children.at(-1)?.key ?? null,
        })
        return copy
      })
    this.iterable = Object.freeze(clone(nodes))
    const visit = (node: TNode<T>) => {
      this.keyMap.set(node.key, node as TDraft<T>)
      if (node.type === "section") for (const child of node.childNodes) visit(child)
    }
    for (const node of this.iterable) visit(node)
    let last: TDraft<T> | null = null
    let index = 0
    let size = 0
    for (const node of this.keyMap.values()) {
      if (last) last.nextKey = node.key
      else this.firstKey = node.key
      node.prevKey = last?.key ?? null
      node.nextKey = null
      if (node.type === "item") node.index = index++
      if (node.type === "section" || node.type === "item") size++
      last = node
    }
    this.size = size
    this.lastKey = last?.key ?? null
    for (const node of this.keyMap.values()) Object.freeze(node)
    Object.freeze(this)
  }
  *[Symbol.iterator](): IterableIterator<TNode<T>> {
    yield* this.iterable
  }
  getKeys = (): IterableIterator<Key> => this.keyMap.keys()
  getKeyBefore = (key: Key): Key | null => this.keyMap.get(key)?.prevKey ?? null
  getKeyAfter = (key: Key): Key | null => this.keyMap.get(key)?.nextKey ?? null
  getFirstKey = (): Key | null => this.firstKey
  getLastKey = (): Key | null => this.lastKey
  getItem = (key: Key): TNode<T> | null => this.keyMap.get(key) ?? null
  at = (index: number): TNode<T> | null => this.getItem([...this.getKeys()][index])
  getChildren = (key: Key): Iterable<TNode<T>> => this.keyMap.get(key)?.childNodes ?? []
  getTextValue = (key: Key): string => this.getItem(key)?.textValue ?? ""
  filter = (predicate: (text: string, node: TNode<T>) => boolean): ListCollection<T> =>
    new ListCollection(filterComboBoxNodes(this, this, predicate))
}

export const filterComboBoxNodes = <T>(
  collection: TNativeCollectionSnapshot<T>,
  nodes: Iterable<TNode<T>>,
  predicate: (text: string, node: TNode<T>) => boolean,
): TNode<T>[] => {
  const result: TNode<T>[] = []
  for (const node of nodes) {
    if (node.type === "section" && node.hasChildNodes) {
      const children = filterComboBoxNodes(collection, collection.getChildren(node.key), predicate)
      if (children.some((child) => child.type === "item"))
        result.push(copyNativeCollectionNodeIdentity(node, { ...node, childNodes: children }))
    } else if (node.type !== "item" || predicate(node.textValue, node)) {
      result.push(copyNativeCollectionNodeIdentity(node, { ...node, childNodes: [] }))
    }
  }
  return result
}
