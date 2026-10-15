import classNames from "classnames"
import type { CSSProperties, FC, ReactNode } from "react"
import { Cell as AdobeCell } from "react-aria-components"

import { ALIGNMENT__CENTER, ALIGNMENT__RIGHT } from "../../../../tokens/alignment"

import type { TCellProps } from "./helpers"
import styles from "./TableCellStyles.module.css"

const {
  ["tableCell--alignCenter"]: tableCellAlignCenter,
  ["tableCell--alignEnd"]: tableCellAlignEnd,
  ["tableCell--truncate"]: tableCellTruncate,
  tableCell,
} = styles

const TableCell: FC<TCellProps> = (props) => {
  const { alignment, children, className, customClassName, customStyles, maxLines, style, truncate, ...rest } = props
  const alignCenterStyle = alignment && alignment === ALIGNMENT__CENTER ? tableCellAlignCenter : undefined
  const alignRightStyle = alignment && alignment === ALIGNMENT__RIGHT ? tableCellAlignEnd : undefined
  const truncateStyle = truncate ? tableCellTruncate : undefined

  const cellStyles = classNames(tableCell, alignCenterStyle, alignRightStyle, truncateStyle, customClassName, className)
  const cellStyle = Object.assign({}, { ...customStyles }, { ...style })

  const needsClamp = !!maxLines

  return (
    <AdobeCell {...rest} className={cellStyles} style={cellStyle}>
      {(cellRenderProps) => {
        // -> Children can be a node or a render function
        const content =
          typeof children === "function"
            ? (children as (p: typeof cellRenderProps) => ReactNode)(cellRenderProps)
            : children

        return (
          <div className={styles.tableCell__content}>
            {needsClamp ? (
              <div className={styles.tableCell__clamp} style={{ WebkitLineClamp: maxLines } as CSSProperties}>
                {content}
              </div>
            ) : (
              content
            )}
          </div>
        )
      }}
    </AdobeCell>
  )
}

export default TableCell
