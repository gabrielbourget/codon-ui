import classNames from "classnames"
import type { KeyboardEvent, PointerEvent } from "react"
import { TableHeader as AdobeTableHeader, useTableOptions } from "react-aria-components"

import { ALIGNMENT__CENTER, ALIGNMENT__RIGHT } from "../../../../tokens/alignment"
import Checkbox from "../../../Checkbox/Checkbox"
import { DEFAULT_TABLE_FILTERING_LABELS } from "../../../Filtering/labels"
import Text from "../../../Text/Text"
import {
  computeNextTableSorts,
  normalizeTableColumns,
  TABLE_FILTERING_CONTROL_MODE__EXTERNAL,
  TABLE_FILTERING_CONTROL_MODE__POPOVER,
  type TTableColumnMetadata,
} from "../../helpers"
import { DEFAULT_TABLE_LABELS } from "../../labels"
import { TABLE_SORT_DIRECTION__ASCENDING, TABLE_SORT_DIRECTION__DESCENDING } from "../../queryTypes"
import { useTableContext } from "../../TableContext"
import tableStyles from "../../TableStyles.module.css"
import TableColumn from "../TableColumn/TableColumn"
import TableFilterPopover from "../TableFilterPopover/TableFilterPopover"

import { calibrateComponent, calibrateFilterIcons, calibrateSortIcons, type TTableHeaderProps } from "./helpers"
import styles from "./TableHeaderStyles.module.css"

const TABLE_COLUMN_RESIZE_MIN_WIDTH_PX = 52
const TABLE_COLUMN_RESIZE_KEYBOARD_STEP_PX = 16

const resolveNumericSize = (value: number | string | undefined) => (typeof value === "number" ? value : undefined)

const clampColumnWidth = (width: number, minWidth: number, maxWidth?: number) => {
  const maximum = typeof maxWidth === "number" ? maxWidth : Number.POSITIVE_INFINITY

  return Math.round(Math.min(Math.max(width, minWidth), maximum))
}

const TableHeader = <T extends object>(props: TTableHeaderProps<T>) => {
  const {
    className: _className,
    columns,
    customClassName: _customClassName,
    customStyles: _customStyles,
    style: _style,
    ...rest
  } = props
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
  const { tableHeaderStyles, tableHeaderStyle } = calibrateComponent(props)

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
          styles.tableHeader__filterButton,
          isFilterActive && styles["tableHeader__filterButton--active"],
        )
        const sortIndicatorClassName = classNames(
          styles.tableHeader__sortIndicator,
          sortDirection && styles["tableHeader__sortIndicator--active"],
        )
        const ariaSort =
          sortDirection === TABLE_SORT_DIRECTION__ASCENDING
            ? "ascending"
            : sortDirection === TABLE_SORT_DIRECTION__DESCENDING
              ? "descending"
              : columnAllowsSorting
                ? "none"
                : undefined
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
        const resolveColumnResizeBounds = () => ({
          maxWidth: resolveNumericSize(column.maxWidth) ?? columnResizing?.maxWidth,
          minWidth: resolveNumericSize(column.minWidth) ?? columnResizing?.minWidth ?? TABLE_COLUMN_RESIZE_MIN_WIDTH_PX,
        })
        const commitColumnResize = (width: number) => {
          if (!columnResizing) return

          const { minWidth, maxWidth } = resolveColumnResizeBounds()

          columnResizing.onColumnResize({
            columnID: column.id,
            width: clampColumnWidth(width, minWidth, maxWidth),
          })
        }
        const getCurrentColumnWidth = (target: HTMLElement) => {
          const headerCell = target.closest("th")

          return headerCell?.getBoundingClientRect().width ?? resolveNumericSize(column.width) ?? 0
        }
        const onResizePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
          if (!columnAllowsResizing) return

          event.preventDefault()
          event.stopPropagation()

          const startX = event.clientX
          const startWidth = getCurrentColumnWidth(event.currentTarget)

          const onPointerMove = (moveEvent: globalThis.PointerEvent) => {
            commitColumnResize(startWidth + moveEvent.clientX - startX)
          }
          const onPointerUp = () => {
            window.removeEventListener("pointermove", onPointerMove)
            window.removeEventListener("pointerup", onPointerUp)
          }

          window.addEventListener("pointermove", onPointerMove)
          window.addEventListener("pointerup", onPointerUp)
        }
        const onResizeKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
          if (!columnAllowsResizing || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return

          event.preventDefault()
          event.stopPropagation()

          const direction = event.key === "ArrowLeft" ? -1 : 1
          const currentWidth = getCurrentColumnWidth(event.currentTarget)

          commitColumnResize(currentWidth + direction * TABLE_COLUMN_RESIZE_KEYBOARD_STEP_PX)
        }

        const nameText = (
          <Text
            customClassName={classNames(styles.tableHeader__cellLabel, hiddenStyle, column.customHeaderCellClassName)}
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
            className={styles.tableHeader__resizeHandle}
            onClick={(event) => event.stopPropagation()}
            onKeyDownCapture={onResizeKeyDown}
            onPointerDown={onResizePointerDown}
            type="button"
          />
        ) : null

        return (
          <TableColumn
            id={column.id}
            key={column.id}
            isRowHeader={column.isRowHeader}
            allowsSorting={false}
            aria-label={column.headerAriaLabel}
            aria-sort={ariaSort}
            onClick={onSortPress}
            className={classNames(
              styles.tableHeader__cell,
              columnAllowsSorting && styles["tableHeader__cell--sortable"],
              columnAllowsResizing && styles["tableHeader__cell--resizable"],
              headerAlignment === ALIGNMENT__CENTER && styles["tableHeader__cell--alignCenter"],
              headerAlignment === ALIGNMENT__RIGHT && styles["tableHeader__cell--alignEnd"],
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
              <div className={styles.tableHeader__cellInner}>
                {columnAllowsSorting ? (
                  <button
                    className={styles.tableHeader__sortButton}
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
                  <span className={styles.tableHeader__iconGroup}>
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
