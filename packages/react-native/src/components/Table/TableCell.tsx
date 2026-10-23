import { useCallback, useContext, useRef, type ForwardedRef } from "react"
import type { View } from "react-native"
import { findNodeHandle } from "react-native"

import { NativeCollectionActionsContext } from "../../collection/actions"
import { NativeCollectionItemBindingContext } from "../../collection/binding"
import { createNativeCollectionLeaf } from "../../collection/CollectionBuilder"
import { useNativeCollectionRefs } from "../../collection/context"
import { NativeCollectionSemanticsContext } from "../../collection/semantics"
import type { TNativeCollectionNode } from "../../collection/snapshot"
import { NativeFocusHost } from "../../input/NativeFocusView"
import { nativeViewProps } from "../../input/nativeViewProps"
import { useNativeTheme } from "../../theme"
import { getNativeButtonContent } from "../Button/content"
import { resolveNativeStyle } from "../colors"
import { NativeContentContext, useNativeContentContext } from "../NativeContentContext"
import { splitNativeTextStyle } from "../nativeTextStyle"

import { NativeTableCellContext, useNativeTable } from "./context"
import type { TNativeTableCellProps, TNativeTableColumnProps } from "./types"

const Cell = (
  props: TNativeTableCellProps & Pick<TNativeTableColumnProps, "isRowHeader">,
  ref: ForwardedRef<View>,
  node: TNativeCollectionNode<object>,
) => {
  const { id: _id, columnID, isRowHeader: _columnHeader, alignment, children, customStyles, style, ...native } = props
  const table = useNativeTable()
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
  const originalRef = useNativeCollectionRefs(target, bindHeader)
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
        <NativeFocusHost {...nativeViewProps(native)} ref={mergedRef} accessible focusable={false} style={styles.view}>
          <NativeTableCellContext.Provider value={{ node, target }}>
            <NativeContentContext.Provider
              value={{ foregroundColor: styles.text.color ?? theme.colors.foreground, isButton: false }}
            >
              {getNativeButtonContent(children, styles.text)}
            </NativeContentContext.Provider>
          </NativeTableCellContext.Provider>
        </NativeFocusHost>
      </NativeCollectionSemanticsContext.Provider>
    </NativeCollectionItemBindingContext.Provider>
  )
}
export const TableCell = createNativeCollectionLeaf<object, TNativeTableCellProps, View>("cell", Cell)
export const TableColumn = createNativeCollectionLeaf<object, TNativeTableColumnProps, View>("column", Cell)
