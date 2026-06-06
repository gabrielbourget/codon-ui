"use client"

import { motion } from "motion/react"
import { Row as AdobeRow, Cell, Collection, useTableOptions } from "react-aria-components"

import { ALIGNMENT__LEFT } from "../../../../tokens/alignment"
import Button from "../../../Button/Button"
import Checkbox from "../../../Checkbox/Checkbox"
import type { TCellRenderer, TTableColumnMetadata } from "../../helpers"
import { defaultCellRenderer, normalizeTableColumns } from "../../helpers"
import { DEFAULT_TABLE_LABELS } from "../../labels"
import { useTableContext } from "../../TableContext"
import TableCell from "../TableCell/TableCell"

import TableRowDefaultDragIndicatorIcon from "./DefaultDragIndicatorIcon"
import { calibrateComponent, type TTableRowProps } from "./helpers"

const MotionRow = motion.create(AdobeRow as React.ComponentType<Record<string, unknown>>) as React.ComponentType<
  Record<string, unknown>
>

const TableRow = <T extends object>(props: TTableRowProps<T>) => {
  const {
    className: _className,
    id,
    columns,
    iconColor,
    item,
    geometry,
    customClassName: _customClassName,
    customStyles: _customStyles,
    renderCell,
    dependencies,
    style: _style,
    ...rest
  } = props

  const { rowStyles, rowStyle } = calibrateComponent(props)
  const { selectionBehavior, allowsDragging } = useTableOptions()
  const { labels = DEFAULT_TABLE_LABELS } = useTableContext()
  const effectiveCellRenderer: TCellRenderer<T> = renderCell ?? defaultCellRenderer<T>
  const { visibleColumns } = normalizeTableColumns(columns)
  const collectionDependencies = [item, columns, renderCell, ...(dependencies ?? [])]

  return (
    <MotionRow {...rest} layout id={id} className={rowStyles} style={rowStyle} dependencies={collectionDependencies}>
      {allowsDragging && (
        // -> cursor: grab lives on the Cell (<td>), not the Button, because RAC
        //    injects pointer-events: none onto the drag handle button via slot
        //    context — making the <td> the actual mouse-event target.
        <Cell style={{ cursor: "grab" }}>
          <Button slot="drag" raised={false}>
            <TableRowDefaultDragIndicatorIcon
              size={12}
              color={iconColor}
              data-testid="table-row-default-drag-indicator-icon"
            />
          </Button>
        </Cell>
      )}
      {selectionBehavior === "toggle" && (
        <Cell>
          <Checkbox aria-label={labels.selection.selectRowAriaLabel} slot="selection" showIcon={false} />
        </Cell>
      )}

      <Collection items={visibleColumns} dependencies={collectionDependencies}>
        {(column: TTableColumnMetadata<T>) => (
          <TableCell
            key={column.id}
            alignment={column.alignment || ALIGNMENT__LEFT}
            truncate={column.truncate}
            maxLines={column.maxLines}
            customClassName={column.customBodyCellClassName}
            customStyles={{
              width: column.width,
              minWidth: column.minWidth,
              maxWidth: column.maxWidth,
              ...column.customBodyCellStyles,
            }}
          >
            {column.cellRenderer
              ? column.cellRenderer({ row: item, column })
              : effectiveCellRenderer({ row: item, column })}
          </TableCell>
        )}
      </Collection>
    </MotionRow>
  )
}

export default TableRow
