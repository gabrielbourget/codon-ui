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

import type { RefObject } from "react"
import type { View } from "react-native"

import type { TNativeCollectionLayoutDelegate as LayoutDelegate } from "../renderer"
import type { TNativeCollectionKey as Key } from "../snapshot"
import type { Collection, Node } from "../state/types"

import type { TNativeDropKeyboardDelegate as KeyboardDelegate } from "./keyboardNavigation"
type Direction = "ltr" | "rtl"
type Orientation = "horizontal" | "vertical"
type DisabledBehavior = "selection" | "all"
type Rect = { x: number; y: number; width: number; height: number }

interface TNativeListKeyboardDelegateOptions<T> {
  collection: Collection<Node<T>>
  ref: RefObject<View | null>
  collator?: Intl.Collator
  layout?: "stack" | "grid"
  orientation?: Orientation
  direction?: Direction
  disabledKeys?: Set<Key>
  disabledBehavior?: DisabledBehavior
  layoutDelegate: LayoutDelegate
  isScrollable: () => boolean
}

export class NativeListKeyboardDelegate<T> implements KeyboardDelegate {
  private collection: Collection<Node<T>>
  private disabledKeys: Set<Key>
  private disabledBehavior: DisabledBehavior
  private ref: RefObject<View | null>
  private collator: Intl.Collator | undefined
  private layout: "stack" | "grid"
  private orientation?: Orientation
  private direction?: Direction
  private layoutDelegate: LayoutDelegate

  private isScrollable: () => boolean
  constructor(opts: TNativeListKeyboardDelegateOptions<T>) {
    this.collection = opts.collection
    this.ref = opts.ref
    this.collator = opts.collator
    this.disabledKeys = opts.disabledKeys || new Set()
    this.disabledBehavior = opts.disabledBehavior || "all"
    this.orientation = opts.orientation || "vertical"
    this.direction = opts.direction
    this.layout = opts.layout || "stack"
    this.layoutDelegate = opts.layoutDelegate
    this.isScrollable = opts.isScrollable

    // If this is a vertical stack, remove the left/right methods completely
    // so they aren't called by useDroppableCollection.
    if (this.layout === "stack" && this.orientation === "vertical") {
      this.getKeyLeftOf = undefined
      this.getKeyRightOf = undefined
    }
  }

  private isDisabled(item: Node<unknown>) {
    return this.disabledBehavior === "all" && (item.props?.isDisabled || this.disabledKeys.has(item.key))
  }

  private findNextNonDisabled(key: Key | null, getNext: (key: Key) => Key | null): Key | null {
    let nextKey = key
    while (nextKey != null) {
      const item = this.collection.getItem(nextKey)
      if (item?.type === "item" && !this.isDisabled(item)) {
        return nextKey
      }

      nextKey = getNext(nextKey)
    }

    return null
  }

  getNextKey(key: Key): Key | null {
    let nextKey: Key | null = key
    nextKey = this.collection.getKeyAfter(nextKey)
    return this.findNextNonDisabled(nextKey, (key) => this.collection.getKeyAfter(key))
  }

  getPreviousKey(key: Key): Key | null {
    let nextKey: Key | null = key
    nextKey = this.collection.getKeyBefore(nextKey)
    return this.findNextNonDisabled(nextKey, (key) => this.collection.getKeyBefore(key))
  }

  private findKey(
    key: Key,
    nextKey: (key: Key) => Key | null,
    shouldSkip: (prevRect: Rect, itemRect: Rect) => boolean,
  ) {
    let tempKey: Key | null = key
    let itemRect = this.layoutDelegate.getItemRect(tempKey)
    if (!itemRect || tempKey == null) {
      return null
    }

    // Find the item above or below in the same column.
    const prevRect = itemRect
    do {
      tempKey = nextKey(tempKey)
      if (tempKey == null) {
        break
      }
      itemRect = this.layoutDelegate.getItemRect(tempKey)
    } while (itemRect && shouldSkip(prevRect, itemRect) && tempKey != null)

    return tempKey
  }

  private isSameRow(prevRect: Rect, itemRect: Rect) {
    return prevRect.y === itemRect.y || prevRect.x !== itemRect.x
  }

  private isSameColumn(prevRect: Rect, itemRect: Rect) {
    return prevRect.x === itemRect.x || prevRect.y !== itemRect.y
  }

  getKeyBelow(key: Key): Key | null {
    if (this.layout === "grid" && this.orientation === "vertical") {
      return this.findKey(key, (key) => this.getNextKey(key), this.isSameRow)
    } else {
      return this.getNextKey(key)
    }
  }

  getKeyAbove(key: Key): Key | null {
    if (this.layout === "grid" && this.orientation === "vertical") {
      return this.findKey(key, (key) => this.getPreviousKey(key), this.isSameRow)
    } else {
      return this.getPreviousKey(key)
    }
  }

  private getNextColumn(key: Key, right: boolean) {
    return right ? this.getPreviousKey(key) : this.getNextKey(key)
  }

