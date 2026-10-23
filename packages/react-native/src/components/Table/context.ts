import { createContext, useContext } from "react"
import type { RefObject } from "react"
import type { ColorValue } from "react-native"
import type { View } from "react-native"

import type { TNativeCollectionNode, TNativeCollectionSnapshot } from "../../collection/snapshot"
import type { SelectionManager } from "../../collection/state/SelectionManager"

import type { TNativeTableQueryControls } from "./types"

export const NativeTableOptionsContext = createContext<{
  mode: "none" | "single" | "multiple"
  behavior: "toggle" | "replace" | null
  labels: { selectAllRowsAriaLabel: string; selectRowAriaLabel: string }
  sortingEnabled: boolean
}>({
  mode: "none",
  behavior: null,
  labels: { selectAllRowsAriaLabel: "Select All", selectRowAriaLabel: "Select Row" },
  sortingEnabled: false,
})
export const NativeTableCellContext = createContext<{
  node: TNativeCollectionNode<object>
  target: RefObject<View | null>
} | null>(null)

export type TNativeTableContext = {
  collection: TNativeCollectionSnapshot<object>
  target: number
  rows: TNativeCollectionNode<object>[]
  headerCount: number
  rowHeaderColumns: ReadonlySet<string>
  columnCount: number
  zebra: boolean
  zebraColor: ColorValue
  headerTargets: ReadonlyMap<string, number>
  registerHeader: (id: string, target: number) => void
  manager: SelectionManager
  onRowAction?: (key: string | number) => void
  queryControls?: TNativeTableQueryControls
  primarySort?: { column: string; direction: "ascending" | "descending" }
  sortColumn: (columnID: string) => void
}
export const NativeTableContext = createContext<TNativeTableContext | null>(null)
export const useNativeTable = () => {
  const table = useContext(NativeTableContext)
  if (!table) throw new Error("Table parts require a Table")
  return table
}
