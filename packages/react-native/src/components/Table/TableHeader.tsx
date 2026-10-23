import { useContext, useInsertionEffect, useRef, type ForwardedRef } from "react"
import { View } from "react-native"

import { createNativeCollectionBranch } from "../../collection/CollectionBuilder"
import { NativeCollectionRendererContext } from "../../collection/renderer"
import type { TNativeCollectionNode } from "../../collection/snapshot"
import { nativeViewProps } from "../../input/nativeViewProps"
import { useNativeTheme } from "../../theme"
import { NativeButton } from "../Button/Button"
import { getNativeButtonContent } from "../Button/content"
import { resolveNativeStyle } from "../colors"
import { NativeContentContext, useNativeContentContext } from "../NativeContentContext"
import { splitNativeTextStyle } from "../nativeTextStyle"
import { QueryGlyph } from "../SortAndFilterPanel/glyphs"
import { Text } from "../Text/Text"

import { NativeTableCellContext, NativeTableOptionsContext, useNativeTable } from "./context"
import { TABLE_SORT_DIRECTION__ASCENDING } from "./queryTypes"
import { getNativeTableColumns } from "./rendering"
import { TableSelectionCheckbox } from "./SelectionCheckbox"
import { computeNextNativeTableSorts } from "./sorting"
import { TableColumn } from "./TableCell"
import type { TNativeTableHeaderProps, TNativeTableHeaderComponent, TNativeTableColumnMetadata } from "./types"
import { useTableAction } from "./useTableAction"

const HeaderContent = ({ column }: { column: TNativeTableColumnMetadata<object> }) => {
  const table = useNativeTable()
  const cell = useContext(NativeTableCellContext)!
  const action = useTableAction(cell.node, cell.target)
  const currentColumn = useRef(column)
  useInsertionEffect(() => {
    currentColumn.current = column
  })
  const theme = useNativeTheme()
  const content = useNativeContentContext()
  const sorting = table.queryControls?.sorting
  const sortable = !!sorting && !!column.sort?.enabled
  const direction = sortable
    ? sorting.activeSorts.find((sort) => sort.criteriaID === column.sort!.criteriaID)?.sortDirection
    : undefined
  const name = (
    <Text
      variant="b10"
      fontWeight="bold"
      numberOfLines={1}
      customStyles={[
        { minWidth: 0, flexShrink: 1 },
        column.headerVisuallyHidden ? { position: "absolute", width: 1, height: 1, overflow: "hidden" } : undefined,
        column.customHeaderCellStyles,
      ]}
    >
      {column.name ?? ""}
    </Text>
  )
  if (!sortable) return name
  const ascending = direction === TABLE_SORT_DIRECTION__ASCENDING
  const color = theme.colors.controlSelectedBackground
  return (
    <View
      style={{
        width: "100%",
        minWidth: 0,
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        justifyContent:
          (column.headerAlignment ?? column.alignment) === "Center"
            ? "center"
            : (column.headerAlignment ?? column.alignment) === "Right"
              ? "flex-end"
              : "flex-start",
      }}
    >
      <NativeButton
        accessibilityLabel={column.name ?? ""}
        onPress={() =>
          action.request((next) => {
            const owner = next.queryControls?.sorting
            const metadata = currentColumn.current
            if (owner && metadata.sort?.enabled)
              owner.onSortChange(
                computeNextNativeTableSorts({ activeSorts: owner.activeSorts, column: metadata, mode: owner.mode }),
              )
          })
        }
        nativeStyle={(flags, visible) => ({
          viewStyle: {
            minWidth: 0,
            maxWidth: "100%",
            flexShrink: 1,
            padding: 0,
            borderWidth: 0,
            backgroundColor: "transparent",
            alignItems: "center",
            overflow: "hidden",
            ...(flags.isFocused && visible
              ? { outlineWidth: 2, outlineOffset: 2, outlineColor: theme.colors.focusRing }
              : {}),
          },
          textStyle: {},
          foregroundColor: content!.foregroundColor,
          target: 0,
        })}
      >
        {name}
      </NativeButton>
      {direction && (
        <View
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ flexShrink: 0 }}
        >
          {getNativeButtonContent(
            (ascending ? sorting.icons?.ascending : sorting.icons?.descending) ?? (
              <QueryGlyph kind={ascending ? "ascending" : "descending"} size={14} color={color} />
            ),
            { color },
          )}
        </View>
      )}
    </View>
  )
}

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
  (props) => {
    const options = useContext(NativeTableOptionsContext)
    return (
      <>
        {options.behavior === "toggle" && (
          <TableColumn id="header:__selection" columnID="__selection" style={{ width: 30, padding: 0 }}>
            {options.mode === "multiple" && <TableSelectionCheckbox all />}
          </TableColumn>
        )}
        {getNativeTableColumns(props.columns).map((column) => (
          <TableColumn
            key={column.id}
            id={`header:${column.id}`}
            columnID={column.id}
            isRowHeader={column.isRowHeader}
            allowsSorting={options.sortingEnabled && !!column.sort?.enabled}
            accessibilityLabel={column.headerAriaLabel}
            alignment={column.headerAlignment ?? column.alignment}
            customStyles={[
              { width: column.width, minWidth: column.minWidth, maxWidth: column.maxWidth },
              column.customHeaderColumnStyles,
            ]}
          >
            <HeaderContent column={column} />
          </TableColumn>
        ))}
      </>
    )
  },
) as TNativeTableHeaderComponent
