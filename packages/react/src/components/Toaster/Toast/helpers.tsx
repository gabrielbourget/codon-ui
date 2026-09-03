import classNames from "classnames"
import { format } from "date-fns"
import type { CSSProperties, ReactNode } from "react"

import type { TCornerGeometry } from "../../../tokens/geometry"
import { ORTHOGONAL, ROUNDED } from "../../../tokens/geometry"
import type { TButtonProps } from "../../Button/helpers"
import type { TTextProps } from "../../Text/helpers"
import textStyles from "../../Text/TextStyles.module.css"
import type { TAvailableToastPositions, TToastHeight } from "../helpers"

import {
  ToastDefaultCheckmarkIcon,
  ToastDefaultCircleInfoIcon,
  ToastDefaultDeleteIcon,
  ToastDefaultErrorIcon,
  ToastDefaultOctagonExclamationIcon,
  ToastDefaultTriangleExclamationIcon,
} from "./DefaultToastIcons"
import type { TPartialToastLabels } from "./labels"
import styles from "./ToastStyles.module.css"

const {
  ["toast__topRibbon--errorOrDanger"]: toast__topRibbonErrorOrDanger,
  ["toast__topRibbon--info"]: toast__topRibbonInfo,
  ["toast__topRibbon--success"]: toast__topRibbonSuccess,
  ["toast__topRibbon--warning"]: toast__topRibbonWarning,
  ["toast--raised"]: toastRaised,
  ["toast--rounded"]: toastRounded,
} = styles

export const TOAST_TYPE__INFO = "info"
export const TOAST_TYPE__WARNING = "warning"
export const TOAST_TYPE__ERROR = "error"
export const TOAST_TYPE__DANGER = "danger"
export const TOAST_TYPE__DELETE = "delete"
export const TOAST_TYPE__SUCCESS = "success"
export const AVAILABLE_TOAST_TYPES = [
  TOAST_TYPE__INFO,
  TOAST_TYPE__WARNING,
  TOAST_TYPE__ERROR,
  TOAST_TYPE__DANGER,
  TOAST_TYPE__DELETE,
  TOAST_TYPE__SUCCESS,
]
export type TAvailableToastTypes = (typeof AVAILABLE_TOAST_TYPES)[number]

export type TToast = {
  id: number | string
  height?: number | string
  width?: number | string
  className?: string
  style?: CSSProperties
  position?: TAvailableToastPositions
  type?: TAvailableToastTypes
  geometry?: Exclude<TCornerGeometry, "round">
  raised?: boolean
  dismissable?: boolean
  duration?: number | "persistent"
  deletingToast?: boolean
  important?: boolean
  cancelAction?(): unknown
  cancelActionBtnText?: string
  showCancelAction?: boolean
  confirmAction?(): unknown
  confirmActionBtnText?: string
  labels?: TPartialToastLabels
  showButtons?: boolean
  titleText?: string
  bodyText?: string
  ToastIcon?: ReactNode
  CloseIcon?: ReactNode
  onDismiss?: (toast: TToast) => void
  onAutoClose?: (toast: TToast) => void
  customClassName?: string
  customStyles?: CSSProperties
  customTopRibbonClassName?: string
  customTopRibbonStyles?: CSSProperties
  customTopRibbonLeftContentClassName?: string
  customTopRibbonLeftContentStyles?: CSSProperties
  customTitleClassName?: string
  customTitleStyles?: CSSProperties
  customContentClassName?: string
  customContentStyles?: CSSProperties
  customBodyTextClassName?: string
  customBodyTextStyles?: CSSProperties
  customBodyTextProps?: Partial<TTextProps>
  customBottomRowClassName?: string
  customBottomRowStyles?: CSSProperties
  customTimestampClassName?: string
  customTimestampStyles?: CSSProperties
  customTimestampTextProps?: Partial<TTextProps>
  customButtonRowClassName?: string
  customButtonRowStyles?: CSSProperties
  customCloseButtonClassName?: string
  customCloseButtonStyles?: CSSProperties
  customCloseButtonProps?: Partial<TButtonProps>
  customCancelButtonClassName?: string
  customCancelButtonStyles?: CSSProperties
  customCancelButtonProps?: Partial<TButtonProps>
  customConfirmButtonClassName?: string
  customConfirmButtonStyles?: CSSProperties
  customConfirmButtonProps?: Partial<TButtonProps>
}

