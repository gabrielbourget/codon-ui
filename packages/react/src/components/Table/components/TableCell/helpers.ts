import classNames from "classnames"
import type { CSSProperties } from "react"
import type { CellProps } from "react-aria-components"

import { ALIGNMENT__CENTER, ALIGNMENT__RIGHT, type TAvailableAlignments } from "../../../../tokens/alignment"

import styles from "./TableCellStyles.module.css"

const {
  ["tableCell--alignCenter"]: tableCellAlignCenter,
  ["tableCell--alignEnd"]: tableCellAlignEnd,
  ["tableCell--truncate"]: tableCellTruncate,
  tableCell,
} = styles

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

  const alignCenterStyle = alignment && alignment === ALIGNMENT__CENTER ? tableCellAlignCenter : undefined
  const alignRightStyle = alignment && alignment === ALIGNMENT__RIGHT ? tableCellAlignEnd : undefined
  const truncateStyle = truncate ? tableCellTruncate : undefined

  const cellStyles = classNames(tableCell, alignCenterStyle, alignRightStyle, truncateStyle, customClassName, className)
  const cellStyle = Object.assign({}, { ...customStyles }, { ...style })

  return { cellStyles, cellStyle }
}
