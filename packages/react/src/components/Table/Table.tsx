"use client"

import { useMemo } from "react"
import { Table as AdobeTable } from "react-aria-components"

import { resolveTableFilteringLabels } from "../Filtering/labels"
import {
  PAGINATION_SUBCOMPONENT__ITEMS_PER_PAGE,
  PAGINATION_SUBCOMPONENT__PRIMARY_PAGINATION_CONTROLS,
} from "../Pagination/helpers"
import Pagination from "../Pagination/Pagination"

import { calibrateComponent, useTableSortBridge, type TTableProps } from "./helpers"
import { resolveTableLabels } from "./labels"
import { TableContext } from "./TableContext"
import styles from "./TableStyles.module.css"

const Table = <TRow extends object = Record<string, unknown>>(props: TTableProps<TRow>) => {
  const {
    className: _className,
    customClassName: _customClassName,
    customStyles: _customStyles,
    geometry: _geometry,
    hoverColor: _hoverColor,
    zebraColor: _zebraColor,
    stickyHeader: _stickyHeader,
    style: _style,
    zebra: _zebra,
    clickableRows,
    onRowAction,
    columns,
    columnResizing,
    queryControls,
    filteringLabels,
    labels,
    ...rest
  } = props

  const { tableStyles, tableStyle } = calibrateComponent(props)

  const { pagination, sorting } = queryControls ?? {}
  const { sortDescriptor, handleSortChange } = useTableSortBridge(sorting, columns)
  const isRowActionEnabled = Boolean(clickableRows && onRowAction)
  const resolvedFilteringLabels = useMemo(() => resolveTableFilteringLabels(filteringLabels), [filteringLabels])
  const resolvedLabels = useMemo(() => resolveTableLabels(labels), [labels])

  const contextValue = useMemo(
    () => ({ queryControls, columnResizing, filteringLabels: resolvedFilteringLabels, labels: resolvedLabels }),
    [queryControls, columnResizing, resolvedFilteringLabels, resolvedLabels],
  )

  return (
    <TableContext.Provider value={contextValue}>
      <div className={styles.tableShell}>
        <AdobeTable
          {...rest}
          sortDescriptor={sortDescriptor}
          onSortChange={sorting ? handleSortChange : undefined}
          onRowAction={isRowActionEnabled ? onRowAction : undefined}
          data-clickable-rows={isRowActionEnabled ? "true" : undefined}
          className={tableStyles}
          style={tableStyle}
        />
        {pagination ? (
          <div className={styles.tablePaginationFooter}>
            <Pagination
              maxVisiblePages={4}
              showIncrementButtonsWithOnePage={false}
              chosenPaginationSubcomponents={[
                PAGINATION_SUBCOMPONENT__ITEMS_PER_PAGE,
                PAGINATION_SUBCOMPONENT__PRIMARY_PAGINATION_CONTROLS,
              ]}
              {...pagination}
            />
          </div>
        ) : null}
      </div>
    </TableContext.Provider>
  )
}

export default Table
