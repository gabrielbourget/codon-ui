import { useCallback, useContext, useId, useLayoutEffect, useMemo, useRef, useState } from "react"
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
import { nativeAccessibilityIDs } from "../../input/accessibilityReferences"
import { NativeFocusView } from "../../input/NativeFocusView"
import { useNativeKeyScope } from "../../input/NativeKeyboardScope"
import { nativeViewProps } from "../../input/nativeViewProps"
import type { TNativeFocusEvent } from "../../input/types"
import { useNativeTheme } from "../../theme"
import { resolveNativeStyle } from "../colors"
import { NativeContentContext, useNativeContentContext } from "../NativeContentContext"
import { splitNativeTextStyle } from "../nativeTextStyle"
import { Pagination } from "../Pagination/Pagination"

import {
  NativeTableContext,
  NativeTableOptionsContext,
  NativeTablePropsContext,
  NativeTableStateContext,
} from "./context"
import { resolveNativeTableFilteringLabels } from "./filterLabels"
import {
  NativeResizableTableContainerContext,
  NativeTableColumnResizeStateContext,
} from "./NativeResizableTableContainer"
import { TABLE_SORT_DIRECTION__ASCENDING } from "./queryTypes"
import { resizeNativeTableColumn } from "./resizing"
import { computeNextNativeTableSorts } from "./sorting"
import { NativeTableCollection } from "./state/TableCollection"
import { useNativeTableColumnResizeState } from "./state/useTableColumnResizeState"
import { useNativeTableState, useNativeFilteredTableState } from "./state/useTableState"
import { TableTypeahead } from "./TableTypeahead"
import type { TNativeTableProps, TNativeTableReceivedProps, TNativeTableRenderState } from "./types"
import { useTableKeyboard } from "./useTableKeyboard"

