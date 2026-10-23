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
import { TableFilterGlyph } from "./filterGlyphs"
import { TABLE_SORT_DIRECTION__ASCENDING } from "./queryTypes"
import { getNativeTableColumns } from "./rendering"
import { TableSelectionCheckbox } from "./SelectionCheckbox"
import { computeNextNativeTableSorts } from "./sorting"
import { TableColumn } from "./TableCell"
import { TableColumnResizer } from "./TableColumnResizer"
import { TableFilterPopover } from "./TableFilterPopover"
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
  const filtering = table.queryControls?.filtering
  const mode = filtering?.mode ?? (filtering?.onFilterIconPress ? "external" : undefined)
  const filterable =
    !!column.filter?.enabled &&
    !column.headerVisuallyHidden &&
    ((mode === "external" && !!filtering?.onFilterIconPress) || (mode === "popover" && !!filtering?.onFiltersChange))
  const group = filterable
    ? filtering?.activeFilters.find((item) => item.criteriaID === column.filter!.criteriaID)
    : undefined
  const filterActive = !!group?.clauses.length
  const filterColor = filterActive ? theme.colors.controlSelectedBackground : theme.colors.controlForeground
  const filterIcon = (filterActive ? filtering?.icons?.active : filtering?.icons?.inactive) ?? (
    <TableFilterGlyph active={filterActive} color={filterColor} />
  )
  const filter = !filterable ? null : mode === "popover" && filtering?.onFiltersChange ? (
    <TableFilterPopover
      column={column}
      filterGroup={group}
      activeFilters={filtering.activeFilters}
      onFiltersChange={filtering.onFiltersChange}
      isFilterActive={filterActive}
      activeFilterIcon={
        filtering.icons?.active ?? <TableFilterGlyph active color={theme.colors.controlSelectedBackground} />
      }
      inactiveFilterIcon={
        filtering.icons?.inactive ?? <TableFilterGlyph active={false} color={theme.colors.controlForeground} />
      }
      labels={table.filteringLabels}
      requestOpen={(run) => {
        action.request(() => run())
      }}
    />
  ) : (
    <NativeButton
      accessibilityLabel={table.filteringLabels.popover.triggerButtonAriaLabel({
        criteriaName: column.name ?? column.id,
      })}
      accessibilityState={{ checked: filterActive }}
      nativeStyle={(flags, visible) => ({
        viewStyle: {
          padding: 2,
          borderWidth: 0,
          borderRadius: 3,
          backgroundColor: "transparent",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          ...(flags.isFocused && visible
            ? { outlineWidth: 2, outlineOffset: 1, outlineColor: theme.colors.focusRing }
            : {}),
        },
        textStyle: {},
        foregroundColor: filterColor,
        target: 0,
      })}
      onPress={() =>
        action.request((next) => {
          const controls = next.queryControls?.filtering
          const metadata = currentColumn.current
          if (
            !metadata.filter?.enabled ||
            metadata.headerVisuallyHidden ||
            !controls?.onFilterIconPress ||
            (controls.mode !== undefined && controls.mode !== "external")
          )
            return
          controls.onFilterIconPress({
            columnID: metadata.id,
            columnName: metadata.name ?? metadata.id,
            filterGroup: controls.activeFilters.find((item) => item.criteriaID === metadata.filter!.criteriaID),
          })
        })
      }
    >
      {getNativeButtonContent(filterIcon, { color: filterColor })}
    </NativeButton>
  )
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
  if (!sortable && !filterable) return name
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
      {sortable ? (
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
      ) : (
        name
      )}
      {filter}
      {direction && (
        <View
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ flexShrink: 0 }}
        >
          {getNativeButtonContent(
            (ascending ? sorting?.icons?.ascending : sorting?.icons?.descending) ?? (
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
        {getNativeTableColumns(props.columns).map((column) => {
          const custom = resolveNativeStyle(column.customHeaderColumnStyles, "TableHeader", "customHeaderColumnStyles")
          const reserveEnd =
            options.resizingEnabled &&
            !column.headerVisuallyHidden &&
            custom.padding === undefined &&
            custom.paddingHorizontal === undefined
          return (
            <TableColumn
              key={column.id}
              id={`header:${column.id}`}
              columnID={column.id}
              isRowHeader={column.isRowHeader}
              allowsSorting={options.sortingEnabled && !!column.sort?.enabled}
              accessibilityLabel={column.headerAriaLabel ?? column.name}
              alignment={column.headerAlignment ?? column.alignment}
              customStyles={[
                reserveEnd ? { paddingEnd: 11 } : undefined,
                { width: column.width, minWidth: column.minWidth, maxWidth: column.maxWidth },
                custom,
              ]}
            >
              <HeaderContent column={column} />
              {options.resizingEnabled && !column.headerVisuallyHidden && <TableColumnResizer column={column} />}
            </TableColumn>
          )
        })}
      </>
    )
  },
) as TNativeTableHeaderComponent
