/* Copyright Adobe. Apache-2.0; see ../LICENSE.react-aria.md. Received useDroppableCollection focus reconciliation. */
import type { TNativeCollectionKey } from "../snapshot"

import type { TNativeDragCollection, TNativeDropTarget } from "./types"
import type { TNativeDroppableCollectionState } from "./useNativeDroppableCollectionState"

export type TNativeDropFocusSnapshot = {
  collection: TNativeDragCollection
  selectedKeys: Set<TNativeCollectionKey>
  focusedKey: TNativeCollectionKey | null
  target: TNativeDropTarget
  draggingKeys: Set<TNativeCollectionKey>
  isInternal: boolean
}
export const captureNativeDropFocus = (
  state: TNativeDroppableCollectionState,
  target: TNativeDropTarget,
  isInternal: boolean,
  draggingKeys: Set<TNativeCollectionKey>,
): TNativeDropFocusSnapshot => ({
  collection: state.collection,
  selectedKeys: new Set(state.selectionManager.selectedKeys),
  focusedKey: state.selectionManager.focusedKey,
  target,
  draggingKeys: new Set(draggingKeys),
  isInternal,
})
export const reconcileNativeDropFocus = (
  previous: TNativeDropFocusSnapshot,
  state: TNativeDroppableCollectionState,
) => {
  const { collection, selectionManager: manager } = state
  const { target, collection: before, selectedKeys, focusedKey, isInternal, draggingKeys } = previous
  const focusedParent = focusedKey != null ? collection.getItem(focusedKey)?.parentKey : null
  if (collection.size > before.size && manager.isSelectionEqual(selectedKeys)) {
    const added = new Set<TNativeCollectionKey>(),
      visited = new Set<TNativeCollectionKey>()
    for (let key = collection.getFirstKey(); key != null && !visited.has(key); ) {
      visited.add(key)
      const node = collection.getItem(key)
      if (node?.type === "item" && !before.getItem(key)) added.add(key)
      key =
        node?.hasChildNodes && collection.getItem(node.lastChildKey!)?.type === "item"
          ? (node.firstChildKey ?? null)
          : collection.getKeyAfter(key)
    }
    manager.setSelectedKeys(added)
    if (manager.focusedKey === focusedKey) {
      let first: TNativeCollectionKey | null = added.values().next().value ?? null
      if (first != null) {
        const node = collection.getItem(first)
        const expanded = (collection as TNativeDragCollection & { expandedKeys?: ReadonlySet<TNativeCollectionKey> })
          .expandedKeys
        if (
          node &&
          (node.type === "cell" ||
            (target.type === "item" && target.dropPosition === "on" && !expanded?.has(node.parentKey!)))
        )
          first = node.parentKey ?? null
        if (first != null) manager.setFocusedKey(first)
      }
    }
  } else if (
    focusedKey != null &&
    manager.focusedKey === focusedKey &&
    isInternal &&
    target.type === "item" &&
    target.dropPosition !== "on" &&
    focusedParent != null &&
    draggingKeys.has(focusedParent)
  ) {
    manager.setFocusedKey(collection.getItem(focusedKey)?.parentKey ?? null)
  } else if (
    manager.focusedKey === focusedKey &&
    target.type === "item" &&
    target.dropPosition === "on" &&
    collection.getItem(target.key)
  ) {
    manager.setFocusedKey(target.key)
  }
  manager.setFocused(true)
  return manager.focusedKey
}
