import { useContext, type ForwardedRef } from "react"
import { View } from "react-native"

import { useNativeCachedChildren } from "../../collection/cachedChildren"
import { createNativeCollectionBranch } from "../../collection/CollectionBuilder"
import { NativeCollectionRendererContext } from "../../collection/renderer"
import type { TNativeCollectionNode } from "../../collection/snapshot"
import { nativeViewProps } from "../../input/nativeViewProps"
import { getNativeButtonContent } from "../Button/content"
import { resolveNativeStyle } from "../colors"
import { NativeContentContext, useNativeContentContext } from "../NativeContentContext"
import { splitNativeTextStyle } from "../nativeTextStyle"

import { useNativeTable } from "./context"
import { TableRow } from "./TableRow"
import type { TNativeTableBodyProps, TNativeTableBodyComponent } from "./types"

const Body = (props: TNativeTableBodyProps<object>, ref: ForwardedRef<View>, node: TNativeCollectionNode<object>) => {
  const {
    items = [],
    columns: _columns,
    rowKey: _key,
    renderCell: _render,
    geometry: _geometry,
    dependencies: _deps,
    customRowStyles: _rows,
    isLoading,
    renderLoadingState: _loading,
    renderEmptyState,
    style,
    customStyles,
    ...native
  } = props
  const table = useNativeTable()
  const content = useNativeContentContext()
  const renderer = useContext(NativeCollectionRendererContext)
  const styles = splitNativeTextStyle(resolveNativeStyle([customStyles, style], "TableBody", "style"))
  return (
    <View {...nativeViewProps(native)} ref={ref} style={styles.view}>
      <NativeContentContext.Provider
        value={{ foregroundColor: styles.text.color ?? content!.foregroundColor, isButton: false }}
      >
        {!isLoading && items.length === 0 && renderEmptyState ? (
          getNativeButtonContent(renderEmptyState(), styles.text)
        ) : (
          <renderer.CollectionBranch collection={table.collection} parent={node} />
        )}
      </NativeContentContext.Provider>
    </View>
  )
}
export const TableBody = createNativeCollectionBranch<object, TNativeTableBodyProps<object>, View>(
  "body",
  Body,
  (props) => {
    const items = props.items ?? []
    const rows = useNativeCachedChildren({
      items,
      addIdAndValue: true,
      dependencies: [items, props.columns, props.rowKey, props.renderCell, ...(props.dependencies ?? [])],
      children: (row) => (
        <TableRow
          id={props.rowKey ? String(props.rowKey(row)) : undefined}
          item={row}
          columns={props.columns}
          geometry={props.geometry}
          renderCell={props.renderCell}
          customStyles={props.customRowStyles}
        />
      ),
    })
    if (props.isLoading && props.renderLoadingState) return props.renderLoadingState()
    if (!props.isLoading && items.length === 0 && props.renderEmptyState) return null
    return rows
  },
) as TNativeTableBodyComponent
