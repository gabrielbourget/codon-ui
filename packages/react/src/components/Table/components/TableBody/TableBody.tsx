import classNames from "classnames"
import { TableBody as AdobeTableBody } from "react-aria-components"

import TableRow from "../TableRow/TableRow"

import type { TTableBodyProps } from "./helpers"

const TableBody = <T extends object>(props: TTableBodyProps<T>) => {
  const {
    className,
    items = [],
    columns,
    customClassName,
    customRowClassName,
    customRowStyles,
    customStyles,
    geometry,
    isLoading,
    rowKey,
    renderEmptyState,
    renderLoadingState,
    renderCell,
    dependencies,
    style,
    ...rest
  } = props
  const collectionDependencies = [items, columns, rowKey, renderCell, ...(dependencies ?? [])]
  const tableBodyStyles = classNames(customClassName, className)
  const tableBodyStyle = Object.assign({}, { ...customStyles }, { ...style })

  if (isLoading && renderLoadingState) {
    return (
      <AdobeTableBody {...rest} className={tableBodyStyles} style={tableBodyStyle}>
        {renderLoadingState()}
      </AdobeTableBody>
    )
  }

  if (!isLoading && items.length === 0 && renderEmptyState) {
    return (
      <AdobeTableBody
        {...rest}
        className={tableBodyStyles}
        style={tableBodyStyle}
        renderEmptyState={renderEmptyState}
      />
    )
  }

  return (
    <AdobeTableBody<T>
      {...rest}
      items={items as Iterable<T>}
      dependencies={collectionDependencies}
      className={tableBodyStyles}
      style={tableBodyStyle}
    >
      {(row: T) => (
        <TableRow<T>
          id={rowKey ? String(rowKey(row)) : undefined}
          item={row}
          columns={columns}
          customClassName={customRowClassName}
          customStyles={customRowStyles}
          geometry={geometry}
          renderCell={renderCell}
        />
      )}
    </AdobeTableBody>
  )
}

export default TableBody
