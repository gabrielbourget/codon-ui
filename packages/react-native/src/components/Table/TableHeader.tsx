import { useContext, type ForwardedRef } from "react"
import { View } from "react-native"

import { createNativeCollectionBranch } from "../../collection/CollectionBuilder"
import { NativeCollectionRendererContext } from "../../collection/renderer"
import type { TNativeCollectionNode } from "../../collection/snapshot"
import { nativeViewProps } from "../../input/nativeViewProps"
import { resolveNativeStyle } from "../colors"
import { NativeContentContext, useNativeContentContext } from "../NativeContentContext"
import { splitNativeTextStyle } from "../nativeTextStyle"
import { Text } from "../Text/Text"

import { useNativeTable } from "./context"
import { getNativeTableColumns } from "./rendering"
import { TableColumn } from "./TableCell"
import type { TNativeTableHeaderProps, TNativeTableHeaderComponent } from "./types"

const Header = (
  props: TNativeTableHeaderProps<object>,
  ref: ForwardedRef<View>,
  node: TNativeCollectionNode<object>,
) => {
  const { columns: _columns, style, customStyles, ...native } = props
  const table = useNativeTable()
  const content = useNativeContentContext()
  const renderer = useContext(NativeCollectionRendererContext)
  const styles = splitNativeTextStyle(
    resolveNativeStyle([{ flexDirection: "row" }, customStyles, style], "TableHeader", "style"),
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
export const TableHeader = createNativeCollectionBranch<object, TNativeTableHeaderProps<object>, View>(
  "header",
  Header,
  (props) =>
    getNativeTableColumns(props.columns).map((column) => (
      <TableColumn
        key={column.id}
        id={`header:${column.id}`}
        columnID={column.id}
        accessibilityLabel={column.headerAriaLabel}
        alignment={column.headerAlignment ?? column.alignment}
        customStyles={[
          { width: column.width, minWidth: column.minWidth, maxWidth: column.maxWidth },
          column.customHeaderColumnStyles,
        ]}
      >
        <Text variant="b10" fontWeight="bold" customStyles={column.customHeaderCellStyles}>
          {column.name ?? ""}
        </Text>
      </TableColumn>
    )),
) as TNativeTableHeaderComponent
