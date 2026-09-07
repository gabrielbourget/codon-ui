"use client"

import { Table as AdobeTable } from "react-aria-components"

import {
  PAGINATION_SUBCOMPONENT__ITEMS_PER_PAGE,
  PAGINATION_SUBCOMPONENT__PRIMARY_PAGINATION_CONTROLS,
} from "../Pagination/helpers"
import Pagination from "../Pagination/Pagination"

import { type TTableProps, useCalibratedComponent } from "./helpers"
import { TableContext } from "./TableContext"
import styles from "./TableStyles.module.css"

const Table = <TRow extends object = Record<string, unknown>>(props: TTableProps<TRow>) => {
  const { context, pagination, root, shell } = useCalibratedComponent(props)

  return (
    <TableContext.Provider value={context.value}>
      <div className={shell.className} onKeyDownCapture={shell.onKeyDownCapture}>
        <AdobeTable
          {...root.nativeProps}
          sortDescriptor={root.sortDescriptor}
          onSortChange={root.onSortChange}
          onRowAction={root.onRowAction}
          data-clickable-rows={root.isRowActionEnabled ? "true" : undefined}
          className={root.className}
          style={root.style}
        />
        {pagination.controls ? (
          <div className={styles.tablePaginationFooter}>
            <Pagination
              maxVisiblePages={4}
              showIncrementButtonsWithOnePage={false}
              chosenPaginationSubcomponents={[
                PAGINATION_SUBCOMPONENT__ITEMS_PER_PAGE,
                PAGINATION_SUBCOMPONENT__PRIMARY_PAGINATION_CONTROLS,
              ]}
              {...pagination.controls}
            />
          </div>
        ) : null}
      </div>
    </TableContext.Provider>
  )
}

export default Table
