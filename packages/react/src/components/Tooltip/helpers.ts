import classNames from "classnames"
import type { CSSProperties } from "react"
import type { TooltipProps } from "react-aria-components"

import { ORTHOGONAL, ROUNDED, type TCornerGeometry } from "../../tokens/geometry"
import {
  THEME_ORDER_CODE__PRIMARY,
  THEME_ORDER_CODE__QUATERNARY,
  THEME_ORDER_CODE__QUINTENARY,
  THEME_ORDER_CODE__SECONDARY,
  THEME_ORDER_CODE__TERTIARY,
  type TThemingOrderCode,
} from "../../tokens/theme-order"

import styles from "./TooltipStyles.module.css"

type TTooltipNativeProps = Omit<TooltipProps, "children" | "className" | "style">

export type TTooltipProps = TTooltipNativeProps & {
  "data-testid"?: string
  className?: string
  style?: CSSProperties
  height?: number | string
  width?: number | string
  color?: string
  order?: TThemingOrderCode
  geometry?: Exclude<TCornerGeometry, "round">
  showOverlayArrow?: boolean
  raised?: boolean
  customStyles?: CSSProperties
  customOverlayArrowStyles?: CSSProperties
  customClassName?: string
}

type TTooltipCalibration = {
  tooltipStyles: string
  overlayArrowStyles: string
  customStyles: CSSProperties
  customOverlayArrowStyles: CSSProperties
}

const computeColorStyles = (props: TTooltipProps) => {
  const { order, color } = props

  let tooltipColorStyle: string | undefined = undefined
  let overlayArrowColorStyle: string | undefined = undefined

  if (color) return {}
  if (!order) return {}

  switch (order) {
    case THEME_ORDER_CODE__PRIMARY:
      tooltipColorStyle = styles["tooltip--primary"]
      overlayArrowColorStyle = styles["tooltip__overlayArrow--primary"]
      break
    case THEME_ORDER_CODE__SECONDARY:
      tooltipColorStyle = styles["tooltip--secondary"]
      overlayArrowColorStyle = styles["tooltip__overlayArrow--secondary"]
      break
    case THEME_ORDER_CODE__TERTIARY:
      tooltipColorStyle = styles["tooltip--tertiary"]
      overlayArrowColorStyle = styles["tooltip__overlayArrow--tertiary"]
      break
    case THEME_ORDER_CODE__QUATERNARY:
      tooltipColorStyle = styles["tooltip--quaternary"]
      overlayArrowColorStyle = styles["tooltip__overlayArrow--quaternary"]
      break
    case THEME_ORDER_CODE__QUINTENARY:
      tooltipColorStyle = styles["tooltip--quintenary"]
      overlayArrowColorStyle = styles["tooltip__overlayArrow--quintenary"]
      break
    default:
      tooltipColorStyle = styles["tooltip--primary"]
      overlayArrowColorStyle = styles["tooltip__overlayArrow--primary"]
      break
  }

  return { tooltipColorStyle, overlayArrowColorStyle }
}

const computeGeometryStyle = (props: TTooltipProps) => {
  const { geometry = ROUNDED } = props

  switch (geometry) {
    case ORTHOGONAL:
      return undefined
    case ROUNDED:
      return styles["tooltip--rounded"]
    default:
      return undefined
  }
}

export const calibrateComponent = (props: TTooltipProps): TTooltipCalibration => {
  const { tooltip, tooltip__overlayArrow } = styles
  const {
    raised = true,
    color,
    height,
    width,
    className,
    style,
    customStyles: customStyles__props,
    customOverlayArrowStyles: customOverlayArrowStyles__props,
    customClassName,
  } = props

  const geometryStyle = computeGeometryStyle(props)
  const { tooltipColorStyle, overlayArrowColorStyle } = computeColorStyles(props)
  const raisedStyle = raised ? styles["tooltip--raised"] : undefined

  const tooltipStyles = classNames(tooltip, geometryStyle, tooltipColorStyle, raisedStyle, customClassName, className)
  const overlayArrowStyles = classNames(tooltip__overlayArrow, overlayArrowColorStyle, raisedStyle)

  const customStyles: CSSProperties = Object.assign({ color, height, width }, { ...customStyles__props }, { ...style })
  const customOverlayArrowStyles: CSSProperties = Object.assign({ color }, { ...customOverlayArrowStyles__props })

  return { tooltipStyles, overlayArrowStyles, customStyles, customOverlayArrowStyles }
}
