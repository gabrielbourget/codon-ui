import { forwardRef, useCallback, useContext, useRef, type ForwardedRef, type ReactNode } from "react"
import type { View } from "react-native"
import { findNodeHandle } from "react-native"

import { NativeCollectionActionsContext } from "../../collection/actions"
import { NativeCollectionItemBindingContext } from "../../collection/binding"
import { createNativeCollectionLeaf } from "../../collection/CollectionBuilder"
import { useNativeCollectionRefs } from "../../collection/context"
import { NativeCollectionSemanticsContext } from "../../collection/semantics"
import type { TNativeCollectionNode } from "../../collection/snapshot"
import { nativeKeyTokens } from "../../input/keyScope"
import { NativeFocusHost } from "../../input/NativeFocusView"
import { useNativeKeyScope } from "../../input/NativeKeyboardScope"
import { nativeViewProps } from "../../input/nativeViewProps"
import { useNativeTheme } from "../../theme"
import { NativeButton } from "../Button/Button"
import { getNativeButtonContent } from "../Button/content"
import { resolveNativeStyle } from "../colors"
import { NativeContentContext, useNativeContentContext } from "../NativeContentContext"
import { splitNativeTextStyle } from "../nativeTextStyle"

import { NativeTableCellContext, useNativeTable } from "./context"
import { TableCellKeys } from "./TableCellKeys"
import type { TNativeTableCellProps, TNativeTableColumnProps } from "./types"
import { useTableAction } from "./useTableAction"

