import { createContext, useContext } from "react"
import type { RefObject } from "react"
import type { ColorValue } from "react-native"
import type { View } from "react-native"

import type { TNativeCollectionNode, TNativeCollectionSnapshot } from "../../collection/snapshot"
import type { SelectionManager } from "../../collection/state/SelectionManager"

export const NativeTableOptionsContext = createContext<{
  mode: "none" | "single" | "multiple"
  behavior: "toggle" | "replace" | null
  labels: { selectAllRowsAriaLabel: string; selectRowAriaLabel: string }
}>({ mode: "none", behavior: null, labels: { selectAllRowsAriaLabel: "Select All", selectRowAriaLabel: "Select Row" } })
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
}
export const NativeTableContext = createContext<TNativeTableContext | null>(null)
export const useNativeTable = () => {
  const table = useContext(NativeTableContext)
  if (!table) throw new Error("Table parts require a Table")
  return table
}
