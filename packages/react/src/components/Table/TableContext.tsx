import { createContext, useContext } from "react"

import type { TTableFilteringLabels } from "../Filtering/labels"

import type { TTableColumnResizingControls, TTableQueryControls } from "./helpers"
import type { TTableLabels } from "./labels"

export type TTableContextValue = {
  queryControls?: TTableQueryControls
  columnResizing?: TTableColumnResizingControls
  filteringLabels?: TTableFilteringLabels
  labels?: TTableLabels
}

export const TableContext = createContext<TTableContextValue>({})

export const useTableContext = (): TTableContextValue => useContext(TableContext)
