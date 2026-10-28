import { forwardRef, useCallback, useContext, useRef, useState, type ForwardedRef, type ReactNode } from "react"
import type { View } from "react-native"
import { findNodeHandle } from "react-native"

import { NativeCollectionActionsContext } from "../../collection/actions"
import { NativeCollectionItemBindingContext } from "../../collection/binding"
import { createNativeCollectionLeaf } from "../../collection/CollectionBuilder"
import {
  DefaultNativeCollectionRenderer,
  NativeCollectionCellFocusContext,
  NativeCollectionRendererContext,
} from "../../collection/renderer"
import { NativeCollectionSemanticsContext } from "../../collection/semantics"
import type { TNativeCollectionNode } from "../../collection/snapshot"
import { NativeFocusView } from "../../input/NativeFocusView"
import { useNativeKeyScope } from "../../input/NativeKeyboardScope"
import { NativePressable } from "../../input/NativePressable"
import { nativeViewProps } from "../../input/nativeViewProps"
import { NativeFloatingScopeContext } from "../../overlays/floating/scope"
import { useNativeTheme } from "../../theme"
import { getNativeButtonContent } from "../Button/content"
import { resolveNativeStyle } from "../colors"
import { NativeContentContext, NativeTextLayoutContext, useNativeContentContext } from "../NativeContentContext"
import { splitNativeTextStyle } from "../nativeTextStyle"

import { NativeTableCellContext, useNativeTable } from "./context"
import { NativeTableColumnResizeStateContext } from "./NativeResizableTableContainer"
import { TableCellContent } from "./TableCellContent"
import { TableCellKeys } from "./TableCellKeys"
import type { TNativeTableCellProps, TNativeTableCellRenderState } from "./types"
import { useTableAction } from "./useTableAction"
import { useTableHover } from "./useTableHover"
import { useTableTargetRef } from "./useTableTargetRef"