const Cell = (
  props: Omit<TNativeTableCellProps, "children"> &
    Pick<TNativeTableColumnProps, "isRowHeader" | "allowsSorting"> & { children?: ReactNode | (() => ReactNode) },
  ref: ForwardedRef<View>,
  node: TNativeCollectionNode<object>,
) => {
  const {
    id: _id,
    textValue: _textValue,
    columnID,
    isRowHeader: _columnHeader,
    allowsSorting,
    alignment,
    children,
    customStyles,
    style,
    ...native
  } = props
  const table = useNativeTable()
  const scope = useNativeKeyScope()
  const content = useNativeContentContext()
  const theme = useNativeTheme()
  const actions = useContext(NativeCollectionActionsContext)
  const heading = node.type === "column"
  const isRowHeader = !heading && table.rowHeaderColumns.has(columnID)
  const parent = node.parentKey == null ? null : table.collection.getItem(node.parentKey)
  const siblings = parent ? Array.from(table.collection.getChildren(parent.key)) : []
  const index = siblings.findIndex((candidate) => candidate.key === node.key)
  const rowIndex = heading ? 0 : table.headerCount + table.rows.findIndex((row) => row.key === parent?.key)
  const headerKey = JSON.stringify(heading ? ["column", columnID] : ["row", parent?.key, columnID])
  const bindHeader = useCallback(
    (view: View | null) => {
      if (heading || isRowHeader) table.registerHeader(headerKey, view ? (findNodeHandle(view) ?? 0) : 0)
    },
    [heading, isRowHeader, headerKey, table.registerHeader],
  )
  const target = useRef<View | null>(null)
  const width = useRef<number | null>(null)
  const action = useTableAction(node, target)
  const keyboardRef = useCallback(
    (view: View | null) => table.keyboard.register(node, view),
    [node, table.keyboard.register],
  )
  const keyboardTargetRef = useNativeCollectionRefs(target, keyboardRef)
  const originalRef = useNativeCollectionRefs(keyboardTargetRef, bindHeader)
  const mergedRef = useNativeCollectionRefs(ref, originalRef)
  const textAlign = alignment === "Center" ? "center" : alignment === "Right" ? "right" : "auto"
  const authored = resolveNativeStyle([customStyles, style], heading ? "TableColumn" : "TableCell", "style")
  const fluid = authored.width == null || authored.width === "auto"
  const styles = splitNativeTextStyle(
    resolveNativeStyle(
      [
        {
          padding: 5,
          minWidth: 0,
          flexGrow: fluid ? 1 : 0,
          flexShrink: fluid ? 1 : 0,
          flexBasis: fluid ? 0 : "auto",
          justifyContent: "center",
          color: content?.foregroundColor,
          textAlign,
        },
        authored,
      ],
      heading ? "TableColumn" : "TableCell",
      "style",
    ),
  )
  const headers = table.headerTargets.get(JSON.stringify(["column", columnID]))
  const rowHeaders = heading
    ? []
    : siblings
        .filter((cell) => table.rowHeaderColumns.has(cell.props.columnID))
        .map((cell) => table.headerTargets.get(JSON.stringify(["row", parent?.key, cell.props.columnID])))
        .filter((value): value is number => !!value)
  const rendered = (
    <NativeTableCellContext.Provider value={{ node, target, width }}>
      <TableCellKeys node={node} target={target} binding={actions?.bindingFor(node) ?? ""} />
      <NativeContentContext.Provider
        value={{ foregroundColor: styles.text.color ?? theme.colors.foreground, isButton: false }}
      >
        {getNativeButtonContent(typeof children === "function" ? children() : children, styles.text)}
      </NativeContentContext.Provider>
    </NativeTableCellContext.Provider>
  )
  return (
    <NativeCollectionItemBindingContext.Provider value={actions?.bindingFor(node) ?? ""}>
      <NativeCollectionSemanticsContext.Provider
        value={
          table.target && index >= 0
            ? JSON.stringify({
                kind: "cell",
                parentTarget: table.target,
                rowIndex,
                columnIndex: index,
                rowSpan: 1,
                columnSpan: 1,
                heading: heading || !!isRowHeader,
                selected: !heading && parent ? table.manager.isSelected(parent.key) : false,
                rowHeaderTargets: rowHeaders,
                columnHeaderTargets: !heading && headers ? [headers] : [],
              })
            : ""
        }
      >
        {heading ? (
          <NativeButton
            {...nativeViewProps(native)}
            ref={mergedRef}
            nativeRole="columnheader"
            nativeInteraction={!!allowsSorting}
            nativeProgrammaticFocusable
            onKeyDown={table.keyboard.captureTypeahead}
            nativeTabStop={table.manager.focusedKey === node.key}
            nativeRender={(props) => (
              <NativeFocusHost
                {...props}
                capturedKeys={[
                  ...(scope ? [] : table.keyboard.keysFor(node.key)),
                  ...(allowsSorting ? ["Enter", " "].flatMap(nativeKeyTokens) : []),
                ]}
                onKeyDown={(event) => {
                  props.onKeyDown?.(event)
                  table.keyboard.onKeyDown(event)
                }}
              />
            )}
            onFocus={(event) => {
              table.keyboard.observe(node.key, event)
              native.onFocus?.(event)
            }}
            onLayout={(event) => {
              width.current = event.nativeEvent.layout.width
              native.onLayout?.(event)
            }}
            accessibilityValue={
              allowsSorting
                ? { text: table.primarySort?.column === columnID ? table.primarySort.direction : "none" }
                : native.accessibilityValue
            }
            nativeStyle={(flags, visible) => ({
              viewStyle: {
                ...(flags.isFocused && visible ? { outlineWidth: 2, outlineColor: theme.colors.focusRing } : {}),
                ...styles.view,
              },
              textStyle: styles.text,
              foregroundColor: styles.text.color ?? theme.colors.foreground,
              target: 0,
            })}
            onPress={() =>
              action.request((next, current) => {
                if (current.props.allowsSorting) next.sortColumn(current.props.columnID)
              })
            }
          >
            {rendered}
          </NativeButton>
        ) : (
          <NativeFocusHost
            {...nativeViewProps(native)}
            ref={mergedRef}
            accessible
            focusable
            nativeTabStop={table.manager.focusedKey === node.key}
            capturedKeys={scope ? [] : table.keyboard.keysFor(node.key)}
            onFocus={(event) => {
              table.keyboard.observe(node.key, event)
              native.onFocus?.(event)
            }}
            onKeyDown={table.keyboard.onKeyDown}
            style={styles.view}
          >
            {rendered}
          </NativeFocusHost>
        )}
      </NativeCollectionSemanticsContext.Provider>
    </NativeCollectionItemBindingContext.Provider>
  )
}
type TMetadataCellProps = Omit<TNativeTableCellProps, "children"> & { children: () => ReactNode }
const CellMetadata = createNativeCollectionLeaf<object, TMetadataCellProps, View>("cell", Cell)
export const TableCell = forwardRef<View, TNativeTableCellProps>((props, ref) => {
  // Canonical Cell authors a render function; its plain visible text is not collection search metadata.
  const content = useCallback(() => props.children, [props.children])
  return (
    <CellMetadata {...props} ref={ref}>
      {content}
    </CellMetadata>
  )
})
export const TableColumn = createNativeCollectionLeaf<object, TNativeTableColumnProps, View>("column", Cell)
