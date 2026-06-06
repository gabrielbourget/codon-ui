import classNames from "classnames"
import type { CSSProperties, ReactNode } from "react"
import type { ModalOverlayProps } from "react-aria-components"

import type { TAriaLabelingProps } from "../../tokens/a11y"
import { ORTHOGONAL, ROUNDED, type TCornerGeometry } from "../../tokens/geometry"
import textStyles from "../Text/TextStyles.module.css"

import styles from "./AlertDialogStyles.module.css"
import {
  AlertDialogDefaultCheckmarkIcon,
  AlertDialogDefaultDeleteIcon,
  AlertDialogDefaultErrorIcon,
  AlertDialogDefaultInfoIcon,
  AlertDialogDefaultOctagonExclamationIcon,
  AlertDialogDefaultTriangleExclamationIcon,
} from "./DefaultAlertDialogIcons"
import type { TPartialAlertDialogLabels } from "./labels"

export const ALERT_DIALOG_TYPE__INFO = "info"
export const ALERT_DIALOG_TYPE__WARNING = "warning"
export const ALERT_DIALOG_TYPE__ERROR = "error"
export const ALERT_DIALOG_TYPE__DANGER = "danger"
export const ALERT_DIALOG_TYPE__DELETE = "delete"
export const ALERT_DIALOG_TYPE__SUCCESS = "success"
export const AVAILABLE_ALERT_DIALOG_TYPES = [
  ALERT_DIALOG_TYPE__INFO,
  ALERT_DIALOG_TYPE__WARNING,
  ALERT_DIALOG_TYPE__ERROR,
  ALERT_DIALOG_TYPE__DANGER,
  ALERT_DIALOG_TYPE__DELETE,
  ALERT_DIALOG_TYPE__SUCCESS,
] as const
export type TAvailableAlertDialogTypes = (typeof AVAILABLE_ALERT_DIALOG_TYPES)[number]

type TAlertDialogNativeProps = Omit<ModalOverlayProps, "children" | "className" | "isKeyboardDismissDisabled" | "style">

export type TAlertDialogProps = TAriaLabelingProps &
  TAlertDialogNativeProps & {
    "data-testid"?: string
    className?: string
    style?: CSSProperties
    height?: number | string
    width?: number | string
    type?: TAvailableAlertDialogTypes
    geometry?: Exclude<TCornerGeometry, "round">
    raised?: boolean
    overlayBlur?: boolean
    isDismissable?: boolean
    isKeyboardDismissDisabled?: boolean
    AlertIcon?: ReactNode
    cancelAction?(): unknown
    cancelActionBtnText?: string
    showCancelAction?: boolean
    confirmAction?(): unknown
    confirmActionBtnText?: string
    labels?: TPartialAlertDialogLabels
    titleText: string
    bodyText: string
    customStyles?: CSSProperties
    customOverlayStyles?: CSSProperties
    customDialogStyles?: CSSProperties
    customClassName?: string
    customOverlayClassName?: string
    customDialogClassName?: string
    children?: ReactNode
  }

type TAlertDialogColorStyles = {
  topRibbonColorStyle?: string
  iconCircleColorStyle?: string
}

type TAlertDialogCalibration = {
  overlayStyles: string
  modalStyles: string
  topRibbonStyles: string
  dialogStyles: string
  iconCircleStyles: string
  headerStyles: string
  buttonRowStyles: string
  customStyles: CSSProperties
  alertColor: string
  AlertIcon: ReactNode
}

const computeColorStyles = (props: TAlertDialogProps): TAlertDialogColorStyles => {
  const { type = "info" } = props

  let topRibbonColorStyle: string | undefined = undefined
  let iconCircleColorStyle: string | undefined = undefined

  if (!type) return {}

  switch (type) {
    case ALERT_DIALOG_TYPE__INFO:
      topRibbonColorStyle = styles["alertDialog__topRibbon--info"]
      iconCircleColorStyle = styles["alertDialog__dialog__iconCircle--info"]
      break
    case ALERT_DIALOG_TYPE__WARNING:
      topRibbonColorStyle = styles["alertDialog__topRibbon--warning"]
      iconCircleColorStyle = styles["alertDialog__dialog__iconCircle--warning"]
      break
    case ALERT_DIALOG_TYPE__ERROR:
      topRibbonColorStyle = styles["alertDialog__topRibbon--errorOrDanger"]
      iconCircleColorStyle = styles["alertDialog__dialog__iconCircle--errorOrDanger"]
      break
    case ALERT_DIALOG_TYPE__DANGER:
      topRibbonColorStyle = styles["alertDialog__topRibbon--errorOrDanger"]
      iconCircleColorStyle = styles["alertDialog__dialog__iconCircle--errorOrDanger"]
      break
    case ALERT_DIALOG_TYPE__DELETE:
      topRibbonColorStyle = styles["alertDialog__topRibbon--errorOrDanger"]
      iconCircleColorStyle = styles["alertDialog__dialog__iconCircle--errorOrDanger"]
      break
    case ALERT_DIALOG_TYPE__SUCCESS:
      topRibbonColorStyle = styles["alertDialog__topRibbon--success"]
      iconCircleColorStyle = styles["alertDialog__dialog__iconCircle--success"]
      break
    default:
      topRibbonColorStyle = styles["alertDialog__topRibbon--info"]
      iconCircleColorStyle = styles["alertDialog__dialog__iconCircle--info"]
      break
  }

  return { topRibbonColorStyle, iconCircleColorStyle }
}

