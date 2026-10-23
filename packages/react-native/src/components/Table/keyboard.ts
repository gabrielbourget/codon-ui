// Adapted from react-aria 3.48.0 GridKeyboardDelegate/TableKeyboardDelegate.
// Copyright 2020, 2022 Adobe. Apache-2.0; see ../../collection/LICENSE.react-aria.md.
import type { TNativeCollectionKey, TNativeCollectionNode, TNativeCollectionSnapshot } from "../../collection/snapshot"
import type { SelectionManager } from "../../collection/state/SelectionManager"
import { nativeKeyTokens } from "../../input/keyScope"

export const NATIVE_TABLE_NAVIGATION_KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"] as const
type TNavigationKey = (typeof NATIVE_TABLE_NAVIGATION_KEYS)[number]
type TNavigation = {
  collection: TNativeCollectionSnapshot<object>
  rows: readonly TNativeCollectionNode<object>[]
  manager: SelectionManager
}

export const getNativeTableKeyTokens = (isApple: boolean) => [
  ...[...NATIVE_TABLE_NAVIGATION_KEYS, "Escape"].flatMap(nativeKeyTokens),
  ...nativeKeyTokens("a").filter((token) => token[isApple ? 3 : 2] === "1"),
]

export const getNativeTableNavigationKey = (
  table: TNavigation,
  from: TNativeCollectionKey | null,
  key: TNavigationKey,
  isRTL: boolean,
  global = false,
  wrap = false,
): TNativeCollectionKey | null => {
  const { collection, manager } = table
  const rows = table.rows.filter((row) => !manager.isDisabled(row.key))
  const node = from == null ? null : collection.getItem(from)
  const isCell = node && (node.type === "cell" || node.type === "column")
  const parent = node?.parentKey == null ? null : collection.getItem(node.parentKey)
  const children = (row: TNativeCollectionNode<object> | null | undefined) =>
    row ? Array.from(collection.getChildren(row.key)) : []
  const boundary = (last: boolean, fromCell = !!isCell && global) => {
    const row = rows[last ? rows.length - 1 : 0]
    if (!row) return null
    const cells = children(row)
    return fromCell ? (cells[last ? cells.length - 1 : 0]?.key ?? null) : row.key
  }
  const wrappedBoundary = (last: boolean) => {
    if (isCell) {
      const cells = children(parent)
      return cells[last ? cells.length - 1 : 0]?.key ?? null
    }
    return boundary(last, false)
  }
  if (key === "Home" || key === "End") {
    const last = key === "End"
    if (isCell && !global) {
      const cells = children(parent)
      return cells[last ? cells.length - 1 : 0]?.key ?? null
    }
    return boundary(last)
  }
  if (!node) return boundary(key === "ArrowUp", false)
  if (key === "ArrowLeft" || key === "ArrowRight") {
    const forward = (key === "ArrowRight") !== isRTL
    if (node.type === "item") {
      const cells = children(node)
      return cells[forward ? 0 : cells.length - 1]?.key ?? null
    }
    if (!isCell) return null
    const cells = children(parent)
    const index = cells.findIndex((cell) => cell.key === node.key)
    const next = cells[index + (forward ? 1 : -1)]
    if (next) return next.key
    if (node.type === "column") return cells[forward ? 0 : cells.length - 1]?.key ?? null
    return parent?.key ?? null
  }
  const headers: TNativeCollectionNode<object>[] = []
  const visit = (nodes: Iterable<TNativeCollectionNode<object>>) => {
    for (const entry of nodes) {
      if (entry.type === "column") headers.push(entry)
      else if (entry.type !== "item") visit(collection.getChildren(entry.key))
    }
  }
  visit(collection)
  const columnIndex = isCell ? children(parent).findIndex((cell) => cell.key === node.key) : 0
  if (node.type === "column")
    return key === "ArrowDown"
      ? (children(rows[0])[columnIndex]?.key ?? (wrap ? wrappedBoundary(false) : null))
      : wrap
        ? wrappedBoundary(true)
        : null
  const row = isCell ? parent : node
  const index = table.rows.findIndex((candidate) => candidate.key === row?.key)
  const forward = key === "ArrowDown"
  const next = forward
    ? table.rows.slice(index + 1).find((candidate) => !manager.isDisabled(candidate.key))
    : table.rows
        .slice(0, index)
        .reverse()
        .find((candidate) => !manager.isDisabled(candidate.key))
  if (next) return isCell ? (children(next)[columnIndex]?.key ?? null) : next.key
  if (!forward && headers[columnIndex]) return headers[columnIndex].key
  return wrap ? wrappedBoundary(!forward) : null
}
