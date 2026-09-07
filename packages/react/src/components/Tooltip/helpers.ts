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

const {
  ["tooltip__overlayArrow--primary"]: tooltip__overlayArrowPrimary,
  ["tooltip__overlayArrow--quaternary"]: tooltip__overlayArrowQuaternary,
  ["tooltip__overlayArrow--quintenary"]: tooltip__overlayArrowQuintenary,
  ["tooltip__overlayArrow--secondary"]: tooltip__overlayArrowSecondary,
  ["tooltip__overlayArrow--tertiary"]: tooltip__overlayArrowTertiary,
  ["tooltip--primary"]: tooltipPrimary,
  ["tooltip--quaternary"]: tooltipQuaternary,
  ["tooltip--quintenary"]: tooltipQuintenary,
  ["tooltip--raised"]: tooltipRaised,
  ["tooltip--rounded"]: tooltipRounded,
  ["tooltip--secondary"]: tooltipSecondary,
  ["tooltip--tertiary"]: tooltipTertiary,
} = styles

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
      tooltipColorStyle = tooltipPrimary
      overlayArrowColorStyle = tooltip__overlayArrowPrimary
      break
    case THEME_ORDER_CODE__SECONDARY:
      tooltipColorStyle = tooltipSecondary
      overlayArrowColorStyle = tooltip__overlayArrowSecondary
      break
    case THEME_ORDER_CODE__TERTIARY:
      tooltipColorStyle = tooltipTertiary
      overlayArrowColorStyle = tooltip__overlayArrowTertiary
      break
    case THEME_ORDER_CODE__QUATERNARY:
      tooltipColorStyle = tooltipQuaternary
      overlayArrowColorStyle = tooltip__overlayArrowQuaternary
      break
    case THEME_ORDER_CODE__QUINTENARY:
      tooltipColorStyle = tooltipQuintenary
      overlayArrowColorStyle = tooltip__overlayArrowQuintenary
      break
    default:
      tooltipColorStyle = tooltipPrimary
      overlayArrowColorStyle = tooltip__overlayArrowPrimary
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
      return tooltipRounded
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
  const raisedStyle = raised ? tooltipRaised : undefined

  const tooltipStyles = classNames(tooltip, geometryStyle, tooltipColorStyle, raisedStyle, customClassName, className)
  const overlayArrowStyles = classNames(tooltip__overlayArrow, overlayArrowColorStyle, raisedStyle)

  const customStyles: CSSProperties = Object.assign({ color, height, width }, { ...customStyles__props }, { ...style })
  const customOverlayArrowStyles: CSSProperties = Object.assign({ color }, { ...customOverlayArrowStyles__props })

  return { tooltipStyles, overlayArrowStyles, customStyles, customOverlayArrowStyles }
}
