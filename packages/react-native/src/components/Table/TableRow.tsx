import { useContext, useId, type ForwardedRef } from "react"
import { View } from "react-native"

import { createNativeCollectionBranch } from "../../collection/CollectionBuilder"
import { NativeCollectionRendererContext } from "../../collection/renderer"
import type { TNativeCollectionNode } from "../../collection/snapshot"
import { nativeViewProps } from "../../input/nativeViewProps"
import { useNativeTheme } from "../../theme"
import { encodeCollectionKey } from "../collection"
import { resolveNativeStyle } from "../colors"
import { NativeContentContext, useNativeContentContext } from "../NativeContentContext"
import { splitNativeTextStyle } from "../nativeTextStyle"

import { useNativeTable } from "./context"
import { getNativeTableColumns, renderNativeTableValue } from "./rendering"
import { TableCell } from "./TableCell"
import type { TNativeTableRowComponent, TNativeTableRowProps } from "./types"

const Row = (props: TNativeTableRowProps<object>, ref: ForwardedRef<View>, node: TNativeCollectionNode<object>) => {
  const {
    id: _id,
    item: _item,
    columns: _columns,
    renderCell: _render,
    geometry: _geometry,
    dependencies: _deps,
    style,
    customStyles,
    ...native
  } = props
  const table = useNativeTable()
  const content = useNativeContentContext()
  const renderer = useContext(NativeCollectionRendererContext)
  const ordinal = table.rows.findIndex((row) => row.key === node.key)
  const styles = splitNativeTextStyle(
    resolveNativeStyle(
      [
        { flexDirection: "row", backgroundColor: table.zebra && ordinal % 2 === 1 ? table.zebraColor : "transparent" },
        customStyles,
        style,
      ],
      "TableRow",
      "style",
    ),
  )
  return (
    <View {...nativeViewProps(native)} ref={ref} style={styles.view}>
      <NativeContentContext.Provider
        value={{ foregroundColor: styles.text.color ?? content!.foregroundColor, isButton: false }}
      >
        <renderer.CollectionBranch collection={table.collection} parent={node} />
      </NativeContentContext.Provider>
    </View>
  )
}
export const TableRow = createNativeCollectionBranch<object, TNativeTableRowProps<object>, View>(
  "item",
  Row,
  (props) => {
    const generated = useId()
    const theme = useNativeTheme()
    const columns = getNativeTableColumns(props.columns)
    const radius = props.geometry === "orthogonal" ? 0 : props.geometry === "round" ? 10000 : theme.radius.rounded
    return columns.map((column, index) => (
      <TableCell
        key={column.id}
        id={`${encodeCollectionKey(props.id ?? generated)}:${column.id}`}
        columnID={column.id}
        alignment={column.alignment}
        customStyles={[
          {
            width: column.width,
            minWidth: column.minWidth,
            maxWidth: column.maxWidth,
            borderTopLeftRadius: index === 0 ? radius : 0,
            borderBottomLeftRadius: index === 0 ? radius : 0,
            borderTopRightRadius: index === columns.length - 1 ? radius : 0,
            borderBottomRightRadius: index === columns.length - 1 ? radius : 0,
          },
          column.customBodyCellStyles,
        ]}
      >
        {column.cellRenderer
          ? column.cellRenderer({ row: props.item, column })
          : (props.renderCell ?? renderNativeTableValue)({ row: props.item, column })}
      </TableCell>
    ))
  },
) as TNativeTableRowComponent
