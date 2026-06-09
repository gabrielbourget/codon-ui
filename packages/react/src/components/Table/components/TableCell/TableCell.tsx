import type { CSSProperties, FC, ReactNode } from "react"
import { Cell as AdobeCell } from "react-aria-components"

import { calibrateComponent, type TCellProps } from "./helpers"
import styles from "./TableCellStyles.module.css"

const TableCell: FC<TCellProps> = (props) => {
  const {
    alignment: _alignment,
    children,
    className: _className,
    customClassName: _customClassName,
    customStyles: _customStyles,
    maxLines,
    style: _style,
    truncate: _truncate,
    ...rest
  } = props
  const { cellStyles, cellStyle } = calibrateComponent(props)

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
