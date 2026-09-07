import classNames from "classnames"
import type { PointerEvent } from "react"
import { TableHeader as AdobeTableHeader, useTableOptions } from "react-aria-components"

import { ALIGNMENT__CENTER, ALIGNMENT__RIGHT } from "../../../../tokens/alignment"
import Checkbox from "../../../Checkbox/Checkbox"
import { DEFAULT_TABLE_FILTERING_LABELS } from "../../../Filtering/labels"
import Text from "../../../Text/Text"
import {
  computeNextTableSorts,
  getTableColumnWidth,
  resizeTableColumn,
  normalizeTableColumns,
  TABLE_FILTERING_CONTROL_MODE__EXTERNAL,
  TABLE_FILTERING_CONTROL_MODE__POPOVER,
  type TTableColumnMetadata,
} from "../../helpers"
import { DEFAULT_TABLE_LABELS } from "../../labels"
import { TABLE_SORT_DIRECTION__ASCENDING } from "../../queryTypes"
import { useTableContext } from "../../TableContext"
import tableStyles from "../../TableStyles.module.css"
import TableColumn from "../TableColumn/TableColumn"
import TableFilterPopover from "../TableFilterPopover/TableFilterPopover"

import { calibrateFilterIcons, calibrateSortIcons, type TTableHeaderProps } from "./helpers"
import styles from "./TableHeaderStyles.module.css"

const {
  tableHeader__filterButton,
  ["tableHeader__filterButton--active"]: tableHeader__filterButtonActive,
  tableHeader__sortIndicator,
  ["tableHeader__sortIndicator--active"]: tableHeader__sortIndicatorActive,
  tableHeader__cellLabel,
  tableHeader__resizeHandle,
  tableHeader__cell,
  ["tableHeader__cell--sortable"]: tableHeader__cellSortable,
  ["tableHeader__cell--resizable"]: tableHeader__cellResizable,
  ["tableHeader__cell--alignCenter"]: tableHeader__cellAlignCenter,
  ["tableHeader__cell--alignEnd"]: tableHeader__cellAlignEnd,
  tableHeader__cellInner,
  tableHeader__sortButton,
  tableHeader__iconGroup,
} = styles

