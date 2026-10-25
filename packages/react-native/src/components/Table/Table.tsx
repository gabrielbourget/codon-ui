import { useCallback, useContext, useMemo, useRef, useState } from "react"
import { findNodeHandle, View } from "react-native"

import { NativeCollectionActionsContext } from "../../collection/actions"
import { NativeCollectionItemBindingContext } from "../../collection/binding"
import { NativeCollectionBuilder } from "../../collection/CollectionBuilder"
import { NativeCollectionRendererContext, useNativePersistedKeys } from "../../collection/renderer"
import { NativeCollectionSemanticsContext } from "../../collection/semantics"
import type { TNativeCollectionSessionSnapshot } from "../../collection/session"
import type { TNativeCollectionNode, TNativeCollectionSnapshot } from "../../collection/snapshot"
import { SelectionManager } from "../../collection/state/SelectionManager"
import { useFocusedKeyReset } from "../../collection/state/useListState"
import { useMultipleSelectionState } from "../../collection/state/useMultipleSelectionState"
import { NativeFocusHost } from "../../input/NativeFocusView"
import { nativeViewProps } from "../../input/nativeViewProps"
import { useNativeTheme } from "../../theme"
import { resolveNativeStyle } from "../colors"
import { NativeContentContext } from "../NativeContentContext"
import { splitNativeTextStyle } from "../nativeTextStyle"
import { Pagination } from "../Pagination/Pagination"

import { NativeTableContext, NativeTableOptionsContext } from "./context"
import { resolveNativeTableFilteringLabels } from "./filterLabels"
import { TABLE_SORT_DIRECTION__ASCENDING } from "./queryTypes"
import { resizeNativeTableColumn } from "./resizing"
import { computeNextNativeTableSorts } from "./sorting"
import { TableTypeahead } from "./TableTypeahead"
import type { TNativeTableProps } from "./types"
import { useTableKeyboard } from "./useTableKeyboard"

const Receiver = <T extends object>({
  props,
  collection,
  selection,
  receipt,
}: {
  props: TNativeTableProps<T>
  collection: TNativeCollectionSnapshot<object>
  selection: ReturnType<typeof useMultipleSelectionState>
  receipt: TNativeCollectionSessionSnapshot<unknown>["receipt"]
}) => {
  const {
    children: _children,
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
    ...native
  } = props
  const sorting = queryControls?.sorting
  const firstSort = sorting?.activeSorts[0]
  const primaryColumn = firstSort && columns?.find((column) => column.sort?.criteriaID === firstSort.criteriaID)
  const manager = useMemo(() => new SelectionManager(collection, selection), [collection, selection])
  useFocusedKeyReset(collection, manager)
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
  const rows: TNativeCollectionNode<object>[] = []
  const rowHeaderColumns = new Set<string>()
  let headerCount = 0,
    columnCount = 0
  const visit = (nodes: Iterable<TNativeCollectionNode<object>>) => {
    for (const node of nodes) {
      if (node.type === "item") rows.push(node)
      if (node.type === "header") {
        headerCount++
        columnCount = Math.max(columnCount, Array.from(collection.getChildren(node.key)).length)
      }
      if (node.type === "column" && node.props.isRowHeader) rowHeaderColumns.add(node.props.columnID)
      visit(collection.getChildren(node.key))
    }
  }
  visit(collection)
  const keyboard = useTableKeyboard({
    collection,
    manager,
    rows,
    root,
    props,
    layout: renderer.layoutDelegate,
    receipt,
    rowHeaderColumns,
  })
  const persistedKeys = useNativePersistedKeys(manager.focusedKey, keyboard.requestedKey, keyboard.observedKey)
  if (receipt.status === "confirmed" && columnCount > 0 && rowHeaderColumns.size === 0)
    throw new Error("A table must have at least one Column with the isRowHeader prop set to true")
  const styles = splitNativeTextStyle(
    resolveNativeStyle([{ width: "100%", flexShrink: 0 }, customStyles, style], "Table", "style"),
  )
  return (
    <NativeTableContext.Provider
      value={{
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
            hierarchical: false,
            selectionMode: manager.selectionMode,
          })}
        >
          <NativeCollectionItemBindingContext.Provider value={actions.bindingFor(null)}>
            <NativeFocusHost
              {...nativeViewProps(native)}
              ref={bind}
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
