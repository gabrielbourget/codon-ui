import { useCallback, useContext, useMemo, useRef, useState } from "react"
import { findNodeHandle, View } from "react-native"

import { NativeCollectionActionsContext } from "../../collection/actions"
import { NativeCollectionItemBindingContext } from "../../collection/binding"
import { NativeCollectionBuilder } from "../../collection/CollectionBuilder"
import {
  NativeSelectableCollectionContext,
  useNativeContextProps,
  useNativeCollectionRefs,
} from "../../collection/context"
import { NativeCollectionRendererContext, useNativePersistedKeys } from "../../collection/renderer"
import { NativeCollectionSemanticsContext } from "../../collection/semantics"
import type { TNativeCollectionSessionSnapshot } from "../../collection/session"
import type { TNativeCollectionSnapshot } from "../../collection/snapshot"
import { useControlledState } from "../../collection/state/useControlledState"
import { useMultipleSelectionState } from "../../collection/state/useMultipleSelectionState"
import { NativeFocusHost } from "../../input/NativeFocusView"
import { nativeViewProps } from "../../input/nativeViewProps"
import { useNativeTheme } from "../../theme"
import { resolveNativeStyle } from "../colors"
import { NativeContentContext } from "../NativeContentContext"
import { splitNativeTextStyle } from "../nativeTextStyle"
import { Pagination } from "../Pagination/Pagination"

import { NativeTableContext, NativeTableOptionsContext, NativeTableStateContext } from "./context"
import { resolveNativeTableFilteringLabels } from "./filterLabels"
import { TABLE_SORT_DIRECTION__ASCENDING } from "./queryTypes"
import { resizeNativeTableColumn } from "./resizing"
import { computeNextNativeTableSorts } from "./sorting"
import { NativeTableCollection } from "./state/TableCollection"
import { useNativeTableState, useNativeFilteredTableState } from "./state/useTableState"
import { TableTypeahead } from "./TableTypeahead"
import type { TNativeTableProps } from "./types"
import { useTableKeyboard } from "./useTableKeyboard"

