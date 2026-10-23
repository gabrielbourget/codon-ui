import { useCallback, useContext, useMemo, useState } from "react"
import { findNodeHandle, View } from "react-native"

import { NativeCollectionBuilder } from "../../collection/CollectionBuilder"
import { NativeCollectionRendererContext } from "../../collection/renderer"
import { NativeCollectionSemanticsContext } from "../../collection/semantics"
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

import { NativeTableContext, NativeTableOptionsContext } from "./context"
import type { TNativeTableProps } from "./types"

const Receiver = ({
  props,
  collection,
  selection,
  confirmed,
}: {
  props: TNativeTableProps
  collection: TNativeCollectionSnapshot<object>
  selection: ReturnType<typeof useMultipleSelectionState>
  confirmed: boolean
}) => {
  const {
    children: _children,
    style,
    customStyles,
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
    ...native
  } = props
  const manager = useMemo(() => new SelectionManager(collection, selection), [collection, selection])
  useFocusedKeyReset(collection, manager)
  const renderer = useContext(NativeCollectionRendererContext)
  const theme = useNativeTheme()
  const [target, setTarget] = useState(0)
  const [headerTargets, setHeaderTargets] = useState(new Map<string, number>())
  const bind = useCallback((view: View | null) => setTarget(view ? (findNodeHandle(view) ?? 0) : 0), [])
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
  if (confirmed && columnCount > 0 && rowHeaderColumns.size === 0)
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
        zebra: !!zebra,
        zebraColor: zebraColor ?? "transparent",
        headerTargets,
        registerHeader,
        manager,
        onRowAction: clickableRows && onRowAction ? onRowAction : undefined,
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
          <NativeFocusHost
            {...nativeViewProps(native)}
            ref={bind}
            testID={props.testID ?? "table"}
            accessible={false}
            focusable={false}
            role="grid"
            style={styles.view}
          >
            <NativeContentContext.Provider
              value={{ foregroundColor: styles.text.color ?? theme.colors.foreground, isButton: false }}
            >
              <renderer.CollectionRoot collection={collection} />
            </NativeContentContext.Provider>
          </NativeFocusHost>
        </NativeCollectionSemanticsContext.Provider>
      </View>
    </NativeTableContext.Provider>
  )
}
export const Table = (props: TNativeTableProps) => {
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
    }),
    [selection.selectionMode, selection.selectionBehavior, labels],
  )
  return (
    <NativeTableOptionsContext.Provider value={options}>
      <NativeCollectionBuilder<object> content={props.children}>
        {(collection, receipt) => (
          <Receiver
            props={props}
            collection={collection}
            selection={selection}
            confirmed={receipt.status === "confirmed"}
          />
        )}
      </NativeCollectionBuilder>
    </NativeTableOptionsContext.Provider>
  )
}