export type TToastProps = {
  index: number
  toast: TToast
  toastLabels?: TPartialToastLabels
  numToasts: number
  duration?: number | "persistent" // -> Passed in from global Toaster duration prop
  maxVisibleToasts: number
  toastGap?: number
  toasterExpanded: boolean
  expandByDefault?: boolean
  dismissalHotkey?: string[]
  interacting: boolean
  heights: TToastHeight[]
  // setToasterState: React.Dispatch<React.SetStateAction<TToasterState>>;
  removeToast: (toast: TToast) => void
  setHeights: React.Dispatch<React.SetStateAction<TToastHeightInfo[]>>
  pauseWhenPageIsHidden: boolean
  position: TAvailableToastPositions
}

export type TToastHeightInfo = {
  height: number
  id: number | string
  position?: TAvailableToastPositions
}

export type TToastState = {
  mounted: boolean
  removed: boolean
  dragging: boolean
  draggingOut: boolean
  offsetBeforeRemove: number
  initialHeight: number
  isFocused: boolean
  toastStyles: string
  topRibbonStyles: string
  topRibbonLeftContentStyles: string
  headerStyles: string
  toastContentStyles: string
  bottomRowStyles: string
  buttonRowStyles: string
  customStyles: CSSProperties
  color_white: string
}

export const initState: TToastState = {
  mounted: false,
  removed: false,
  dragging: false,
  draggingOut: false,
  offsetBeforeRemove: 0,
  initialHeight: 0,
  isFocused: false,
  toastStyles: "",
  topRibbonStyles: "",
  topRibbonLeftContentStyles: "",
  headerStyles: "",
  toastContentStyles: "",
  bottomRowStyles: "",
  buttonRowStyles: "",
  customStyles: {},
  color_white: "",
}

type TCalibratedToastComponent = {
  bodyTextProps: Partial<TTextProps>
  toastStyles: string
  topRibbonStyles: string
  topRibbonLeftContentStyles: string
  headerStyles: string
  toastContentStyles: string
  bottomRowStyles: string
  buttonRowStyles: string
  customStyles: CSSProperties
  topRibbonStyle?: CSSProperties
  topRibbonLeftContentStyle?: CSSProperties
  headerStyle?: CSSProperties
  toastContentStyle?: CSSProperties
  bottomRowStyle?: CSSProperties
  buttonRowStyle?: CSSProperties
  color__white: string
  color__neutral_4: string
  toastColor: string
  toastIcon: ReactNode
  timestampTextProps: Partial<TTextProps>
  closeButtonProps: Partial<TButtonProps>
  cancelButtonProps: Partial<TButtonProps>
  confirmButtonProps: Partial<TButtonProps>
}

const mergeButtonSlotProps = (args: {
  buttonProps?: Partial<TButtonProps>
  customClassName?: string
  customStyles?: CSSProperties
  defaultStyles?: CSSProperties
}): Partial<TButtonProps> => {
  const { className, customClassName, customStyles, ...rest } = args.buttonProps ?? {}
  const nativeClassName = typeof className === "string" ? className : undefined

  return {
    ...rest,
    customClassName: classNames(customClassName, nativeClassName, args.customClassName),
    customStyles: {
      ...args.defaultStyles,
      ...customStyles,
      ...args.customStyles,
    },
  }
}

