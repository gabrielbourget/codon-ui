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

import { useRef, useState } from "react"
import type { RefObject } from "react"

import type { TNativeCollectionKey as Key } from "../snapshot"

import { registerNativeDragStateRetirement } from "./retirement"
import type {
  TNativeDragCollection as Collection,
  TNativeDraggableCollectionEndEvent as DraggableCollectionEndEvent,
  TNativeDraggableCollectionProps as DraggableCollectionProps,
  TNativeDragItem as DragItem,
  TNativeDragMoveEvent as DragMoveEvent,
  TNativeDragPreviewRenderer as DragPreviewRenderer,
  TNativeDragStartEvent as DragStartEvent,
  TNativeDropOperation as DropOperation,
  TNativeDragSelectionManager as MultipleSelectionManager,
} from "./types"

export interface TNativeDraggableCollectionStateOptions<T = object> extends DraggableCollectionProps<T> {
  /** A collection of items. */
  collection: Collection
  /** An interface for reading and updating multiple selection state. */
  selectionManager: MultipleSelectionManager
  /** Whether the drag events should be disabled. */
  isDisabled?: boolean
}

export interface TNativeDraggableCollectionState {
  /** A collection of items. */
  collection: Collection
  /** An interface for reading and updating multiple selection state. */
  selectionManager: MultipleSelectionManager
  /** The key of the item that initiated a drag. */
  draggedKey: Key | null
  /** The keys of the items that are currently being dragged. */
  draggingKeys: Set<Key>
  /** Whether drag events are disabled. */
  isDisabled?: boolean
  /** Returns whether the given key is currently being dragged. */
  isDragging(key: Key): boolean
  /** Returns the keys of the items that will be dragged with the given key (e.g. selected items). */
  getKeysForDrag(key: Key): Set<Key>
  /** Returns the items to drag for the given key. */
  getItems(key: Key): DragItem[]
  /** The ref of the element that will be rendered as the drag preview while dragging. */
  preview?: RefObject<DragPreviewRenderer | null>
  /** Function that returns the drop operations that are allowed for the dragged items. If not provided, all drop operations are allowed. */
  getAllowedDropOperations?: () => DropOperation[]
  /** Begins a drag for the given key. This triggers the onDragStart event. */
  startDrag(key: Key, event: DragStartEvent): void
  /** Triggers an onDragMove event. */
  moveDrag(event: DragMoveEvent): void
  /** Ends the current drag, and emits an onDragEnd event. */
  endDrag(event: DraggableCollectionEndEvent): void
}

/**
 * Manages state for a draggable collection.
 */
export const useNativeDraggableCollectionState = <T = object>(
  props: TNativeDraggableCollectionStateOptions<T>,
): TNativeDraggableCollectionState => {
  const {
    getItems,
    isDisabled,
    collection,
    selectionManager,
    onDragStart,
    onDragMove,
    onDragEnd,
    preview,
    getAllowedDropOperations,
  } = props
  const [, setDragging] = useState(false)
  const draggingKeys = useRef(new Set<Key>())
  const draggedKey = useRef<Key | null>(null)
  const getKeys = (key: Key) => {
    // The clicked item is always added to the drag. If it is selected, then all of the
    // other selected items are also dragged. If it is not selected, then only the clicked
    // item is dragged. This matches native macOS behavior.
    // Additionally, we filter out any keys that are children of any of the other selected keys
    const keys = new Set<Key>()
    if (selectionManager.isSelected(key)) {
      for (const currentKey of selectionManager.selectedKeys) {
        const node = collection.getItem(currentKey)
        if (node) {
          let isChild = false
          let parentKey = node.parentKey
          while (parentKey != null) {
            if (selectionManager.selectedKeys.has(parentKey)) {
              isChild = true
              break
            }
            const parentNode = collection.getItem(parentKey)
            parentKey = parentNode ? parentNode.parentKey : null
          }

          if (!isChild) {
            keys.add(currentKey)
          }
        }
      }
    } else {
      keys.add(key)
    }

    return keys
  }

  const state: TNativeDraggableCollectionState = {
    collection,
    selectionManager,
    get draggedKey() {
      return draggedKey.current
    },
    get draggingKeys() {
      return draggingKeys.current
    },
    isDragging(key) {
      return draggingKeys.current.has(key)
    },
    getKeysForDrag: getKeys,
    getItems(key) {
      const keys = getKeys(key)
      const items: T[] = []
      for (const key of keys) {
        const value = collection.getItem(key)?.value
        if (value != null) {
          items.push(value as T)
        }
      }

      return getItems(getKeys(key), items)
    },
    isDisabled,
    preview,
    getAllowedDropOperations,
    startDrag(key, event) {
      const keys = getKeys(key)
      draggingKeys.current = keys
      draggedKey.current = key
      selectionManager.setFocused(false)
      setDragging(true)
      if (typeof onDragStart === "function") {
        onDragStart({
          ...event,
          keys,
        })
      }
    },
    moveDrag(event) {
      if (typeof onDragMove === "function") {
        onDragMove({
          ...event,
          keys: draggingKeys.current,
        })
      }
    },
    endDrag(event) {
      const { isInternal } = event

      if (typeof onDragEnd === "function") {
        onDragEnd({
          ...event,
          keys: draggingKeys.current,
          isInternal,
        })
      }

      draggingKeys.current = new Set()
      draggedKey.current = null
      setDragging(false)
    },
  }
  registerNativeDragStateRetirement(state, () => {
    draggingKeys.current = new Set()
    draggedKey.current = null
    setDragging(false)
  })
  return state
}