  getKeyRightOf?(key: Key): Key | null {
    // This is a temporary solution for CardView until we refactor useSelectableCollection.
    // https://github.com/orgs/adobe/projects/19/views/32?pane=issue&itemId=77825042
    const layoutDelegateMethod = this.direction === "ltr" ? "getKeyRightOf" : "getKeyLeftOf"
    if (this.layoutDelegate[layoutDelegateMethod]) {
      const next = this.layoutDelegate[layoutDelegateMethod]!(key)
      return this.findNextNonDisabled(next, (key) => this.layoutDelegate[layoutDelegateMethod]!(key))
    }

    if (this.layout === "grid") {
      if (this.orientation === "vertical") {
        return this.getNextColumn(key, this.direction === "rtl")
      } else {
        return this.findKey(key, (key) => this.getNextColumn(key, this.direction === "rtl"), this.isSameColumn)
      }
    } else if (this.orientation === "horizontal") {
      return this.getNextColumn(key, this.direction === "rtl")
    }

    return null
  }

  getKeyLeftOf?(key: Key): Key | null {
    const layoutDelegateMethod = this.direction === "ltr" ? "getKeyLeftOf" : "getKeyRightOf"
    if (this.layoutDelegate[layoutDelegateMethod]) {
      const next = this.layoutDelegate[layoutDelegateMethod]!(key)
      return this.findNextNonDisabled(next, (key) => this.layoutDelegate[layoutDelegateMethod]!(key))
    }

    if (this.layout === "grid") {
      if (this.orientation === "vertical") {
        return this.getNextColumn(key, this.direction === "ltr")
      } else {
        return this.findKey(key, (key) => this.getNextColumn(key, this.direction === "ltr"), this.isSameColumn)
      }
    } else if (this.orientation === "horizontal") {
      return this.getNextColumn(key, this.direction === "ltr")
    }

    return null
  }

  getFirstKey(): Key | null {
    const key = this.collection.getFirstKey()
    return this.findNextNonDisabled(key, (key) => this.collection.getKeyAfter(key))
  }

  getLastKey(): Key | null {
    const key = this.collection.getLastKey()
    return this.findNextNonDisabled(key, (key) => this.collection.getKeyBefore(key))
  }

  getKeyPageAbove(key: Key): Key | null {
    const menu = this.ref.current
    let itemRect = this.layoutDelegate.getItemRect(key)
    if (!itemRect) {
      return null
    }

    if (menu && !this.isScrollable()) {
      return this.getFirstKey()
    }

    let nextKey: Key | null = key
    if (this.orientation === "horizontal") {
      const pageX = Math.max(0, itemRect.x + itemRect.width - this.layoutDelegate.getVisibleRect().width)

      while (itemRect && itemRect.x > pageX && nextKey != null) {
        nextKey = this.getKeyAbove(nextKey)
        itemRect = nextKey == null ? null : this.layoutDelegate.getItemRect(nextKey)
      }
    } else {
      const pageY = Math.max(0, itemRect.y + itemRect.height - this.layoutDelegate.getVisibleRect().height)

      while (itemRect && itemRect.y > pageY && nextKey != null) {
        nextKey = this.getKeyAbove(nextKey)
        itemRect = nextKey == null ? null : this.layoutDelegate.getItemRect(nextKey)
      }
    }

    return nextKey ?? this.getFirstKey()
  }

  getKeyPageBelow(key: Key): Key | null {
    const menu = this.ref.current
    let itemRect = this.layoutDelegate.getItemRect(key)
    if (!itemRect) {
      return null
    }

    if (menu && !this.isScrollable()) {
      return this.getLastKey()
    }

    let nextKey: Key | null = key
    if (this.orientation === "horizontal") {
      const pageX = Math.min(
        this.layoutDelegate.getContentSize().width,
        itemRect.x - itemRect.width + this.layoutDelegate.getVisibleRect().width,
      )

      while (itemRect && itemRect.x < pageX && nextKey != null) {
        nextKey = this.getKeyBelow(nextKey)
        itemRect = nextKey == null ? null : this.layoutDelegate.getItemRect(nextKey)
      }
    } else {
      const pageY = Math.min(
        this.layoutDelegate.getContentSize().height,
        itemRect.y - itemRect.height + this.layoutDelegate.getVisibleRect().height,
      )

      while (itemRect && itemRect.y < pageY && nextKey != null) {
        nextKey = this.getKeyBelow(nextKey)
        itemRect = nextKey == null ? null : this.layoutDelegate.getItemRect(nextKey)
      }
    }

    return nextKey ?? this.getLastKey()
  }

  getKeyForSearch(search: string, fromKey?: Key): Key | null {
    if (!this.collator) {
      return null
    }

    const collection = this.collection
    let key = fromKey || this.getFirstKey()
    while (key != null) {
      const item = collection.getItem(key)
      if (!item) {
        return null
      }
      const substring = item.textValue.slice(0, search.length)
      if (item.textValue && this.collator.compare(substring, search) === 0) {
        return key
      }

      key = this.getNextKey(key)
    }

    return null
  }
}