const mergeTextSlotProps = (args: {
  textProps?: Partial<TTextProps>
  customClassName?: string
  customStyles?: CSSProperties
}): Partial<TTextProps> => {
  const { customClassName, customStyles, ...rest } = args.textProps ?? {}

  return {
    ...rest,
    customClassName: classNames(customClassName, args.customClassName),
    customStyles: {
      ...customStyles,
      ...args.customStyles,
    },
  }
}

const computeColorStyles = (props: TToastProps) => {
  const {
    toast: { type = "info" },
  } = props

  let colorStyle: string | undefined = undefined

  if (!type) return {}

  switch (type) {
    case TOAST_TYPE__INFO:
      colorStyle = toast__topRibbonInfo
      break
    case TOAST_TYPE__WARNING:
      colorStyle = toast__topRibbonWarning
      break
    case TOAST_TYPE__ERROR:
      colorStyle = toast__topRibbonErrorOrDanger
      break
    case TOAST_TYPE__DANGER:
      colorStyle = toast__topRibbonErrorOrDanger
      break
    case TOAST_TYPE__DELETE:
      colorStyle = toast__topRibbonErrorOrDanger
      break
    case TOAST_TYPE__SUCCESS:
      colorStyle = toast__topRibbonSuccess
      break
    default:
      colorStyle = toast__topRibbonInfo
      break
  }

  return colorStyle
}

const computeGeometryStyle = (props: TToastProps) => {
  const {
    toast: { geometry = ROUNDED },
  } = props

  switch (geometry) {
    case ORTHOGONAL:
      return undefined
    case ROUNDED:
      return toastRounded
    default:
      return undefined
  }
}

export const computeToastDateTimeString = () => format(new Date(), "MMMM d, yyyy | HH:mm:ss")

