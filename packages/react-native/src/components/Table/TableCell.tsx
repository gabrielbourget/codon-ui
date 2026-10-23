import {
  forwardRef,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ForwardedRef,
  type ReactNode,
} from "react"
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
import { NativePressable } from "../../input/NativePressable"
import { nativeViewProps } from "../../input/nativeViewProps"
import { useNativeTheme } from "../../theme"
import { NativeButton } from "../Button/Button"
import { getNativeButtonContent } from "../Button/content"
import { resolveNativeStyle } from "../colors"
import { NativeContentContext, useNativeContentContext } from "../NativeContentContext"
import { splitNativeTextStyle } from "../nativeTextStyle"

import { NativeTableCellContext, useNativeTable } from "./context"
import { TableCellKeys } from "./TableCellKeys"
import type { TNativeTableCellProps, TNativeTableColumnProps, TNativeTableCellRenderState } from "./types"
import { useTableAction } from "./useTableAction"

const Cell = (
  props: TNativeTableCellProps & Pick<TNativeTableColumnProps, "isRowHeader" | "allowsSorting">,
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
  const [focused, setFocused] = useState(false)
  const [focusVisible, setFocusVisible] = useState(false)
  const [hovered, setHovered] = useState(false)
  useLayoutEffect(
    () =>
      scope?.subscribe(() => {
        if (scope.isWindowActive() === false) setHovered(false)
      }),
    [scope],
  )
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
  let level = 1
  let ancestor = parent?.parentKey == null ? null : table.collection.getItem(parent.parentKey)
  while (ancestor) {
    if (ancestor.type === "item") level++
    ancestor = ancestor.parentKey == null ? null : table.collection.getItem(ancestor.parentKey)
  }
  const lastChild = parent?.lastChildKey == null ? null : table.collection.getItem(parent.lastChildKey)
  const renderState: TNativeTableCellRenderState = {
    // The public source Table selects rows and exposes no cell-action prop.
    isPressed: false,
    isFocused: focused,
    isFocusVisible: focused && focusVisible,
    isHovered: hovered,
    isSelected: !!parent && table.manager.isSelected(parent.key),
    isDisabled: !!parent && table.manager.isDisabled(parent.key),
    id: node.key,
    columnIndex: index,
    isTreeColumn: false,
    isExpanded: false,
    hasChildItems: !!parent?.props.hasChildItems || (!!lastChild && lastChild.type !== "cell"),
    level,
    defaultChildren: undefined,
  }
  const rendered = (
    <NativeTableCellContext.Provider value={{ node, target, width }}>
      <TableCellKeys node={node} target={target} binding={actions?.bindingFor(node) ?? ""} />
      <NativeContentContext.Provider
        value={{ foregroundColor: styles.text.color ?? theme.colors.foreground, isButton: false }}
      >
        {getNativeButtonContent(typeof children === "function" ? children(renderState) : children, styles.text)}
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
          <NativePressable
            {...nativeViewProps(native)}
            ref={mergedRef}
            accessible
            nativeInteraction={false}
            nativeProgrammaticFocusable
            nativeTabStop={table.manager.focusedKey === node.key}
            nativeRender={(props) => (
              <NativeFocusHost {...props} capturedKeys={scope ? [] : table.keyboard.keysFor(node.key)} />
            )}
            onFocus={(event) => {
              if (event.nativeEvent.target !== findNodeHandle(target.current)) return
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
            onPointerEnter={(event) => {
              native.onPointerEnter?.(event)
              if (event.nativeEvent.pointerType !== "touch" && action.isActive()) setHovered(true)
            }}
            onPointerLeave={(event) => {
              native.onPointerLeave?.(event)
              if (event.nativeEvent.pointerType !== "touch") setHovered(false)
            }}
            onKeyDown={table.keyboard.onKeyDown}
            style={{
              ...(focused ? { outlineWidth: focusVisible ? 2 : 1.5, outlineColor: theme.colors.focusRing } : {}),
              ...styles.view,
            }}
          >
            {rendered}
          </NativePressable>
        )}
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
export const TableColumn = createNativeCollectionLeaf<object, TNativeTableColumnProps, View>("column", Cell)
