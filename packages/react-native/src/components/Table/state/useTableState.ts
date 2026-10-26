/* Copyright 2020 Adobe. Apache-2.0; see ../../../collection/LICENSE.react-aria.md. */
import { useMemo, useState } from "react"
import type { TableState, TableStateProps } from "react-stately/useTableState"

import type { TNativeCollectionKey } from "../../../collection/snapshot"
import type { SelectionManager } from "../../../collection/state/SelectionManager"
import { useControlledState } from "../../../collection/state/useControlledState"
import type { MultipleSelectionStateProps } from "../../../collection/state/useMultipleSelectionState"

import type { NativeTableCollection } from "./TableCollection"
import { useNativeTableGridState } from "./useGridState"

export type TNativeTableState<T> = Omit<TableState<T>, "collection" | "selectionManager"> & {
  collection: NativeTableCollection<T>
  selectionManager: SelectionManager
}
export type TNativeTableStateOptions<T> = MultipleSelectionStateProps &
  Pick<
    TableStateProps<object>,
    | "expandedKeys"
    | "defaultExpandedKeys"
    | "onExpandedChange"
    | "treeColumn"
    | "sortDescriptor"
    | "onSortChange"
    | "showSelectionCheckboxes"
  > & {
    collection: NativeTableCollection<T>
    selectionState: SelectionManager["state"]
    focusMode?: "row" | "cell"
  }
export const useNativeTableState = <T>(props: TNativeTableStateOptions<T>): TNativeTableState<T> => {
  const [navigationDisabled, setKeyboardNavigationDisabled] = useState(false)
  const { disabledKeys, selectionManager } = useNativeTableGridState({
    ...props,
    disabledBehavior: props.disabledBehavior || "selection",
  })
  const [expandedKeys, setExpandedKeys] = useControlledState(
    props.expandedKeys ? new Set(props.expandedKeys) : undefined,
    props.defaultExpandedKeys ? new Set(props.defaultExpandedKeys) : new Set<TNativeCollectionKey>(),
    props.onExpandedChange,
  )
  return {
    collection: props.collection,
    disabledKeys,
    selectionManager,
    showSelectionCheckboxes: props.showSelectionCheckboxes || false,
    sortDescriptor: props.sortDescriptor ?? null,
    isKeyboardNavigationDisabled: props.collection.size === 0 || navigationDisabled,
    setKeyboardNavigationDisabled,
    sort: (column, direction) =>
      props.onSortChange?.({
        column,
        direction:
          direction ??
          (props.sortDescriptor?.column === column
            ? props.sortDescriptor.direction === "ascending"
              ? "descending"
              : "ascending"
            : "ascending"),
      }),
    expandedKeys,
    toggleKey: (key) =>
      setExpandedKeys((previous) => {
        const next = new Set(previous)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        return next
      }),
    treeColumn: props.treeColumn ?? null,
  }
}
export const useNativeFilteredTableState = <T>(
  state: TNativeTableState<T>,
  filter:
    | ((textValue: string, node: NonNullable<ReturnType<NativeTableCollection<T>["getItem"]>>) => boolean)
    | null
    | undefined,
): TNativeTableState<T> => {
  const collection = useMemo(
    () => (filter ? state.collection.filter(filter) : state.collection),
    [state.collection, filter],
  )
  return { ...state, collection, selectionManager: state.selectionManager.withCollection(collection) }
}