const Cell = (props: TNativeTableCellProps, ref: ForwardedRef<View>, node: TNativeCollectionNode<object>) => {
  const {
    id: _id,
    textValue: _textValue,
    columnID,
    colSpan: _colSpan,
    alignment,
    truncate,
    maxLines,
    children,
    render,
    customStyles,
    style,
    ...native
  } = props
  const table = useNativeTable()
  const nativeCellFocus = useContext(NativeCollectionCellFocusContext)
  const layout = useContext(NativeTableColumnResizeStateContext)
  const scope = useNativeKeyScope()
  const [focused, setFocused] = useState(false)
  const [focusVisible, setFocusVisible] = useState(false)
  const content = useNativeContentContext()
  const windowId = useContext(NativeFloatingScopeContext)?.id ?? null
  const theme = useNativeTheme()
  const actions = useContext(NativeCollectionActionsContext)
  const isRowHeader = table.rowHeaderColumns.has(columnID)
  const parent = node.parentKey == null ? null : table.collection.getItem(node.parentKey)
  const siblings = parent ? Array.from(table.collection.getChildren(parent.key)) : []
  const index = siblings.findIndex((candidate) => candidate.key === node.key)
  const rowIndex = table.headerCount + table.rows.findIndex((row) => row.key === parent?.key)
  const headerKey = JSON.stringify(["row", parent?.key, columnID])
  const bindHeader = useCallback(
    (view: View | null) => {
      if (isRowHeader) table.registerHeader(headerKey, view ? (findNodeHandle(view) ?? 0) : 0)
    },
    [isRowHeader, headerKey, table.registerHeader],
  )
  const target = useRef<View | null>(null)
  const width = useRef<number | null>(null)
  const action = useTableAction(node, target)
  const hover = useTableHover(target, action.isActive, native)
  const mergedRef = useTableTargetRef(target, ref, { node, register: table.keyboard.register, header: bindHeader })
  const textAlign = alignment === "Center" ? "center" : alignment === "Right" ? "right" : "auto"
  const authored = resolveNativeStyle([customStyles, style], "TableCell", "style")
  const fluid = !layout && (authored.width == null || authored.width === "auto")
  const styles = splitNativeTextStyle(
    resolveNativeStyle(
      [
        content?.textStyle,
        {
          padding: 5,
          minWidth: 0,
          flexGrow: fluid ? (node.colSpan ?? 1) : 0,
          flexShrink: fluid ? 1 : 0,
          flexBasis: fluid ? 0 : "auto",
          justifyContent: "center",
          color: content?.foregroundColor,
          textAlign,
          overflow: truncate ? "hidden" : "visible",
        },
        authored,
        layout
          ? {
              width: table.collection.columns
                .slice(node.colIndex ?? index, (node.colIndex ?? index) + (node.colSpan ?? 1))
                .reduce((sum, column) => sum + layout.getColumnWidth(column.key), 0),
            }
          : undefined,
      ],
      "TableCell",
      "style",
    ),
  )
  const headers = table.headerTargets.get(JSON.stringify(["column", columnID]))
  const rowHeaders = siblings
    .filter((cell) => table.rowHeaderColumns.has(cell.props.columnID))
    .map((cell) => table.headerTargets.get(JSON.stringify(["row", parent?.key, cell.props.columnID])))
    .filter((value): value is number => !!value)
  let level = 1
  let ancestor = parent?.parentKey == null ? null : table.collection.getItem(parent.parentKey)
  while (ancestor) {
    if (ancestor.type === "item") level++
    ancestor = ancestor.parentKey == null ? null : table.collection.getItem(ancestor.parentKey)
  }
  const lastChild = parent?.lastChildKey == null ? null : table.collection.getItem(parent.lastChildKey)
  const hasChildItems = !!parent?.props.hasChildItems || (!!lastChild && lastChild.type !== "cell")
  const renderState: TNativeTableCellRenderState = {
    // The public source Table selects rows and exposes no cell-action prop.
    isPressed: false,
    isFocused: focused,
    isFocusVisible: focused && focusVisible,
    isHovered: hover.isHovered,
    isSelected: !!parent && table.manager.isSelected(parent.key),
    isDisabled: !!parent && table.manager.isDisabled(parent.key),
    id: node.key,
    columnIndex: node.colIndex || index,
    isTreeColumn: table.collection.columns[node.index]?.key === table.state.treeColumn,
    isExpanded: hasChildItems && !!parent && table.state.expandedKeys.has(parent.key),
    hasChildItems,
    level,
    defaultChildren: undefined,
  }
  const { defaultChildren: _defaultChildren, ...renderValues } = renderState
  const rendered = (
    <NativeTableCellContext.Provider value={{ node, target, width }}>
      <TableCellKeys node={node} target={target} binding={actions?.bindingFor(node) ?? ""} />
      <NativeContentContext.Provider
        value={{
          foregroundColor: styles.text.color ?? theme.colors.foreground,
          isButton: false,
          textStyle: styles.text,
        }}
      >
        <NativeCollectionRendererContext.Provider value={DefaultNativeCollectionRenderer}>
          <NativeTextLayoutContext.Provider value={undefined}>
            <TableCellContent maxLines={maxLines} truncate={truncate} windowId={windowId}>
              {getNativeButtonContent(typeof children === "function" ? children(renderState) : children, styles.text)}
            </TableCellContent>
          </NativeTextLayoutContext.Provider>
        </NativeCollectionRendererContext.Provider>
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
                columnIndex: node.colIndex ?? index,
                rowSpan: 1,
                columnSpan: node.colSpan ?? 1,
                heading: !!isRowHeader,
                selected: parent ? table.manager.isSelected(parent.key) : false,
                rowHeaderTargets: rowHeaders,
                columnHeaderTargets: headers ? [headers] : [],
              })
            : ""
        }
      >
        <NativePressable
          {...nativeViewProps(native)}
          ref={mergedRef}
          accessible
          nativeInteraction={false}
          nativeProgrammaticFocusable
          nativeTabStop={table.manager.focusedKey === node.key}
          nativeRender={(props) => {
            const hostProps = { ...props, capturedKeys: scope ? [] : table.keyboard.keysFor(node.key) }
            return render ? render(hostProps, renderValues) : <NativeFocusView {...hostProps} />
          }}
          onFocus={(event) => {
            if (event.nativeEvent.target !== findNodeHandle(target.current)) return
            if (action.isActive()) nativeCellFocus?.(event)
            setFocused(true)
            setFocusVisible(event.nativeEvent.isFocusVisible)
            table.keyboard.observe(node.key, event)
            native.onFocus?.(event)
          }}
          onBlur={(event) => {
            if (event.nativeEvent.target !== findNodeHandle(target.current)) return
            setFocused(false)
            setFocusVisible(false)
            native.onBlur?.(event)
          }}
          onFocusVisibilityChange={setFocusVisible}
          onPointerEnter={hover.onPointerEnter}
          onPointerLeave={hover.onPointerLeave}
          onKeyDown={table.keyboard.onKeyDown}
          style={{
            ...(focused ? { outlineWidth: focusVisible ? 2 : 1.5, outlineColor: theme.colors.focusRing } : {}),
            ...styles.view,
          }}
        >
          {rendered}
        </NativePressable>
      </NativeCollectionSemanticsContext.Provider>
    </NativeCollectionItemBindingContext.Provider>
  )
}
type TMetadataCellProps = Omit<TNativeTableCellProps, "children"> & {
  children: (state: TNativeTableCellRenderState) => ReactNode
}
const CellMetadata = createNativeCollectionLeaf<object, TMetadataCellProps, View>("cell", Cell)
export const TableCell = forwardRef<View, TNativeTableCellProps>((props, ref) => {
  // Canonical Cell authors a render function; its plain visible text is not collection search metadata.
  const content = useCallback(
    (state: TNativeTableCellRenderState) =>
      typeof props.children === "function" ? props.children(state) : props.children,
    [props.children],
  )
  return (
    <CellMetadata {...props} ref={ref}>
      {content}
    </CellMetadata>
  )
})
export { TableColumn } from "./TableColumn"
