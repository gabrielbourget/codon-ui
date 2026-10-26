/* Copyright 2020 Adobe. Apache-2.0; see ../../../collection/LICENSE.react-aria.md. */
import { useEffect, useMemo, useRef } from "react"

import type { TNativeCollectionKey, TNativeCollectionNode } from "../../../collection/snapshot"
import { SelectionManager } from "../../../collection/state/SelectionManager"
import type { MultipleSelectionStateProps } from "../../../collection/state/useMultipleSelectionState"

import type { NativeTableCollection } from "./TableCollection"

type TSelection = SelectionManager["state"]
type TOptions<T> = MultipleSelectionStateProps & {
  collection: NativeTableCollection<T>
  selectionState: TSelection
  focusMode?: "row" | "cell"
}
type TGridState<T> = {
  collection: NativeTableCollection<T>
  disabledKeys: Set<TNativeCollectionKey>
  selectionManager: SelectionManager
  isKeyboardNavigationDisabled: boolean
}

// Complete pinned grid focus/retirement algorithm, using the existing native
// selection state and original committed table nodes.
export const useNativeTableGridState = <T>(props: TOptions<T>): TGridState<T> => {
  const { collection, selectionState, focusMode } = props
  const disabledKeys = useMemo(() => new Set<TNativeCollectionKey>(props.disabledKeys), [props.disabledKeys])
  const setFocusedKey = selectionState.setFocusedKey
  selectionState.setFocusedKey = (key, child) => {
    const row = key != null ? collection.getItem(key) : null
    if (focusMode === "cell" && row?.type === "item") {
      const children = [...collection.getChildren(row.key)]
      key = (child === "last" ? children.at(-1) : children[0])?.key ?? null
    }
    setFocusedKey(key, child)
  }
  const selectionManager = useMemo(() => new SelectionManager(collection, selectionState), [collection, selectionState])
  const previous = useRef<NativeTableCollection<T> | null>(null)
  useEffect(() => {
    if (selectionState.focusedKey != null && previous.current && !collection.getItem(selectionState.focusedKey)) {
      const node = previous.current.getItem(selectionState.focusedKey)
      const parent =
        node?.parentKey != null && ["cell", "rowheader", "column"].includes(node.type)
          ? previous.current.getItem(node.parentKey)
          : node
      if (!parent) {
        selectionState.setFocusedKey(null)
        return
      }
      const difference = previous.current.rows.length - collection.rows.length
      let index = Math.min(
        difference > 1 ? Math.max(parent.index - difference + 1, 0) : parent.index,
        collection.rows.length - 1,
      )
      let next: TNativeCollectionNode<T> | null = null
      while (index >= 0) {
        if (!selectionManager.isDisabled(collection.rows[index].key) && collection.rows[index].type !== "headerrow") {
          next = collection.rows[index]
          break
        }
        if (index < collection.rows.length - 1) index++
        else {
          if (index > parent.index) index = parent.index
          index--
        }
      }
      const children = next?.hasChildNodes ? [...collection.getChildren(next.key)] : []
      selectionState.setFocusedKey(
        next
          ? next.hasChildNodes && parent !== node && node && node.index < children.length
            ? children[node.index].key
            : next.key
          : null,
      )
    }
    previous.current = collection
  }, [collection, selectionManager, selectionState, selectionState.focusedKey])
  return { collection, disabledKeys, selectionManager, isKeyboardNavigationDisabled: false }
}
