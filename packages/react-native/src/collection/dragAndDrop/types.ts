/* Copyright 2020 Adobe. Licensed under Apache-2.0; see ../LICENSE.react-aria.md. */
import type { ReactElement, RefObject } from "react"
import type { View } from "react-native"

import type { TNativeCollectionKey } from "../snapshot"
import type { SelectionManager } from "../state/SelectionManager"
import type { Collection, Node, TSourceManagerSurface } from "../state/types"

export const AVAILABLE_NATIVE_DROP_OPERATIONS = ["copy", "link", "move", "cancel"] as const
export type TNativeDropOperation = (typeof AVAILABLE_NATIVE_DROP_OPERATIONS)[number]
export const NATIVE_DIRECTORY_DRAG_TYPE = Symbol("codon-ui.native-directory-drag-type")
export type TNativeDragItem = Record<string, string>
export type TNativeItemDropTarget = { type: "item"; key: TNativeCollectionKey; dropPosition: "on" | "before" | "after" }
export type TNativeDropTarget = TNativeItemDropTarget | { type: "root" }
export type TNativeDragTypes = { has(type: string | symbol): boolean }
export type TNativeDragPoint = { x: number; y: number }
export type TNativeDragStartEvent = TNativeDragPoint & { type: "dragstart" }
export type TNativeDragMoveEvent = TNativeDragPoint & { type: "dragmove" }
export type TNativeDragEndEvent = TNativeDragPoint & { type: "dragend"; dropOperation: TNativeDropOperation }
export type TNativeDraggableCollectionStartEvent = TNativeDragStartEvent & { keys: Set<TNativeCollectionKey> }
export type TNativeDraggableCollectionMoveEvent = TNativeDragMoveEvent & { keys: Set<TNativeCollectionKey> }
export type TNativeDraggableCollectionEndEvent = TNativeDragEndEvent & {
  keys: Set<TNativeCollectionKey>
  isInternal: boolean
}
export type TNativeDropEnterEvent = TNativeDragPoint & { type: "dropenter"; target: TNativeDropTarget }
export type TNativeDropMoveEvent = TNativeDragPoint & { type: "dropmove"; target: TNativeDropTarget }
export type TNativeDropActivateEvent = TNativeDragPoint & { type: "dropactivate"; target: TNativeDropTarget }
export type TNativeDropExitEvent = TNativeDragPoint & { type: "dropexit"; target: TNativeDropTarget }

export type TNativeDropResource = { release: () => void }
export type TNativeReadOnlyFile = Blob &
  TNativeDropResource &
  Readonly<{
    name: string
    lastModified?: number
    uri?: string
  }>
export type TNativeTextDropItem = TNativeDropResource & {
  kind: "text"
  types: Set<string>
  getText: (type: string) => Promise<string>
}
export type TNativeFileDropItem = TNativeDropResource & {
  kind: "file"
  type: string
  name: string
  getFile: () => Promise<TNativeReadOnlyFile>
  getText: () => Promise<string>
}
export type TNativeDirectoryDropItem = TNativeDropResource & {
  kind: "directory"
  name: string
  getEntries: () => AsyncIterable<TNativeFileDropItem | TNativeDirectoryDropItem>
}
export type TNativeDropItem = TNativeTextDropItem | TNativeFileDropItem | TNativeDirectoryDropItem
export type TNativeDropEvent = TNativeDragPoint & {
  type: "drop"
  target: TNativeDropTarget
  dropOperation: TNativeDropOperation
  items: TNativeDropItem[]
}
export type TNativeInsertDropEvent = {
  items: TNativeDropItem[]
  dropOperation: TNativeDropOperation
  target: TNativeItemDropTarget
}
export type TNativeRootDropEvent = Pick<TNativeInsertDropEvent, "items" | "dropOperation">
export type TNativeOnItemDropEvent = TNativeInsertDropEvent & { isInternal: boolean }
export type TNativeReorderDropEvent = {
  keys: Set<TNativeCollectionKey>
  dropOperation: TNativeDropOperation
  target: TNativeItemDropTarget
}
export type TNativeDragPreviewRenderer = (
  items: TNativeDragItem[],
  callback: (node: View | null, x?: number, y?: number) => void,
) => void
export type TNativeDragPreviewContent = ReactElement | { element: ReactElement; x: number; y: number }
export type TNativeDropTargetDelegate = {
  getDropTargetFromPoint: (
    x: number,
    y: number,
    isValidDropTarget: (target: TNativeDropTarget) => boolean,
  ) => TNativeDropTarget | null
}
export type TNativeDraggableCollectionProps<T = object> = {
  onDragStart?: (event: TNativeDraggableCollectionStartEvent) => void
  onDragMove?: (event: TNativeDraggableCollectionMoveEvent) => void
  onDragEnd?: (event: TNativeDraggableCollectionEndEvent) => void
  getItems: (keys: Set<TNativeCollectionKey>, items: T[]) => TNativeDragItem[]
  preview?: RefObject<TNativeDragPreviewRenderer | null>
  getAllowedDropOperations?: () => TNativeDropOperation[]
}
export type TNativeDroppableCollectionProps = {
  acceptedDragTypes?: "all" | Array<string | symbol>
  onInsert?: (event: TNativeInsertDropEvent) => void | Promise<void>
  onRootDrop?: (event: TNativeRootDropEvent) => void | Promise<void>
  onItemDrop?: (event: TNativeOnItemDropEvent) => void | Promise<void>
  onReorder?: (event: TNativeReorderDropEvent) => void | Promise<void>
  onMove?: (event: TNativeReorderDropEvent) => void | Promise<void>
  shouldAcceptItemDrop?: (target: TNativeItemDropTarget, types: TNativeDragTypes) => boolean
  onDropEnter?: (event: TNativeDropEnterEvent) => void
  onDropActivate?: (event: TNativeDropActivateEvent) => void
  onDropExit?: (event: TNativeDropExitEvent) => void
  onDrop?: (event: TNativeDropEvent) => void | Promise<void>
  getDropOperation?: (
    target: TNativeDropTarget,
    types: TNativeDragTypes,
    allowedOperations: TNativeDropOperation[],
  ) => TNativeDropOperation
}
export type TNativeDragCollection = Collection<Node<unknown>>
export type TNativeDragSelectionManager = TSourceManagerSurface & Pick<SelectionManager, "select">
