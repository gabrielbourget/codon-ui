/* Copyright 2022 Adobe. Licensed under Apache-2.0; see LICENSE.react-aria.md. */
import {
  cloneElement,
  createContext,
  isValidElement,
  useMemo,
  type ComponentType,
  type ReactNode,
  type RefObject,
} from "react"
import type { ScrollView, ScrollViewProps, VirtualizedList } from "react-native"

import { encodeCollectionKey } from "../components/collection"
import type { TNativeFocusEvent, TNativeFocusViewProps } from "../input/types"

import { useNativeCachedChildren } from "./cachedChildren"
import type { TNativeCollectionKey, TNativeCollectionNode, TNativeCollectionSnapshot } from "./snapshot"
import type { LayoutDelegate } from "./state/types"

export type TNativeCollectionRect = Readonly<{ x: number; y: number; width: number; height: number }>
export type TNativeCollectionItemDropTarget = Readonly<{
  type: "item"
  key: TNativeCollectionKey
  dropPosition: "before" | "on" | "after"
}>
export type TNativeCollectionDropTarget = TNativeCollectionItemDropTarget | Readonly<{ type: "root" }>
export type TNativeCollectionLayoutDelegate = LayoutDelegate & {
  getItemRect?: (key: TNativeCollectionKey) => TNativeCollectionRect | null
  getVisibleRect?: () => TNativeCollectionRect
  requestRendering?: (key: TNativeCollectionKey) => void
  scrollToKey?: (key: TNativeCollectionKey) => void | Promise<void>
}
type TScrollViewHost = Pick<ScrollView, "getScrollableNode" | "getNativeScrollRef">
type TVirtualizedScrollHost = Pick<
  VirtualizedList<unknown>,
  "getScrollRef" | "getScrollResponder" | "scrollToIndex" | "scrollToOffset"
>
export type TNativeCollectionScrollHost = Partial<
  TScrollViewHost & TVirtualizedScrollHost & Pick<ScrollView, "scrollTo">
> &
  (TScrollViewHost | TVirtualizedScrollHost)
export type TNativeCollectionRootProps = Omit<TNativeFocusViewProps, "children"> & {
  collection: TNativeCollectionSnapshot<unknown>
  persistedKeys?: Set<TNativeCollectionKey> | null
  scrollRef?: RefObject<TNativeCollectionScrollHost | null>
  renderDropIndicator?: (target: TNativeCollectionItemDropTarget) => ReactNode
  onScroll?: ScrollViewProps["onScroll"]
}
export type TNativeCollectionBranchProps = Pick<TNativeCollectionRootProps, "collection" | "renderDropIndicator"> & {
  parent: TNativeCollectionNode<unknown>
}
export type TNativeCollectionRenderer = {
  isVirtualized?: boolean
  layoutDelegate?: TNativeCollectionLayoutDelegate
  dropTargetDelegate?: {
    getDropTargetFromPoint: (
      x: number,
      y: number,
      isValidDropTarget?: (target: TNativeCollectionDropTarget) => boolean,
    ) => TNativeCollectionDropTarget | null
  }
  CollectionRoot: ComponentType<TNativeCollectionRootProps>
  CollectionBranch: ComponentType<TNativeCollectionBranchProps>
}

// Adapted from pinned RAC 1.17.0 Collection.tsx. Native scroll hosts and coordinates replace DOM objects.
export const renderNativeAfterDropIndicators = (
  collection: TNativeCollectionSnapshot<unknown>,
  node: TNativeCollectionNode<unknown>,
  renderDropIndicator: NonNullable<TNativeCollectionRootProps["renderDropIndicator"]>,
) => {
  let keyAfter = collection.getKeyAfter(node.key)
  let next = keyAfter != null ? collection.getItem(keyAfter) : null
  while (next != null && next.type !== "item") {
    keyAfter = collection.getKeyAfter(next.key)
    next = keyAfter != null ? collection.getItem(keyAfter) : null
  }
  let sibling = node.nextKey != null ? collection.getItem(node.nextKey) : null
  while (sibling != null && sibling.type !== "item")
    sibling = sibling.nextKey != null ? collection.getItem(sibling.nextKey) : null
  const indicators: ReactNode[] = []
  if (sibling == null) {
    let current: TNativeCollectionNode<unknown> | null = node
    while (
      current?.type === "item" &&
      (!next || (current.parentKey !== next.parentKey && next.level < current.level))
    ) {
      const indicator = renderDropIndicator({ type: "item", key: current.key, dropPosition: "after" })
      if (isValidElement(indicator)) indicators.push(cloneElement(indicator, { key: `${current.key}-after` }))
      current = current.parentKey != null ? collection.getItem(current.parentKey) : null
    }
  }
  return indicators
}
const useCollectionRender = (
  collection: TNativeCollectionSnapshot<unknown>,
  parent: TNativeCollectionNode<unknown> | null,
  renderDropIndicator?: TNativeCollectionRootProps["renderDropIndicator"],
) =>
  useNativeCachedChildren({
    items: parent ? collection.getChildren(parent.key) : collection,
    dependencies: [renderDropIndicator],
    getReactKey: encodeCollectionKey,
    children: (node) => {
      if (node.type === "content") return <></>
      const rendered = node.render?.(node)
      if (!renderDropIndicator || node.type !== "item") return rendered
      return (
        <>
          {renderDropIndicator({ type: "item", key: node.key, dropPosition: "before" })}
          {rendered}
          {renderNativeAfterDropIndicators(collection, node, renderDropIndicator)}
        </>
      )
    },
  })
export const DefaultNativeCollectionRenderer: TNativeCollectionRenderer = {
  CollectionRoot: ({ collection, renderDropIndicator }) => useCollectionRender(collection, null, renderDropIndicator),
  CollectionBranch: ({ collection, parent, renderDropIndicator }) =>
    useCollectionRender(collection, parent, renderDropIndicator),
}
export const NativeCollectionRendererContext = createContext(DefaultNativeCollectionRenderer)
export const NativeCollectionCellFocusContext = createContext<((event: TNativeFocusEvent) => void) | null>(null)
export const useNativePersistedKeys = (
  focusedKey: TNativeCollectionKey | null,
  requestedKey?: TNativeCollectionKey | null,
  observedKey?: TNativeCollectionKey | null,
): Set<TNativeCollectionKey> | null =>
  useMemo(
    () =>
      focusedKey == null && requestedKey == null && observedKey == null
        ? null
        : new Set([focusedKey, requestedKey, observedKey].filter((key): key is TNativeCollectionKey => key != null)),
    [focusedKey, requestedKey, observedKey],
  )
