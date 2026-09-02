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

const {
  ["clickPopover__overlayArrow--primary"]: clickPopover__overlayArrowPrimary,
  ["clickPopover__overlayArrow--quaternary"]: clickPopover__overlayArrowQuaternary,
  ["clickPopover__overlayArrow--quintenary"]: clickPopover__overlayArrowQuintenary,
  ["clickPopover__overlayArrow--secondary"]: clickPopover__overlayArrowSecondary,
  ["clickPopover__overlayArrow--tertiary"]: clickPopover__overlayArrowTertiary,
  ["clickPopover--primary"]: clickPopoverPrimary,
  ["clickPopover--quaternary"]: clickPopoverQuaternary,
  ["clickPopover--quintenary"]: clickPopoverQuintenary,
  ["clickPopover--raised"]: clickPopoverRaised,
  ["clickPopover--rounded"]: clickPopoverRounded,
  ["clickPopover--secondary"]: clickPopoverSecondary,
  ["clickPopover--tertiary"]: clickPopoverTertiary,
} = styles

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
      clickPopoverColorStyle = clickPopoverPrimary
      overlayArrowColorStyle = clickPopover__overlayArrowPrimary
      break
    case THEME_ORDER_CODE__SECONDARY:
      clickPopoverColorStyle = clickPopoverSecondary
      overlayArrowColorStyle = clickPopover__overlayArrowSecondary
      break
    case THEME_ORDER_CODE__TERTIARY:
      clickPopoverColorStyle = clickPopoverTertiary
      overlayArrowColorStyle = clickPopover__overlayArrowTertiary
      break
    case THEME_ORDER_CODE__QUATERNARY:
      clickPopoverColorStyle = clickPopoverQuaternary
      overlayArrowColorStyle = clickPopover__overlayArrowQuaternary
      break
    case THEME_ORDER_CODE__QUINTENARY:
      clickPopoverColorStyle = clickPopoverQuintenary
      overlayArrowColorStyle = clickPopover__overlayArrowQuintenary
      break
    default:
      clickPopoverColorStyle = clickPopoverPrimary
      overlayArrowColorStyle = clickPopover__overlayArrowPrimary
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
      return clickPopoverRounded
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
  const raisedStyle = raised ? clickPopoverRaised : undefined

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
