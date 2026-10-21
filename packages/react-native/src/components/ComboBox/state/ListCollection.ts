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

import type { Key, Node } from "../../../collection/state/types"

import type { Collection } from "./types"

export class ListCollection<T> implements Collection<T> {
  private keyMap: Map<Key, Node<T>> = new Map()
  private iterable: Iterable<Node<T>>
  private firstKey: Key | null = null
  private lastKey: Key | null = null
  private _size: number

  constructor(nodes: Iterable<Node<T>>) {
    this.iterable = nodes

    const visit = (node: Node<T>) => {
      this.keyMap.set(node.key, node)

      if (node.childNodes && node.type === "section") {
        for (const child of node.childNodes) {
          visit(child)
        }
      }
    }

    for (const node of nodes) {
      visit(node)
    }

    let last: Node<T> | null = null
    let index = 0
    let size = 0
    for (const [key, node] of this.keyMap) {
      if (last) {
        last.nextKey = key
        node.prevKey = last.key
      } else {
        this.firstKey = key
        node.prevKey = undefined
      }

      if (node.type === "item") {
        node.index = index++
      }

      // Only count sections and items when determining size so that
      // loaders and separators in RAC/S2 don't influence the emptyState determination
      if (node.type === "section" || node.type === "item") {
        size++
      }

      last = node

      // Set nextKey as undefined since this might be the last node
      // If it isn't the last node, last.nextKey will properly set at start of new loop
      last.nextKey = undefined
    }
    this._size = size
    this.lastKey = last?.key ?? null
    // Filtering owns these clones; caller item values and props retain their original identities.
    for (const node of this.keyMap.values()) {
      if (Array.isArray(node.childNodes)) Object.freeze(node.childNodes)
      Object.freeze(node)
    }
    if (Array.isArray(this.iterable)) Object.freeze(this.iterable)
    Object.freeze(this)
  }

  *[Symbol.iterator](): IterableIterator<Node<T>> {
    yield* this.iterable
  }

  get size(): number {
    return this._size
  }

  getKeys(): IterableIterator<Key> {
    return this.keyMap.keys()
  }

  getKeyBefore(key: Key): Key | null {
    const node = this.keyMap.get(key)
    return node ? (node.prevKey ?? null) : null
  }

  getKeyAfter(key: Key): Key | null {
    const node = this.keyMap.get(key)
    return node ? (node.nextKey ?? null) : null
  }

  getFirstKey(): Key | null {
    return this.firstKey
  }

  getLastKey(): Key | null {
    return this.lastKey
  }

  getItem(key: Key): Node<T> | null {
    return this.keyMap.get(key) ?? null
  }

  at(idx: number): Node<T> | null {
    const keys = [...this.getKeys()]
    return this.getItem(keys[idx])
  }

  getChildren(key: Key): Iterable<Node<T>> {
    const node = this.keyMap.get(key)
    return node?.childNodes || []
  }
}