const Receiver = <T extends object>({
  props: incoming,
  collection: sourceCollection,
  selection,
  receipt,
}: {
  props: TNativeTableProps<T>
  collection: TNativeCollectionSnapshot<object>
  selection: ReturnType<typeof useMultipleSelectionState>
  receipt: TNativeCollectionSessionSnapshot<unknown>["receipt"]
}) => {
  const authoredStyle = resolveNativeStyle([incoming.customStyles, incoming.style], "Table", "authoredStyle")
  const [props, contextRef] = useNativeContextProps(
    { ...incoming, customStyles: undefined, style: authoredStyle },
    incoming.ref,
    NativeSelectableCollectionContext,
  )
  const [expandedKeys, setExpandedKeys] = useControlledState(
    props.expandedKeys ? new Set(props.expandedKeys) : undefined,
    props.defaultExpandedKeys ? new Set(props.defaultExpandedKeys) : new Set(),
    props.onExpandedChange,
  )
  const unfilteredCollection = useMemo(
    () => new NativeTableCollection(sourceCollection, expandedKeys),
    [sourceCollection, expandedKeys],
  )
  const {
    ref: _consumerRef,
    children: _children,
    geometry: _geometry,
    style,
    customStyles,
    hoverColor,
    zebra,
    zebraColor,
    labels: _labels,
    selectionMode: _mode,
    selectionBehavior: _behavior,
    selectedKeys: _selected,
    defaultSelectedKeys: _defaults,
    disabledKeys: _disabled,
    disabledBehavior: _disabledBehavior,
    onSelectionChange: _selection,
    disallowEmptySelection: _empty,
    allowDuplicateSelectionEvents: _duplicates,
    clickableRows,
    onRowAction,
    columns,
    queryControls,
    filteringLabels,
    columnResizing,
    disallowSelectAll: _selectAll,
    escapeKeyBehavior: _escape,
    shouldFocusWrap: _wrap,
    expandedKeys: _expandedKeys,
    defaultExpandedKeys: _defaultExpandedKeys,
    onExpandedChange: _expandedChange,
    treeColumn: _treeColumn,
    filter,
    shouldUseVirtualFocus: _virtualFocus,
    disallowTypeAhead: _typeAhead,
    slot: _slot,
    ...native
  } = props
  const sorting = queryControls?.sorting
  const firstSort = sorting?.activeSorts[0]
  const primaryColumn = firstSort && columns?.find((column) => column.sort?.criteriaID === firstSort.criteriaID)
  const state = useNativeFilteredTableState(
    useNativeTableState({
      ...props,
      collection: unfilteredCollection,
      selectionState: selection,
      expandedKeys,
      onExpandedChange: setExpandedKeys,
      sortDescriptor:
        primaryColumn && firstSort
          ? {
              column: primaryColumn.id,
              direction: firstSort.sortDirection === TABLE_SORT_DIRECTION__ASCENDING ? "ascending" : "descending",
            }
          : undefined,
      onSortChange: ({ column: key }) => {
        const column = columns?.find((candidate) => candidate.id === key)
        if (sorting && column?.sort?.criteriaID)
          sorting.onSortChange(
            computeNextNativeTableSorts({ activeSorts: sorting.activeSorts, column, mode: sorting.mode }),
          )
      },
    }),
    filter,
  )
  const { collection, selectionManager: manager } = state
  const renderer = useContext(NativeCollectionRendererContext)
  const actions = useContext(NativeCollectionActionsContext)!
  const theme = useNativeTheme()
  const [target, setTarget] = useState(0)
  const root = useRef<View | null>(null)
  const [headerTargets, setHeaderTargets] = useState(new Map<string, number>())
  const bind = useCallback((view: View | null) => {
    root.current = view
    setTarget(view ? (findNodeHandle(view) ?? 0) : 0)
  }, [])
  const mergedRef = useNativeCollectionRefs(bind, contextRef)
  const registerHeader = useCallback(
    (id: string, target: number) =>
      setHeaderTargets((previous) => {
        if ((previous.get(id) ?? 0) === target) return previous
        const next = new Map(previous)
        if (target) next.set(id, target)
        else next.delete(id)
        return next
      }),
    [],
  )
  const rows = collection.rows.filter((node) => node.type === "item")
  const rowHeaderColumns = new Set<string>(
    collection.columns.filter((node) => node.props.isRowHeader).map((node) => node.props.columnID),
  )
  const headerCount = collection.headerRows.length
  const columnCount = collection.columnCount
  const sourceKeyboard = useTableKeyboard({
    collection,
    manager,
    rows,
    root,
    props,
    layout: renderer.layoutDelegate,
    receipt,
    rowHeaderColumns,
  })
  const keyboard = state.isKeyboardNavigationDisabled
    ? {
        ...sourceKeyboard,
        keysFor: () => [],
        onKeyDown: () => {},
        typeahead: () => {},
        captureTypeahead: () => {},
        typeaheadEnabled: false,
      }
    : sourceKeyboard
  const persistedKeys = useNativePersistedKeys(manager.focusedKey, keyboard.requestedKey, keyboard.observedKey)
  if (receipt.status === "confirmed" && columnCount > 0 && rowHeaderColumns.size === 0)
    throw new Error("A table must have at least one Column with the isRowHeader prop set to true")
  const styles = splitNativeTextStyle(
    resolveNativeStyle([{ width: "100%", flexShrink: 0 }, customStyles, style], "Table", "style"),
  )
  return (
    <NativeTableStateContext.Provider value={state}>
      <NativeSelectableCollectionContext.Provider value={null}>
        <NativeTableContext.Provider
          value={{
            state,
            collection,
            target,
            rows,
            headerCount,
            rowHeaderColumns,
            columnCount,
            hoverColor: hoverColor ?? "transparent",
            zebra: !!zebra,
            zebraColor: zebraColor ?? "transparent",
            headerTargets,
            registerHeader,
            manager,
            keyboard,
            onRowAction: clickableRows && onRowAction ? onRowAction : undefined,
            queryControls,
            filteringLabels: resolveNativeTableFilteringLabels(filteringLabels),
            columnResizing,
            canResizeWithKeyboard: (id) =>
              !!columnResizing?.enabled &&
              !!columns?.some((column) => column.id === id && !column.isHidden && !column.headerVisuallyHidden),
            resizeWithKeyboard: (id, measuredWidth, delta) => {
              const column = columns?.find((candidate) => candidate.id === id)
              if (columnResizing?.enabled && column && !column.isHidden && !column.headerVisuallyHidden)
                resizeNativeTableColumn(
                  column,
                  columnResizing,
                  (measuredWidth ?? (typeof column.width === "number" ? column.width : 0)) + delta,
                )
            },
            primarySort:
              primaryColumn && firstSort
                ? {
                    column: primaryColumn.id,
                    direction: firstSort.sortDirection === TABLE_SORT_DIRECTION__ASCENDING ? "ascending" : "descending",
                  }
                : undefined,
            sortColumn: (columnID) => {
              const column = columns?.find((candidate) => candidate.id === columnID)
              if (sorting && column?.sort?.criteriaID)
                sorting.onSortChange(
                  computeNextNativeTableSorts({ activeSorts: sorting.activeSorts, column, mode: sorting.mode }),
                )
            },
          }}
        >
          <View
            testID={`${props.testID ?? "table"}-shell`}
            style={{ width: "100%", height: "100%", minHeight: 0, flexDirection: "column" }}
          >
            <NativeCollectionSemanticsContext.Provider
              value={JSON.stringify({
                kind: "root",
                rowCount: rows.length + headerCount,
                columnCount,
                hierarchical: state.treeColumn != null,
                selectionMode: manager.selectionMode,
              })}
            >
              <NativeCollectionItemBindingContext.Provider value={actions.bindingFor(null)}>
                <NativeFocusHost
                  {...nativeViewProps(native)}
                  ref={mergedRef}
                  testID={props.testID ?? "table"}
                  accessible={false}
                  focusable
                  nativeTabStop={manager.focusedKey == null}
                  capturedKeys={keyboard.keysFor(null)}
                  onKeyDown={keyboard.onKeyDown}
                  onFocus={(event) => {
                    keyboard.onFocus(event)
                    native.onFocus?.(event)
                  }}
                  role="grid"
                  style={styles.view}
                >
                  <TableTypeahead target={root} tag={target} />
                  <NativeContentContext.Provider
                    value={{ foregroundColor: styles.text.color ?? theme.colors.foreground, isButton: false }}
                  >
                    <renderer.CollectionRoot collection={collection} persistedKeys={persistedKeys} />
                  </NativeContentContext.Provider>
                </NativeFocusHost>
              </NativeCollectionItemBindingContext.Provider>
            </NativeCollectionSemanticsContext.Provider>
            {queryControls?.pagination && (
              <View style={{ flexShrink: 0, flexDirection: "row", justifyContent: "flex-end", paddingTop: 5 }}>
                <Pagination
                  maxVisiblePages={4}
                  showIncrementButtonsWithOnePage={false}
                  chosenPaginationSubcomponents={["items-per-page", "primary-controls"]}
                  {...queryControls.pagination}
                />
              </View>
            )}
          </View>
        </NativeTableContext.Provider>
      </NativeSelectableCollectionContext.Provider>
    </NativeTableStateContext.Provider>
  )
}
export const Table = <T extends object = object>(props: TNativeTableProps<T>) => {
  const selection = useMultipleSelectionState(props)
  const labels = useMemo(
    () => ({ selectAllRowsAriaLabel: "Select All", selectRowAriaLabel: "Select Row", ...props.labels?.selection }),
    [props.labels],
  )
  const options = useMemo(
    () => ({
      mode: selection.selectionMode,
      behavior: selection.selectionMode === "none" ? null : selection.selectionBehavior,
      labels,
      sortingEnabled: !!props.queryControls?.sorting,
      resizingEnabled: !!props.columnResizing?.enabled,
    }),
    [
      selection.selectionMode,
      selection.selectionBehavior,
      labels,
      !!props.queryControls?.sorting,
      !!props.columnResizing?.enabled,
    ],
  )
  return (
    <NativeTableOptionsContext.Provider value={options}>
      <NativeCollectionBuilder<object> content={props.children}>
        {(collection, receipt) => (
          <Receiver props={props} collection={collection} selection={selection} receipt={receipt} />
        )}
      </NativeCollectionBuilder>
    </NativeTableOptionsContext.Provider>
  )
}
