import classNames from "classnames"
import type { CSSProperties } from "react"
import type { CellProps } from "react-aria-components"

import { ALIGNMENT__CENTER, ALIGNMENT__RIGHT, type TAvailableAlignments } from "../../../../tokens/alignment"

import styles from "./TableCellStyles.module.css"

export type TCellProps = Omit<CellProps, "className" | "style"> & {
  alignment?: TAvailableAlignments
  truncate?: boolean
  maxLines?: number
  className?: string
  style?: CSSProperties
  customStyles?: CSSProperties
  customClassName?: string
}

type TCellCalibration = {
  cellStyles: string
  cellStyle: CSSProperties
}

export const calibrateComponent = (props: TCellProps): TCellCalibration => {
  const { alignment, className, customClassName, customStyles, style, truncate } = props

  const alignCenterStyle = alignment && alignment === ALIGNMENT__CENTER ? styles["tableCell--alignCenter"] : undefined
  const alignRightStyle = alignment && alignment === ALIGNMENT__RIGHT ? styles["tableCell--alignEnd"] : undefined
  const truncateStyle = truncate ? styles["tableCell--truncate"] : undefined

  const cellStyles = classNames(
    styles.tableCell,
    alignCenterStyle,
    alignRightStyle,
    truncateStyle,
    customClassName,
    className,
  )
  const cellStyle = Object.assign({}, { ...customStyles }, { ...style })

  return { cellStyles, cellStyle }
}
