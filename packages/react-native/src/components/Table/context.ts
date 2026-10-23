import { createContext, useContext } from "react"
import type { ColorValue } from "react-native"

import type { TNativeCollectionNode, TNativeCollectionSnapshot } from "../../collection/snapshot"

export type TNativeTableContext = {
  collection: TNativeCollectionSnapshot<object>
  target: number
  rows: TNativeCollectionNode<object>[]
  headerCount: number
  columnCount: number
  zebra: boolean
  zebraColor: ColorValue
  headerTargets: ReadonlyMap<string, number>
  registerHeader: (id: string, target: number) => void
}
export const NativeTableContext = createContext<TNativeTableContext | null>(null)
export const useNativeTable = () => {
  const table = useContext(NativeTableContext)
  if (!table) throw new Error("Table parts require a Table")
  return table
}
