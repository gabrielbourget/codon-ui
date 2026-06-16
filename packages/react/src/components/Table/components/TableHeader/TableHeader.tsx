import classNames from "classnames"
import { TableHeader as AdobeTableHeader, useTableOptions } from "react-aria-components"

import { ALIGNMENT__CENTER, ALIGNMENT__RIGHT } from "../../../../tokens/alignment"
import Checkbox from "../../../Checkbox/Checkbox"
import { DEFAULT_TABLE_FILTERING_LABELS } from "../../../Filtering/labels"
import Text from "../../../Text/Text"
import {
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

import { calibrateComponent, calibrateFilterIcons, calibrateSortIcons, type TTableHeaderProps } from "./helpers"
import styles from "./TableHeaderStyles.module.css"

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

        return (
          <TableColumn
            id={column.id}
            key={column.id}
            isRowHeader={column.isRowHeader}
            allowsSorting={columnAllowsSorting}
            aria-label={column.headerAriaLabel}
            className={classNames(
              styles.tableHeader__cell,
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
                {nameText}
                {columnAllowsFiltering && (
                  <>
                    {filteringMode === TABLE_FILTERING_CONTROL_MODE__POPOVER && filteringControls?.onFiltersChange ? (
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
                    )}
                  </>
                )}
                {columnAllowsSorting && sortDirection && (
                  <span aria-hidden="true" className={styles.tableHeader__sortIndicator}>
                    {sortDirection === TABLE_SORT_DIRECTION__ASCENDING ? ascendingIcon : descendingIcon}
                  </span>
                )}
              </div>
            ) : (
              nameText
            )}
          </TableColumn>
        )
      })}
    </AdobeTableHeader>
  )
}

export default TableHeader
