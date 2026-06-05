import classNames from "classnames"
import type { HTMLMotionProps } from "motion/react"
import type { CSSProperties } from "react"
import type { DragEndEvent } from "react-aria"

import type { TAriaLabelingProps } from "../../../tokens/a11y"
import type { TTableSortDirection } from "../../Table/queryTypes"

import styles from "./SortParameterListItemStyles.module.css"

export type TSortParameter = {
  ID: string
  name: string
  sortDirection: TTableSortDirection
}

type TSortParameterNativeProps = Omit<
  HTMLMotionProps<"div">,
  "children" | "className" | "id" | "onDragEnd" | "onDragStart" | "onDrop" | "style"
>

export type TSortParameterProps = TSortParameterNativeProps &
  TAriaLabelingProps & {
    "data-testid"?: string
    item: TSortParameter
    onDragStart: (id: string) => void
    onDrop: (id: string) => void
    onDragEnd: (e: DragEndEvent) => void
    className?: string
    style?: CSSProperties
    customClassName?: string
    customStyles?: CSSProperties
    customIconClassName?: string
    customIconStyles?: CSSProperties
    customTextClassName?: string
    customTextStyles?: CSSProperties
  }

type TSortParameterCalibration = {
  sortParameterListItemStyles: string
  sortParameterListItemStyle: CSSProperties
  sortParameterListItemIconStyles: string
  sortParameterListItemTextStyles: string
}

export const calibrateComponent = (props: TSortParameterProps): TSortParameterCalibration => {
  const { className, customClassName, customIconClassName, customStyles, customTextClassName, style } = props

  const sortParameterListItemStyles = classNames(styles.sortParameterListItem, customClassName, className)
  const sortParameterListItemStyle = { ...customStyles, ...style }
  const sortParameterListItemIconStyles = classNames(customIconClassName)
  const sortParameterListItemTextStyles = classNames(customTextClassName)

  return {
    sortParameterListItemStyles,
    sortParameterListItemStyle,
    sortParameterListItemIconStyles,
    sortParameterListItemTextStyles,
  }
}