const Receiver = <T extends object>({
  props: incoming,
  collection: sourceCollection,
  selection,
  receipt,
}: {
  props: TNativeTableReceivedProps<T>
  collection: TNativeCollectionSnapshot<object>
  selection: ReturnType<typeof useMultipleSelectionState>
  receipt: TNativeCollectionSessionSnapshot<unknown>["receipt"]
}) => {
  const [props, contextRef] = useNativeContextProps(incoming, incoming.ref, NativeSelectableCollectionContext)
  const [expandedKeys, setExpandedKeys] = useControlledState(
    props.expandedKeys ? new Set(props.expandedKeys) : undefined,
    props.defaultExpandedKeys ? new Set(props.defaultExpandedKeys) : new Set(),
    props.onExpandedChange,
  )
  const baseCollection = useMemo(() => new NativeTableCollection(sourceCollection), [sourceCollection])
  const unfilteredCollection = useMemo(
    () => new NativeTableCollection(baseCollection, expandedKeys),
    [baseCollection, expandedKeys],
  )
  const {
    ref: _consumerRef,
    children: _children,
    geometry: _geometry,
    style,
    render,
    customStyles: _customStyles,
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
    clickableRows: _clickableRows,
    onRowAction,
    sortDescriptor,
    onSortChange,
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
    onFocus,
    onBlur,
    ariaDescribedBy,
    ariaDetails,
    "aria-describedby": nativeDescribedBy,
    "aria-details": nativeDetails,
    "data-testid": aliasTestID,
    ...native
  } = props
  const state = useNativeFilteredTableState(
    useNativeTableState({
      ...props,
      collection: unfilteredCollection,
      selectionState: selection,
      expandedKeys,
      onExpandedChange: setExpandedKeys,
      sortDescriptor,
      onSortChange,
    }),
    filter,
  )
  const { collection, selectionManager: manager } = state
  const resizeContainer = useContext(NativeResizableTableContainerContext)
  const resizeState = useNativeTableColumnResizeState({ tableWidth: resizeContainer?.tableWidth ?? 0 }, state)
  const renderer = useContext(NativeCollectionRendererContext)
  const actions = useContext(NativeCollectionActionsContext)!
  const theme = useNativeTheme()
  const parentContent = useNativeContentContext()
  const [target, setTarget] = useState(0)
  const root = useRef<View | null>(null)
  const [headerTargets, setHeaderTargets] = useState(new Map<string, number>())
  const bind = useCallback((view: View | null) => {
    root.current = view
    setTarget(view ? (findNodeHandle(view) ?? 0) : 0)
  }, [])
  const callerRef = useNativeCollectionRefs(contextRef, resizeContainer?.tableRef)
  const mergedRef = useNativeCollectionRefs(bind, callerRef)
  const generatedID = useId()
  const providedID = props.id ?? props.nativeID
  const retainedID = useRef(providedID ?? `codon-table-${generatedID}`)
  useLayoutEffect(() => {
    if (providedID !== undefined) retainedID.current = providedID
  }, [providedID])
  const [isFocused, setFocused] = useState(false)
  const [isFocusVisible, setFocusVisible] = useState(false)
  const observedFocus = useRef(false)
  const input = useNativeKeyScope()
  useLayoutEffect(
    () =>
      input?.subscribe(() => {
        const origin = input.lastInput()?.origin
        if (observedFocus.current && origin) setFocusVisible(origin === "keyboard")
      }),
    [input],
  )
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
  const renderState: TNativeTableRenderState = { isFocused, isFocusVisible, isDropTarget: false, state }
  const authoredStyle = typeof style === "function" ? style({ ...renderState, defaultStyle: {} }) : style
  const styles = splitNativeTextStyle(
    resolveNativeStyle([parentContent?.textStyle, { width: "100%", flexShrink: 0 }, authoredStyle], "Table", "style"),
  )
  const rootTestID = props.testID ?? aliasTestID ?? "table"
  const labelledBy =
    native["aria-labelledby"] !== undefined
      ? native["aria-labelledby"].split(",").flatMap((part) => nativeAccessibilityIDs(part) ?? [])
      : typeof native.accessibilityLabelledBy === "string"
        ? [native.accessibilityLabelledBy]
        : native.accessibilityLabelledBy
  const hostProps = {
    ...nativeViewProps({ ...native, id: providedID ?? retainedID.current }),
    ref: mergedRef,
    testID: rootTestID,
    accessibilityLabelledBy: labelledBy ? [...labelledBy] : undefined,
    nativeLabelledBy: labelledBy,
    nativeDescribedBy: nativeAccessibilityIDs(ariaDescribedBy ?? nativeDescribedBy),
    nativeDetailsBy: nativeAccessibilityIDs(ariaDetails ?? nativeDetails),
    accessible: false,
    focusable: true,
    nativeTabStop: manager.focusedKey == null,
    capturedKeys: keyboard.keysFor(null),
    onKeyDown: keyboard.onKeyDown,
    onFocus: (event: TNativeFocusEvent) => {
      if (event.nativeEvent.target !== findNodeHandle(root.current)) return
      observedFocus.current = true
      setFocused(true)
      setFocusVisible(event.nativeEvent.isFocusVisible)
      if (!state.isKeyboardNavigationDisabled) keyboard.onFocus(event)
      else if (keyboard.canAct()) manager.setFocused(true)
      onFocus?.(event)
    },
    onBlur: (event: TNativeFocusEvent) => {
      if (event.nativeEvent.target !== findNodeHandle(root.current)) return
      observedFocus.current = false
      setFocused(false)
      setFocusVisible(false)
      onBlur?.(event)
    },
    role: "grid" as const,
    style: resizeContainer
      ? [styles.view, { width: [...resizeState.columnWidths.values()].reduce((sum, width) => sum + width, 0) }]
      : styles.view,
    children: (
      <>
        <TableTypeahead target={root} tag={target} />
        <NativeContentContext.Provider
          value={{
            foregroundColor: styles.text.color ?? parentContent?.foregroundColor ?? theme.colors.foreground,
            isButton: false,
            textStyle: styles.text,
          }}
        >
          <renderer.CollectionRoot collection={collection} persistedKeys={persistedKeys} />
        </NativeContentContext.Provider>
      </>
    ),
  }
  return (
    <NativeTableColumnResizeStateContext.Provider value={resizeContainer ? resizeState : null}>
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
              onRowAction,
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
              primarySort: state.sortDescriptor ?? undefined,
              sortColumn: (key) => state.sort(key),
            }}
          >
            <View
              testID={`${rootTestID}-shell`}
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
                  {render ? render(hostProps, renderState) : <NativeFocusView {...hostProps} />}
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
    </NativeTableColumnResizeStateContext.Provider>
  )
}
export const Table = <T extends object = object>(authored: TNativeTableProps<T>) => {
  const sorting = authored.queryControls?.sorting
  const firstSort = sorting?.activeSorts[0]
  const primaryColumn =
    firstSort && authored.columns?.find((column) => column.sort?.criteriaID === firstSort.criteriaID)
  const [inherited, ref] = useNativeContextProps(
    {
      ...authored,
      customStyles: undefined,
      style: resolveNativeStyle([authored.customStyles, authored.style], "Table", "authoredStyle"),
      onRowAction: authored.clickableRows && authored.onRowAction ? authored.onRowAction : undefined,
      sortDescriptor:
        primaryColumn && firstSort
          ? {
              column: primaryColumn.id,
              direction:
                firstSort.sortDirection === TABLE_SORT_DIRECTION__ASCENDING
                  ? ("ascending" as const)
                  : ("descending" as const),
            }
          : undefined,
      onSortChange: sorting
        ? ({ column: key }: { column: string | number }) => {
            const column = authored.columns?.find((candidate) => candidate.id === key)
            if (column?.sort?.criteriaID)
              sorting.onSortChange(
                computeNextNativeTableSorts({ activeSorts: sorting.activeSorts, column, mode: sorting.mode }),
              )
          }
        : undefined,
    },
    authored.ref,
    NativeTablePropsContext,
  )
  const props: TNativeTableReceivedProps<T> = {
    ...inherited,
    ref,
    geometry: authored.geometry,
    hoverColor: authored.hoverColor,
    zebra: authored.zebra,
    zebraColor: authored.zebraColor,
    labels: authored.labels,
    clickableRows: authored.clickableRows,
    columns: authored.columns,
    queryControls: authored.queryControls,
    filteringLabels: authored.filteringLabels,
    columnResizing: authored.columnResizing,
  }
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
