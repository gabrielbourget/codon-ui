import { useTableColumnResizeState } from "react-stately/useTableState"
import type { TableColumnResizeState, TableColumnResizeStateProps } from "react-stately/useTableState"

import type { TNativeTableState } from "./useTableState"

export type TNativeTableColumnResizeState<T> = Omit<TableColumnResizeState<T>, "tableState"> & {
  tableState: TNativeTableState<T>
}

// The pinned DOM-free hook reads only collection.columns/key/props and retains
// tableState by identity. The native selection manager is not a source class.
export const useNativeTableColumnResizeState = useTableColumnResizeState as unknown as <T>(
  props: TableColumnResizeStateProps<T>,
  state: TNativeTableState<T>,
) => TNativeTableColumnResizeState<T>
