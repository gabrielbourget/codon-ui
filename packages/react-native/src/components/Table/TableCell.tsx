import { useCallback, useContext, type ForwardedRef } from "react"
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

import { useNativeTable } from "./context"
import type { TNativeTableCellProps, TNativeTableColumnProps } from "./types"

const Cell = (props: TNativeTableCellProps, ref: ForwardedRef<View>, node: TNativeCollectionNode<object>) => {
  const { id: _id, columnID, alignment, children, customStyles, style, ...native } = props
  const table = useNativeTable()
  const content = useNativeContentContext()
  const theme = useNativeTheme()
  const actions = useContext(NativeCollectionActionsContext)
  const heading = node.type === "column"
  const parent = node.parentKey == null ? null : table.collection.getItem(node.parentKey)
  const siblings = parent ? Array.from(table.collection.getChildren(parent.key)) : []
  const index = siblings.findIndex((candidate) => candidate.key === node.key)
  const rowIndex = heading ? 0 : table.headerCount + table.rows.findIndex((row) => row.key === parent?.key)
  const bindHeader = useCallback(
    (view: View | null) => {
      if (heading) table.registerHeader(columnID, view ? (findNodeHandle(view) ?? 0) : 0)
    },
    [heading, columnID, table.registerHeader],
  )
  const mergedRef = useNativeCollectionRefs(ref, bindHeader)
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
  const headers = table.headerTargets.get(columnID)
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
                heading,
                selected: false,
                rowHeaderTargets: [],
                columnHeaderTargets: !heading && headers ? [headers] : [],
              })
            : ""
        }
      >
        <NativeFocusHost {...nativeViewProps(native)} ref={mergedRef} accessible focusable={false} style={styles.view}>
          <NativeContentContext.Provider
            value={{ foregroundColor: styles.text.color ?? theme.colors.foreground, isButton: false }}
          >
            {getNativeButtonContent(children, styles.text)}
          </NativeContentContext.Provider>
        </NativeFocusHost>
      </NativeCollectionSemanticsContext.Provider>
    </NativeCollectionItemBindingContext.Provider>
  )
}
export const TableCell = createNativeCollectionLeaf<object, TNativeTableCellProps, View>("cell", Cell)
export const TableColumn = createNativeCollectionLeaf<object, TNativeTableColumnProps, View>("column", Cell)
