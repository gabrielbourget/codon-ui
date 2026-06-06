import classNames from "classnames"
import type { ComponentPropsWithoutRef, CSSProperties } from "react"

import styles from "./IndicatorStyles.module.css"

export const INDICATOR_SHAPE__CIRCLE = "circle"
export const INDICATOR_SHAPE__ROUNDED = "rounded"
export const INDICATOR_SHAPE__SQUARE = "square"

export const AVAILABLE_INDICATOR_SHAPES = [
  INDICATOR_SHAPE__CIRCLE,
  INDICATOR_SHAPE__ROUNDED,
  INDICATOR_SHAPE__SQUARE,
] as const
export type TAvailableIndicatorShape = (typeof AVAILABLE_INDICATOR_SHAPES)[number]

type TIndicatorNativeProps = Omit<ComponentPropsWithoutRef<"div">, "children" | "className" | "color" | "style">

type TIndicatorStyle = CSSProperties & {
  "--indicator-border-color"?: string
  "--indicator-border-width"?: string
  "--indicator-color"?: string
  "--indicator-size"?: string
}

export type TIndicatorProps = TIndicatorNativeProps & {
  isActive?: boolean
  size?: string | number
  color?: string
  inactiveColor?: string
  borderColor?: string
  borderWidth?: string | number
  shape?: TAvailableIndicatorShape
  className?: string
  style?: CSSProperties
  customClassName?: string
  customStyles?: CSSProperties
}

const formatCSSSize = (value: string | number | undefined, fallback: string) => {
  if (value === undefined) return fallback
  if (typeof value === "number") return `${value}px`

  return value
}

export const calibrateComponent = (props: TIndicatorProps) => {
  const {
    borderColor,
    borderWidth = 0,
    className,
    color = "currentColor",
    customClassName,
    customStyles,
    inactiveColor = "transparent",
    isActive = true,
    shape = INDICATOR_SHAPE__CIRCLE,
    size = 10,
    style,
  } = props
  const resolvedColor = isActive ? color : inactiveColor
  const resolvedBorderColor = borderColor ?? color
  const indicatorClassName = classNames(styles.indicator, styles[`indicator--${shape}`], customClassName, className)
  const indicatorStyle = {
    "--indicator-border-color": resolvedBorderColor,
    "--indicator-border-width": formatCSSSize(borderWidth, "0px"),
    "--indicator-color": resolvedColor,
    "--indicator-size": formatCSSSize(size, "10px"),
    ...customStyles,
    ...style,
  } as TIndicatorStyle

  return { indicatorClassName, indicatorStyle }
}