const TableHeader = <T extends object>(props: TTableHeaderProps<T>) => {
  const { className, columns, customClassName, customStyles, style, ...rest } = props
  const { selectionBehavior, selectionMode, allowsDragging } = useTableOptions()
  const {
    queryControls,
    columnResizing,
    filteringLabels = DEFAULT_TABLE_FILTERING_LABELS,
    labels = DEFAULT_TABLE_LABELS,
  } = useTableContext()

  const sortingEnabled = !!queryControls?.sorting
  const filteringControls = queryControls?.filtering
  const filteringMode =
    filteringControls?.mode ??
    (filteringControls?.onFilterIconPress ? TABLE_FILTERING_CONTROL_MODE__EXTERNAL : undefined)
  const externalFilteringEnabled =
    filteringMode === TABLE_FILTERING_CONTROL_MODE__EXTERNAL && !!filteringControls?.onFilterIconPress
  const popoverFilteringEnabled =
    filteringMode === TABLE_FILTERING_CONTROL_MODE__POPOVER && !!filteringControls?.onFiltersChange
  const filteringEnabled = externalFilteringEnabled || popoverFilteringEnabled
  const { ascendingIcon, descendingIcon } = calibrateSortIcons(queryControls?.sorting?.icons)
  const { inactiveFilterIcon, activeFilterIcon } = calibrateFilterIcons(filteringControls?.icons)
  const { visibleColumns } = normalizeTableColumns(columns)
  const tableHeaderStyles = classNames(customClassName, className)
  const tableHeaderStyle = Object.assign({}, { ...customStyles }, { ...style })

  return (
    <AdobeTableHeader {...rest} className={tableHeaderStyles} style={tableHeaderStyle}>
      {allowsDragging && <TableColumn id="__drag" style={{ width: 30 }} />}
      {selectionBehavior === "toggle" && (
        // -> Explicit width keeps table-layout:fixed from handing leftover space to this column.
        //   -> order=primary + showIcon=false gives three distinct visual states:
        //   -> unchecked: empty box with primary border
        //   -> indeterminate (partial selection): primary-filled box + white horizontal bar
        //   -> checked (all selected): primary-filled box (no icon — same as row checkboxes)
        <TableColumn id="__selection" style={{ width: 30 }}>
          {selectionMode === "multiple" ? (
            <Checkbox aria-label={labels.selection.selectAllRowsAriaLabel} slot="selection" showIcon={false} />
          ) : null}
        </TableColumn>
      )}

      {visibleColumns.map((column: TTableColumnMetadata<T>) => {
        const hiddenStyle = column.headerVisuallyHidden ? tableStyles.screenReaderOnly : undefined
        const headerAlignment = column.headerAlignment ?? column.alignment ?? undefined
        const columnAllowsSorting = sortingEnabled && !!column.sort?.enabled
        const columnAllowsFiltering = filteringEnabled && !!column.filter?.enabled && !column.headerVisuallyHidden
        const columnAllowsResizing = Boolean(columnResizing?.enabled && !column.headerVisuallyHidden)
        const needsInnerWrapper = columnAllowsSorting || columnAllowsFiltering

        const activeSort = columnAllowsSorting
          ? queryControls?.sorting?.activeSorts.find((s) => s.criteriaID === column.sort!.criteriaID)
          : undefined
        const sortDirection = activeSort?.sortDirection

        const activeFilterGroup = columnAllowsFiltering
          ? filteringControls?.activeFilters.find((fg) => fg.criteriaID === column.filter!.criteriaID)
          : undefined
        const isFilterActive = !!activeFilterGroup?.clauses.length
        const filterButtonClassName = classNames(
          tableHeader__filterButton,
          isFilterActive && tableHeader__filterButtonActive,
        )
        const sortIndicatorClassName = classNames(
          tableHeader__sortIndicator,
          sortDirection && tableHeader__sortIndicatorActive,
        )
        const onSortPress = () => {
          if (!columnAllowsSorting || !queryControls?.sorting) return

          queryControls.sorting.onSortChange(
            computeNextTableSorts({
              activeSorts: queryControls.sorting.activeSorts,
              column,
              mode: queryControls.sorting.mode,
            }),
          )
        }
        const onResizePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
          if (!columnAllowsResizing || !columnResizing) return

          event.preventDefault()
          event.stopPropagation()

          const startX = event.clientX
          const startWidth = getTableColumnWidth(event.currentTarget, column)

          const onPointerMove = (moveEvent: globalThis.PointerEvent) => {
            resizeTableColumn(column, columnResizing, startWidth + moveEvent.clientX - startX)
          }
          const onPointerUp = () => {
            window.removeEventListener("pointermove", onPointerMove)
            window.removeEventListener("pointerup", onPointerUp)
          }

          window.addEventListener("pointermove", onPointerMove)
          window.addEventListener("pointerup", onPointerUp)
        }
        const nameText = (
          <Text
            customClassName={classNames(tableHeader__cellLabel, hiddenStyle, column.customHeaderCellClassName)}
            customStyles={{ ...column.customHeaderCellStyles }}
            elementType="span"
            variant="b10"
            fontWeight="bold"
          >
            {column.name ?? ""}
          </Text>
        )
        const filterControl = columnAllowsFiltering ? (
          filteringMode === TABLE_FILTERING_CONTROL_MODE__POPOVER && filteringControls?.onFiltersChange ? (
            <TableFilterPopover<T>
              column={column}
              filterGroup={activeFilterGroup}
              activeFilters={filteringControls.activeFilters}
              onFiltersChange={filteringControls.onFiltersChange}
              isFilterActive={isFilterActive}
              activeFilterIcon={activeFilterIcon}
              inactiveFilterIcon={inactiveFilterIcon}
              triggerClassName={filterButtonClassName}
              labels={filteringLabels}
            />
          ) : (
            <button
              type="button"
              aria-label={filteringLabels.popover.triggerButtonAriaLabel({
                criteriaName: column.name ?? column.id,
              })}
              aria-pressed={isFilterActive}
              className={filterButtonClassName}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                filteringControls?.onFilterIconPress?.({
                  columnID: column.id,
                  columnName: column.name ?? column.id,
                  filterGroup: activeFilterGroup,
                })
              }}
            >
              {isFilterActive ? activeFilterIcon : inactiveFilterIcon}
            </button>
          )
        ) : null
        const sortIndicator =
          columnAllowsSorting && sortDirection ? (
            <span aria-hidden="true" className={sortIndicatorClassName}>
              {sortDirection === TABLE_SORT_DIRECTION__ASCENDING ? ascendingIcon : descendingIcon}
            </span>
          ) : null
        const resizeControl = columnAllowsResizing ? (
          <button
            aria-label={`Resize ${column.name ?? column.id} column`}
            className={tableHeader__resizeHandle}
            onClick={(event) => event.stopPropagation()}
            data-table-column-resize={column.id}
            onPointerDown={onResizePointerDown}
            type="button"
          />
        ) : null

        return (
          <TableColumn
            id={column.id}
            key={column.id}
            isRowHeader={column.isRowHeader}
            allowsSorting={columnAllowsSorting}
            aria-label={column.headerAriaLabel}
            className={classNames(
              tableHeader__cell,
              columnAllowsSorting && tableHeader__cellSortable,
              columnAllowsResizing && tableHeader__cellResizable,
              headerAlignment === ALIGNMENT__CENTER && tableHeader__cellAlignCenter,
              headerAlignment === ALIGNMENT__RIGHT && tableHeader__cellAlignEnd,
              column.customHeaderColumnClassName,
            )}
            style={{
              width: column.width,
              minWidth: column.minWidth,
              maxWidth: column.maxWidth,
              ...column.customHeaderColumnStyles,
            }}
          >
            {needsInnerWrapper ? (
              <div className={tableHeader__cellInner}>
                {columnAllowsSorting ? (
                  <button
                    className={tableHeader__sortButton}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation()
                      onSortPress()
                    }}
                    type="button"
                  >
                    {nameText}
                  </button>
                ) : (
                  nameText
                )}
                {(filterControl || sortIndicator) && (
                  <span className={tableHeader__iconGroup}>
                    {filterControl}
                    {sortIndicator}
                  </span>
                )}
              </div>
            ) : (
              nameText
            )}
            {resizeControl}
          </TableColumn>
        )
      })}
    </AdobeTableHeader>
  )
}

export default TableHeader
