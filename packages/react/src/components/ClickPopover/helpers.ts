import classNames from "classnames"
import type { CSSProperties } from "react"
import type { PopoverProps } from "react-aria-components"

import { ORTHOGONAL, ROUNDED, type TCornerGeometry } from "../../tokens/geometry"
import {
  THEME_ORDER_CODE__PRIMARY,
  THEME_ORDER_CODE__QUATERNARY,
  THEME_ORDER_CODE__QUINTENARY,
  THEME_ORDER_CODE__SECONDARY,
  THEME_ORDER_CODE__TERTIARY,
  type TThemingOrderCode,
} from "../../tokens/theme-order"

import styles from "./ClickPopoverStyles.module.css"

type TClickPopoverNativeProps = Omit<PopoverProps, "children" | "className" | "style">

export type TClickPopoverProps = TClickPopoverNativeProps & {
  "data-testid"?: string
  className?: string
  style?: CSSProperties
  height?: number | string
  width?: number | string
  color?: string
  order?: TThemingOrderCode
  geometry?: Exclude<TCornerGeometry, "round">
  showOverlayArrow?: boolean
  childIsDialog?: boolean
  raised?: boolean
  customStyles?: CSSProperties
  customOverlayArrowStyles?: CSSProperties
  customDialogStyles?: CSSProperties
  customClassName?: string
  customDialogClassName?: string
}

type TCalibratedClickPopoverComponent = {
  clickPopoverStyles: string
  overlayArrowStyles: string
  dialogStyles: string
  customStyles: CSSProperties
  customOverlayArrowStyles: CSSProperties
}

const computeColorStyles = (props: TClickPopoverProps) => {
  const { order, color } = props

  let clickPopoverColorStyle: string | undefined = undefined
  let overlayArrowColorStyle: string | undefined = undefined

  if (color) return {}
  if (!order) return {}

  switch (order) {
    case THEME_ORDER_CODE__PRIMARY:
      clickPopoverColorStyle = styles["clickPopover--primary"]
      overlayArrowColorStyle = styles["clickPopover__overlayArrow--primary"]
      break
    case THEME_ORDER_CODE__SECONDARY:
      clickPopoverColorStyle = styles["clickPopover--secondary"]
      overlayArrowColorStyle = styles["clickPopover__overlayArrow--secondary"]
      break
    case THEME_ORDER_CODE__TERTIARY:
      clickPopoverColorStyle = styles["clickPopover--tertiary"]
      overlayArrowColorStyle = styles["clickPopover__overlayArrow--tertiary"]
      break
    case THEME_ORDER_CODE__QUATERNARY:
      clickPopoverColorStyle = styles["clickPopover--quaternary"]
      overlayArrowColorStyle = styles["clickPopover__overlayArrow--quaternary"]
      break
    case THEME_ORDER_CODE__QUINTENARY:
      clickPopoverColorStyle = styles["clickPopover--quintenary"]
      overlayArrowColorStyle = styles["clickPopover__overlayArrow--quintenary"]
      break
    default:
      clickPopoverColorStyle = styles["clickPopover--primary"]
      overlayArrowColorStyle = styles["clickPopover__overlayArrow--primary"]
      break
  }

  return { clickPopoverColorStyle, overlayArrowColorStyle }
}

const computeGeometryStyle = (props: TClickPopoverProps) => {
  const { geometry = ROUNDED } = props

  switch (geometry) {
    case ORTHOGONAL:
      return undefined
    case ROUNDED:
      return styles["clickPopover--rounded"]
    default:
      return undefined
  }
}

export const calibrateComponent = (props: TClickPopoverProps): TCalibratedClickPopoverComponent => {
  const { clickPopover, clickPopover__overlayArrow, clickPopover__dialog } = styles
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
    customDialogClassName,
  } = props

  const geometryStyle = computeGeometryStyle(props)
  const { clickPopoverColorStyle, overlayArrowColorStyle } = computeColorStyles(props)
  const raisedStyle = raised ? styles["clickPopover--raised"] : undefined

  const clickPopoverStyles = classNames(
    clickPopover,
    geometryStyle,
    clickPopoverColorStyle,
    raisedStyle,
    customClassName,
    className,
  )
  const overlayArrowStyles = classNames(clickPopover__overlayArrow, overlayArrowColorStyle)
  const dialogStyles = classNames(clickPopover__dialog, customDialogClassName)

  const customStyles = Object.assign({ color, height, width }, { ...customStyles__props }, { ...style })
  const customOverlayArrowStyles = Object.assign({ color }, customOverlayArrowStyles__props)

  return {
    clickPopoverStyles,
    overlayArrowStyles,
    dialogStyles,
    customStyles,
    customOverlayArrowStyles,
  }
}
