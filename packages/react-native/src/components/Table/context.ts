import { createContext, useContext } from "react"
import type { RefObject } from "react"
import type { ColorValue } from "react-native"
import type { View } from "react-native"

import type { TNativeCollectionNode, TNativeCollectionSnapshot } from "../../collection/snapshot"
import type { SelectionManager } from "../../collection/state/SelectionManager"

import type { resolveNativeTableFilteringLabels } from "./filterLabels"
import type { TNativeTableQueryControls, TNativeTableColumnResizingControls } from "./types"
import type { useTableKeyboard } from "./useTableKeyboard"

export const NativeTableOptionsContext = createContext<{
  mode: "none" | "single" | "multiple"
  behavior: "toggle" | "replace" | null
  labels: { selectAllRowsAriaLabel: string; selectRowAriaLabel: string }
  sortingEnabled: boolean
  resizingEnabled: boolean
}>({
  mode: "none",
  behavior: null,
  labels: { selectAllRowsAriaLabel: "Select All", selectRowAriaLabel: "Select Row" },
  sortingEnabled: false,
  resizingEnabled: false,
})
export const NativeTableCellContext = createContext<{
  node: TNativeCollectionNode<object>
  target: RefObject<View | null>
  width: RefObject<number | null>
} | null>(null)

export type TNativeTableContext = {
  collection: TNativeCollectionSnapshot<object>
  target: number
  rows: TNativeCollectionNode<object>[]
  headerCount: number
  rowHeaderColumns: ReadonlySet<string>
  columnCount: number
  hoverColor: ColorValue
  zebra: boolean
  zebraColor: ColorValue
  headerTargets: ReadonlyMap<string, number>
  registerHeader: (id: string, target: number) => void
  manager: SelectionManager
  keyboard: ReturnType<typeof useTableKeyboard>
  onRowAction?: (key: string | number) => void
  queryControls?: TNativeTableQueryControls
  primarySort?: { column: string; direction: "ascending" | "descending" }
  sortColumn: (columnID: string) => void
  filteringLabels: ReturnType<typeof resolveNativeTableFilteringLabels>
  columnResizing?: TNativeTableColumnResizingControls
  canResizeWithKeyboard: (columnID: string) => boolean
  resizeWithKeyboard: (columnID: string, measuredWidth: number | null, delta: number) => void
}
export const NativeTableContext = createContext<TNativeTableContext | null>(null)
export const useNativeTable = () => {
  const table = useContext(NativeTableContext)
  if (!table) throw new Error("Table parts require a Table")
  return table
}
