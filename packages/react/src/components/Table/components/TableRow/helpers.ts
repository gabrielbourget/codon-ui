import classNames from "classnames"
import type { CSSProperties } from "react"
import type { RowProps } from "react-aria-components"

import { ORTHOGONAL, ROUND, ROUNDED, type TCornerGeometry } from "../../../../tokens/geometry"
import type { TCellRenderer, TTableColumnMetadata } from "../../helpers"

import styles from "./TableRowStyles.module.css"

export type TTableRowProps<T extends object> = Omit<RowProps<T>, "children" | "className" | "columns" | "style"> & {
  item: T
  columns: TTableColumnMetadata<T>[]
  renderCell?: TCellRenderer<T>
  iconColor?: string
  geometry?: TCornerGeometry
  className?: string
  style?: CSSProperties
  customClassName?: string
  customStyles?: CSSProperties
}

type TTableRowCalibration = {
  rowStyles: string
  rowStyle: CSSProperties
}

const computeRowGeometryStyle = <T extends object>(props: TTableRowProps<T>) => {
  const { geometry = ROUNDED } = props

  switch (geometry) {
    case ORTHOGONAL:
      return undefined
    case ROUNDED:
      return styles["tableRow--rounded"]
    case ROUND:
      return styles["tableRow--round"]
    default:
      break
  }
}

export const calibrateComponent = <T extends object>(props: TTableRowProps<T>): TTableRowCalibration => {
  const { className, customClassName, customStyles, style } = props
  const rowGeometryStyle = computeRowGeometryStyle(props)

  const rowStyles = classNames(styles.tableRow, rowGeometryStyle, customClassName, className)
  const rowStyle = Object.assign({}, { ...customStyles }, { ...style })

  return { rowStyles, rowStyle }
}
