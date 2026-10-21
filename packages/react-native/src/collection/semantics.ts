import { createContext } from "react"

export type TNativeCollectionSemantics =
  | Readonly<{
      kind: "list-root"
      count: number
    }>
  | Readonly<{
      kind: "list-item"
      parentTarget: number
      ordinal: number
    }>
  | Readonly<{
      kind: "root"
      rowCount: number
      columnCount: number
      hierarchical: boolean
      selectionMode: "none" | "single" | "multiple"
    }>
  | Readonly<{
      kind: "cell"
      parentTarget: number
      rowIndex: number
      columnIndex: number
      rowSpan: number
      columnSpan: number
      heading: boolean
      selected: boolean
      rowHeaderTargets: readonly number[]
      columnHeaderTargets: readonly number[]
    }>

// Consumed by one actual visible host; descendants start a new semantic ownership boundary.
export const NativeCollectionSemanticsContext = createContext("")
