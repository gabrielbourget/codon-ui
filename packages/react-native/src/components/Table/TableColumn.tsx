import { createContext, useCallback, useContext, useId, useRef, type ForwardedRef, type RefObject } from "react"
import { findNodeHandle, type TextStyle, type View } from "react-native"

import { NativeCollectionActionsContext } from "../../collection/actions"
import { NativeCollectionItemBindingContext } from "../../collection/binding"
import { createNativeCollectionLeaf } from "../../collection/CollectionBuilder"
import { DefaultNativeCollectionRenderer, NativeCollectionRendererContext } from "../../collection/renderer"
import { NativeCollectionSemanticsContext } from "../../collection/semantics"
import type { TNativeCollectionNode } from "../../collection/snapshot"
import { nativeKeyTokens } from "../../input/keyScope"
import { NativeFocusView } from "../../input/NativeFocusView"
import { useNativeKeyScope } from "../../input/NativeKeyboardScope"
import { nativeViewProps } from "../../input/nativeViewProps"
import { useNativeTheme } from "../../theme"
import { NativeButton } from "../Button/Button"
import { getNativeButtonContent } from "../Button/content"
import { resolveNativeStyle } from "../colors"
import { NativeContentContext, useNativeContentContext } from "../NativeContentContext"
import { splitNativeTextStyle } from "../nativeTextStyle"

import { NativeTableCellContext, useNativeTable } from "./context"
import { NativeTableColumnResizeStateContext } from "./NativeResizableTableContainer"
import { TableCellKeys } from "./TableCellKeys"
import type { TNativeTableColumnProps, TNativeTableColumnRenderState } from "./types"
import { useTableAction } from "./useTableAction"
import { useTableHover } from "./useTableHover"
import { useTableTargetRef } from "./useTableTargetRef"

export const NativeTableColumnContext = createContext<{
  node: TNativeCollectionNode<object>
  target: RefObject<View | null>
  nativeID: string
} | null>(null)

