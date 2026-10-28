/* Copyright 2020 Adobe. Licensed under Apache-2.0; see ../LICENSE.react-aria.md. */
import type { TNativeCollectionKey } from "../snapshot"

import { NATIVE_DIRECTORY_DRAG_TYPE } from "./types"
import type { TNativeDropEvent, TNativeDropItem, TNativeDroppableCollectionProps } from "./types"

export const nativeDropItemTypes = (item: TNativeDropItem): Set<string | symbol> =>
  item.kind === "directory"
    ? new Set([NATIVE_DIRECTORY_DRAG_TYPE])
    : item.kind === "file"
      ? new Set([item.type])
      : new Set(item.types)

// Pinned useDroppableCollection default dispatch, with native data resources and
// explicit original-owner admission replacing the DOM/global collection refs.
export const dispatchNativeCollectionDrop = async (
  props: TNativeDroppableCollectionProps,
  event: TNativeDropEvent,
  isInternal: boolean,
  draggingKeys: Set<TNativeCollectionKey>,
  current: () => boolean,
) => {
  if (!current()) return
  if (props.onDrop) {
    await props.onDrop(event)
    return
  }
  const { acceptedDragTypes = "all", shouldAcceptItemDrop } = props
  const { target, items, dropOperation } = event
  const filteredItems =
    acceptedDragTypes === "all" && !shouldAcceptItemDrop
      ? items
      : items.filter((item) => {
          if (!current()) return false
          const types = nativeDropItemTypes(item)
          if (acceptedDragTypes !== "all" && !acceptedDragTypes.some((type) => types.has(type))) return false
          return (
            target.type !== "item" ||
            target.dropPosition !== "on" ||
            !shouldAcceptItemDrop ||
            (shouldAcceptItemDrop(target, types) && current())
          )
        })
  if (!current() || filteredItems.length === 0) return
  if (target.type === "root") {
    await props.onRootDrop?.({ items: filteredItems, dropOperation })
    return
  }
  if (target.dropPosition === "on" && props.onItemDrop) {
    await props.onItemDrop({ items: filteredItems, dropOperation, isInternal, target })
    if (!current()) return
  }
  if (isInternal && props.onMove) {
    await props.onMove({ keys: draggingKeys, dropOperation, target })
    if (!current()) return
  }
  if (target.dropPosition !== "on") {
    if (!isInternal && props.onInsert) {
      await props.onInsert({ items: filteredItems, dropOperation, target })
      if (!current()) return
    }
    if (isInternal && props.onReorder) await props.onReorder({ keys: draggingKeys, dropOperation, target })
  }
}
