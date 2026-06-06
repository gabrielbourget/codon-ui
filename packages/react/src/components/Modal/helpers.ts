import classNames from "classnames"
import type { CSSProperties, ReactNode } from "react"
import type { ModalOverlayProps } from "react-aria-components"

import type { TAriaLabelingProps } from "../../tokens/a11y"
import { ORTHOGONAL, ROUNDED, type TCornerGeometry } from "../../tokens/geometry"
import {
  THEME_ORDER_CODE__PRIMARY,
  THEME_ORDER_CODE__QUATERNARY,
  THEME_ORDER_CODE__QUINTENARY,
  THEME_ORDER_CODE__SECONDARY,
  THEME_ORDER_CODE__TERTIARY,
  type TThemingOrderCode,
} from "../../tokens/theme-order"

import styles from "./ModalStyles.module.css"

type TModalNativeProps = Omit<ModalOverlayProps, "children" | "className" | "isKeyboardDismissDisabled" | "style">

export type TModalProps = TAriaLabelingProps &
  TModalNativeProps & {
    "data-testid"?: string
    className?: string
    style?: CSSProperties
    height?: number | string
    width?: number | string
    color?: string
    order?: TThemingOrderCode
    geometry?: Exclude<TCornerGeometry, "round">
    raised?: boolean
    overlayBlur?: boolean
    isDismissable?: boolean
    isKeyboardDismissDisabled?: boolean
    titleText?: ReactNode
    closeButtonText?: ReactNode
    dialogRole?: "dialog" | "alertdialog"
    customStyles?: CSSProperties
    customOverlayStyles?: CSSProperties
    customDialogStyles?: CSSProperties
    customClassName?: string
    customOverlayClassName?: string
    customDialogClassName?: string
    children?: ReactNode
  }

type TModalCalibration = {
  overlayStyles: string
  modalStyles: string
  dialogStyles: string
  customStyles: CSSProperties
  color_white: string
}

const computeColorStyle = (props: TModalProps) => {
  const { order, color } = props

  let colorStyle: string | undefined = undefined

  if (color) return undefined
  if (!order) return undefined

  switch (order) {
    case THEME_ORDER_CODE__PRIMARY:
      colorStyle = styles["modal--primary"]
      break
    case THEME_ORDER_CODE__SECONDARY:
      colorStyle = styles["modal--secondary"]
      break
    case THEME_ORDER_CODE__TERTIARY:
      colorStyle = styles["modal--tertiary"]
      break
    case THEME_ORDER_CODE__QUATERNARY:
      colorStyle = styles["modal--quaternary"]
      break
    case THEME_ORDER_CODE__QUINTENARY:
      colorStyle = styles["modal--quintenary"]
      break
    default:
      colorStyle = styles["modal--primary"]
      break
  }

  return colorStyle
}

const computeGeometryStyle = (props: TModalProps) => {
  const { geometry = ROUNDED } = props

  switch (geometry) {
    case ORTHOGONAL:
      return undefined
    case ROUNDED:
      return styles["modal--rounded"]
    default:
      return undefined
  }
}

export const calibrateComponent = (props: TModalProps): TModalCalibration => {
  const {
    height,
    width,
    raised = true,
    overlayBlur = true,
    color,
    className,
    style,
    customStyles: customStyles__props,
    customClassName,
    customOverlayClassName,
    customDialogClassName,
  } = props

  const geometryStyle = computeGeometryStyle(props)
  const colorStyle = computeColorStyle(props)
  const raisedStyle = raised ? styles["modal--raised"] : undefined
  const overlayBlurStyle = overlayBlur ? styles["modal__overlay--blur"] : undefined

  const overlayStyles = classNames(styles.modal__overlay, overlayBlurStyle, customOverlayClassName)
  const modalStyles = classNames(styles.modal, geometryStyle, colorStyle, raisedStyle, customClassName, className)
  const dialogStyles = classNames(styles.modal__dialog, customDialogClassName)

  const color_white = "var(--aui-control-selected-foreground)"

  const customStyles = Object.assign(
    { backgroundColor: color, height, width },
    { ...customStyles__props },
    { ...style },
  )

  return { overlayStyles, modalStyles, dialogStyles, customStyles, color_white }
}