const Column = (props: TNativeTableColumnProps, ref: ForwardedRef<View>, node: TNativeCollectionNode<object>) => {
  const {
    id: _id,
    textValue: _text,
    columnID,
    isRowHeader: _header,
    allowsSorting,
    alignment,
    width: _width,
    defaultWidth: _defaultWidth,
    minWidth: _minimum,
    maxWidth: _maximum,
    children,
    render,
    style,
    customStyles,
    onFocus,
    onBlur,
    onKeyDown,
    onKeyUp,
    ...native
  } = props
  const table = useNativeTable(),
    scope = useNativeKeyScope(),
    theme = useNativeTheme(),
    content = useNativeContentContext()
  const layout = useContext(NativeTableColumnResizeStateContext)
  const actions = useContext(NativeCollectionActionsContext)
  const target = useRef<View | null>(null),
    measuredWidth = useRef<number | null>(null)
  const generated = useId()
  const nativeID = props.nativeID ?? `codon-column-${generated}`
  const bindHeader = useCallback(
    (view: View | null) =>
      table.registerHeader(JSON.stringify(["column", columnID]), view ? (findNodeHandle(view) ?? 0) : 0),
    [table.registerHeader, columnID],
  )
  const mergedRef = useTableTargetRef(target, ref, { node, register: table.keyboard.register, header: bindHeader })
  const action = useTableAction(node, target)
  const hover = useTableHover(target, () => action.isActive() && !!allowsSorting, native)
  const index = table.collection.columns.findIndex((column) => column.key === node.key)
  return (
    <NativeCollectionItemBindingContext.Provider value={actions?.bindingFor(node) ?? ""}>
      <NativeCollectionSemanticsContext.Provider
        value={
          table.target && index >= 0
            ? JSON.stringify({
                kind: "cell",
                parentTarget: table.target,
                rowIndex: 0,
                columnIndex: node.colIndex ?? index,
                rowSpan: 1,
                columnSpan: node.colSpan ?? 1,
                heading: true,
                selected: false,
                rowHeaderTargets: [],
                columnHeaderTargets: [],
              })
            : ""
        }
      >
        <NativeButton
          {...nativeViewProps(native)}
          ref={mergedRef}
          nativeRole="columnheader"
          nativeInteraction={!!allowsSorting}
          nativeProgrammaticFocusable
          nativeTabStop={table.manager.focusedKey === node.key}
          onKeyDown={(event) => {
            onKeyDown?.(event)
            table.keyboard.captureTypeahead(event)
          }}
          onKeyUp={onKeyUp}
          onFocus={(event) => {
            table.keyboard.observe(node.key, event)
            onFocus?.(event)
          }}
          onBlur={onBlur}
          onLayout={(event) => {
            measuredWidth.current = event.nativeEvent.layout.width
            native.onLayout?.(event)
          }}
          onPointerEnter={hover.onPointerEnter}
          onPointerLeave={hover.onPointerLeave}
          onPress={() =>
            action.request((current, column) => {
              if (column.props.allowsSorting) current.sortColumn(column.key)
            })
          }
          accessibilityValue={
            allowsSorting
              ? { text: table.primarySort?.column === node.key ? table.primarySort.direction : "none" }
              : native.accessibilityValue
          }
          nativeStyle={(flags, visible) => ({
            viewStyle: {
              ...(flags.isFocused && visible ? { outlineWidth: 2, outlineColor: theme.colors.focusRing } : {}),
            },
            textStyle: {},
            foregroundColor: content?.foregroundColor ?? theme.colors.foreground,
            target: 0,
          })}
          nativeRender={(host, flags) => {
            const values: TNativeTableColumnRenderState = {
              isHovered: hover.isHovered,
              isPressed: flags.isPressed,
              isFocused: flags.isFocused,
              isFocusVisible: flags.isFocusVisible,
              allowsSorting,
              sortDirection:
                table.state.sortDescriptor?.column === node.key ? table.state.sortDescriptor.direction : undefined,
              isResizing: layout?.resizingColumn === node.key,
              sort: (direction) => action.request((current, column) => current.state.sort(column.key, direction)),
              startResize: () => {
                if (!layout)
                  throw new Error("Wrap your <Table> in a <ResizableTableContainer> to enable column resizing")
                action.request((current, column) => {
                  layout.startResize(column.key)
                  current.state.setKeyboardNavigationDisabled(true)
                })
              },
            }
            const authored = resolveNativeStyle<TextStyle>(
              [customStyles, typeof style === "function" ? style({ ...values, defaultStyle: {} }) : style],
              "TableColumn",
              "style",
            )
            const fluid = !layout && (authored.width == null || authored.width === "auto")
            const styles = splitNativeTextStyle(
              resolveNativeStyle<TextStyle>(
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
                    textAlign: alignment === "Center" ? "center" : alignment === "Right" ? "right" : "auto",
                  },
                  host.style,
                  authored,
                  layout ? { width: layout.getColumnWidth(node.key) } : undefined,
                ],
                "TableColumn",
                "style",
              ),
            )
            const hostProps = {
              ...host,
              nativeID,
              style: styles.view,
              capturedKeys: [
                ...(scope ? [] : table.keyboard.keysFor(node.key)),
                ...(allowsSorting ? ["Enter", " "].flatMap(nativeKeyTokens) : []),
              ],
              onKeyDown: (event: Parameters<NonNullable<typeof host.onKeyDown>>[0]) => {
                host.onKeyDown?.(event)
                table.keyboard.onKeyDown(event)
              },
              children: (
                <NativeTableColumnContext.Provider value={{ node, target, nativeID }}>
                  <NativeTableCellContext.Provider value={{ node, target, width: measuredWidth }}>
                    <TableCellKeys node={node} target={target} binding={actions?.bindingFor(node) ?? ""} />
                    <NativeContentContext.Provider
                      value={{
                        foregroundColor: styles.text.color ?? theme.colors.foreground,
                        isButton: false,
                        textStyle: styles.text,
                      }}
                    >
                      <NativeCollectionRendererContext.Provider value={DefaultNativeCollectionRenderer}>
                        {getNativeButtonContent(
                          typeof children === "function"
                            ? children({ ...values, defaultChildren: undefined })
                            : children,
                          styles.text,
                        )}
                      </NativeCollectionRendererContext.Provider>
                    </NativeContentContext.Provider>
                  </NativeTableCellContext.Provider>
                </NativeTableColumnContext.Provider>
              ),
            }
            return render ? render(hostProps, values) : <NativeFocusView {...hostProps} />
          }}
        />
      </NativeCollectionSemanticsContext.Provider>
    </NativeCollectionItemBindingContext.Provider>
  )
}
export const TableColumn = createNativeCollectionLeaf<object, TNativeTableColumnProps, View>("column", Column)
