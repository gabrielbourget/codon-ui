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

import styles from "./HoverPopoverStyles.module.css"

type THoverPopoverNativeProps = Omit<TooltipProps, "children" | "className" | "style">

export type THoverPopoverProps = THoverPopoverNativeProps & {
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

type THoverPopoverCalibration = {
  hoverPopoverStyles: string
  overlayArrowStyles: string
  customStyles: CSSProperties
  customOverlayArrowStyles: CSSProperties
}

const computeColorStyles = (props: THoverPopoverProps) => {
  const { order, color } = props

  let hoverPopoverColorStyle: string | undefined = undefined
  let overlayArrowColorStyle: string | undefined = undefined

  if (color) return {}
  if (!order) return {}

  switch (order) {
    case THEME_ORDER_CODE__PRIMARY:
      hoverPopoverColorStyle = styles["hoverPopover--primary"]
      overlayArrowColorStyle = styles["hoverPopover__overlayArrow--primary"]
      break
    case THEME_ORDER_CODE__SECONDARY:
      hoverPopoverColorStyle = styles["hoverPopover--secondary"]
      overlayArrowColorStyle = styles["hoverPopover__overlayArrow--secondary"]
      break
    case THEME_ORDER_CODE__TERTIARY:
      hoverPopoverColorStyle = styles["hoverPopover--tertiary"]
      overlayArrowColorStyle = styles["hoverPopover__overlayArrow--tertiary"]
      break
    case THEME_ORDER_CODE__QUATERNARY:
      hoverPopoverColorStyle = styles["hoverPopover--quaternary"]
      overlayArrowColorStyle = styles["hoverPopover__overlayArrow--quaternary"]
      break
    case THEME_ORDER_CODE__QUINTENARY:
      hoverPopoverColorStyle = styles["hoverPopover--quintenary"]
      overlayArrowColorStyle = styles["hoverPopover__overlayArrow--quintenary"]
      break
    default:
      hoverPopoverColorStyle = styles["hoverPopover--primary"]
      overlayArrowColorStyle = styles["hoverPopover__overlayArrow--primary"]
      break
  }

  return { hoverPopoverColorStyle, overlayArrowColorStyle }
}

const computeGeometryStyle = (props: THoverPopoverProps) => {
  const { geometry = ROUNDED } = props

  switch (geometry) {
    case ORTHOGONAL:
      return undefined
    case ROUNDED:
      return styles["hoverPopover--rounded"]
    default:
      return undefined
  }
}

export const calibrateComponent = (props: THoverPopoverProps): THoverPopoverCalibration => {
  const { hoverPopover, hoverPopover__overlayArrow } = styles
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
  const { hoverPopoverColorStyle, overlayArrowColorStyle } = computeColorStyles(props)
  const raisedStyle = raised ? styles["hoverPopover--raised"] : undefined

  const hoverPopoverStyles = classNames(
    hoverPopover,
    geometryStyle,
    hoverPopoverColorStyle,
    raisedStyle,
    customClassName,
    className,
  )
  const overlayArrowStyles = classNames(hoverPopover__overlayArrow, overlayArrowColorStyle, raisedStyle)

  const customStyles: CSSProperties = Object.assign({ color, height, width }, { ...customStyles__props }, { ...style })
  const customOverlayArrowStyles: CSSProperties = Object.assign({ color }, { ...customOverlayArrowStyles__props })

  return { hoverPopoverStyles, overlayArrowStyles, customStyles, customOverlayArrowStyles }
}