export const calibrateComponent = (props: TToastProps): TCalibratedToastComponent => {
  const {
    toast: {
      className,
      height,
      width,
      type,
      ToastIcon: ToastIcon__props,
      raised = true,
      customClassName,
      customStyles: customStyles__props,
      customTopRibbonClassName,
      customTopRibbonStyles,
      customTopRibbonLeftContentClassName,
      customTopRibbonLeftContentStyles,
      customTitleClassName,
      customTitleStyles,
      customContentClassName,
      customContentStyles,
      customBodyTextClassName,
      customBodyTextProps,
      customBodyTextStyles,
      customBottomRowClassName,
      customBottomRowStyles,
      customTimestampClassName,
      customTimestampTextProps,
      customTimestampStyles,
      customButtonRowClassName,
      customButtonRowStyles,
      customCloseButtonClassName,
      customCloseButtonProps,
      customCloseButtonStyles,
      customCancelButtonClassName,
      customCancelButtonProps,
      customCancelButtonStyles,
      customConfirmButtonClassName,
      customConfirmButtonProps,
      customConfirmButtonStyles,
      style,
    },
  } = props
  const { b10 } = textStyles
  const {
    toast,
    toast__topRibbon,
    toast__topRibbon__leftContent,
    toast__bodyContent,
    toast__bottomRow,
    toast__buttonRow,
  } = styles

  const colorStyle = computeColorStyles(props)
  const geometryStyle = computeGeometryStyle(props)
  const raisedStyle = raised ? toastRaised : undefined

  const toastStyles = classNames(toast, geometryStyle, raisedStyle, customClassName, className)
  const topRibbonStyles = classNames(toast__topRibbon, colorStyle, customTopRibbonClassName)
  const topRibbonLeftContentStyles = classNames(toast__topRibbon__leftContent, customTopRibbonLeftContentClassName)
  const headerStyles = classNames(b10, textStyles["fw-bold"], customTitleClassName)
  const toastContentStyles = classNames(toast__bodyContent, customContentClassName)
  const bottomRowStyles = classNames(toast__bottomRow, customBottomRowClassName)
  const buttonRowStyles = classNames(toast__buttonRow, customButtonRowClassName)
  const bodyTextProps = mergeTextSlotProps({
    textProps: customBodyTextProps,
    customClassName: customBodyTextClassName,
    customStyles: customBodyTextStyles,
  })
  const timestampTextProps = mergeTextSlotProps({
    textProps: customTimestampTextProps,
    customClassName: customTimestampClassName,
    customStyles: customTimestampStyles,
  })
  const closeButtonProps = mergeButtonSlotProps({
    buttonProps: customCloseButtonProps,
    customClassName: customCloseButtonClassName,
    customStyles: customCloseButtonStyles,
    defaultStyles: { padding: 0 },
  })
  const cancelButtonProps = mergeButtonSlotProps({
    buttonProps: customCancelButtonProps,
    customClassName: customCancelButtonClassName,
    customStyles: customCancelButtonStyles,
  })
  const confirmButtonProps = mergeButtonSlotProps({
    buttonProps: customConfirmButtonProps,
    customClassName: customConfirmButtonClassName,
    customStyles: customConfirmButtonStyles,
  })

  const customStyles: CSSProperties = Object.assign({ height, width }, { ...customStyles__props }, { ...style })

  const color__white = "var(--cui-control-selected-foreground)"
  const color__neutral_4 = "var(--cui-control-placeholder)"
  let toastColor = ""
  let defaultToastIcon: ReactNode

  switch (type) {
    case TOAST_TYPE__INFO:
      toastColor = "var(--cui-control-selected-background)"
      defaultToastIcon = (
        <ToastDefaultCircleInfoIcon size={15} color={color__white} data-testid="toast-default-info-icon" />
      )
      break
    case TOAST_TYPE__WARNING:
      toastColor = "var(--cui-status-warning)"
      defaultToastIcon = (
        <ToastDefaultTriangleExclamationIcon size={15} color={color__white} data-testid="toast-default-warning-icon" />
      )
      break
    case TOAST_TYPE__ERROR:
      toastColor = "var(--cui-status-danger)"
      defaultToastIcon = <ToastDefaultErrorIcon size={15} color={color__white} data-testid="toast-default-error-icon" />
      break
    case TOAST_TYPE__DANGER:
      toastColor = "var(--cui-status-danger)"
      defaultToastIcon = (
        <ToastDefaultOctagonExclamationIcon size={15} color={color__white} data-testid="toast-default-danger-icon" />
      )
      break
    case TOAST_TYPE__DELETE:
      toastColor = "var(--cui-status-danger)"
      defaultToastIcon = (
        <ToastDefaultDeleteIcon size={15} color={color__white} data-testid="toast-default-delete-icon" />
      )
      break
    case TOAST_TYPE__SUCCESS:
      toastColor = "var(--cui-status-success)"
      defaultToastIcon = (
        <ToastDefaultCheckmarkIcon size={25} color={color__white} data-testid="toast-default-success-icon" />
      )
      break
    default:
      toastColor = "var(--cui-control-selected-background)"
      defaultToastIcon = (
        <ToastDefaultCircleInfoIcon size={15} color={color__white} data-testid="toast-default-info-icon" />
      )
      break
  }

  return {
    bodyTextProps,
    toastStyles,
    topRibbonStyles,
    topRibbonLeftContentStyles,
    headerStyles,
    toastContentStyles,
    bottomRowStyles,
    buttonRowStyles,
    customStyles,
    topRibbonStyle: customTopRibbonStyles,
    topRibbonLeftContentStyle: customTopRibbonLeftContentStyles,
    headerStyle: customTitleStyles,
    toastContentStyle: customContentStyles,
    bottomRowStyle: customBottomRowStyles,
    buttonRowStyle: customButtonRowStyles,
    color__white,
    color__neutral_4,
    toastColor,
    toastIcon: ToastIcon__props ?? defaultToastIcon,
    timestampTextProps,
    closeButtonProps,
    cancelButtonProps,
    confirmButtonProps,
  }
}