const computeGeometryStyle = (props: TAlertDialogProps) => {
  const { geometry = ROUNDED } = props

  switch (geometry) {
    case ORTHOGONAL:
      return undefined
    case ROUNDED:
      return styles["alertDialog--rounded"]
    default:
      return undefined
  }
}

export const calibrateComponent = (props: TAlertDialogProps): TAlertDialogCalibration => {
  const {
    raised = true,
    className,
    style,
    customStyles: customStyles__props,
    customClassName,
    customOverlayClassName,
    customDialogClassName,
    overlayBlur = true,
    height,
    width,
    type,
    AlertIcon: AlertIcon__props,
  } = props
  const geometryStyle = computeGeometryStyle(props)
  const { topRibbonColorStyle, iconCircleColorStyle } = computeColorStyles(props)
  const raisedStyle = raised ? styles["alertDialog--raised"] : undefined
  const overlayBlurStyle = overlayBlur ? styles["alertDialog__overlay--blur"] : undefined

  const overlayStyles = classNames(styles.alertDialog__overlay, overlayBlurStyle, customOverlayClassName)
  const modalStyles = classNames(styles.alertDialog, geometryStyle, raisedStyle, customClassName, className)
  const topRibbonStyles = classNames(styles.alertDialog__topRibbon, topRibbonColorStyle)
  const dialogStyles = classNames(styles.alertDialog__dialog, customDialogClassName)
  const iconCircleStyles = classNames(styles.alertDialog__dialog__iconCircle, iconCircleColorStyle)
  const headerStyles = classNames(textStyles["b8"], textStyles["fw-bold"])
  const buttonRowStyles = classNames(styles.alertDialog__dialog__buttonRow)

  let alertColor: string
  let defaultAlertIcon: ReactNode

  switch (type) {
    case ALERT_DIALOG_TYPE__INFO:
      alertColor = "var(--aui-control-selected-background)"
      defaultAlertIcon = <AlertDialogDefaultInfoIcon size={50} data-testid="alert-dialog-default-info-icon" />
      break
    case ALERT_DIALOG_TYPE__WARNING:
      alertColor = "var(--aui-status-warning)"
      defaultAlertIcon = (
        <AlertDialogDefaultTriangleExclamationIcon size={40} data-testid="alert-dialog-default-warning-icon" />
      )
      break
    case ALERT_DIALOG_TYPE__ERROR:
      alertColor = "var(--aui-status-danger)"
      defaultAlertIcon = <AlertDialogDefaultErrorIcon size={50} data-testid="alert-dialog-default-error-icon" />
      break
    case ALERT_DIALOG_TYPE__DANGER:
      alertColor = "var(--aui-status-danger)"
      defaultAlertIcon = (
        <AlertDialogDefaultOctagonExclamationIcon size={45} data-testid="alert-dialog-default-danger-icon" />
      )
      break
    case ALERT_DIALOG_TYPE__DELETE:
      alertColor = "var(--aui-status-danger)"
      defaultAlertIcon = <AlertDialogDefaultDeleteIcon size={50} data-testid="alert-dialog-default-delete-icon" />
      break
    case ALERT_DIALOG_TYPE__SUCCESS:
      alertColor = "var(--aui-status-success)"
      defaultAlertIcon = <AlertDialogDefaultCheckmarkIcon size={65} data-testid="alert-dialog-default-success-icon" />
      break
    default:
      alertColor = "var(--aui-control-selected-background)"
      defaultAlertIcon = <AlertDialogDefaultInfoIcon size={50} data-testid="alert-dialog-default-info-icon" />
      break
  }

  const customStyles = Object.assign({ height, width }, { ...customStyles__props }, { ...style })

  return {
    overlayStyles,
    modalStyles,
    topRibbonStyles,
    dialogStyles,
    iconCircleStyles,
    headerStyles,
    buttonRowStyles,
    customStyles,
    alertColor,
    AlertIcon: AlertIcon__props ?? defaultAlertIcon,
  }
}
