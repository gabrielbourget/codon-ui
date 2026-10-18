import type { ReactNode } from "react"
import type { StyleProp, TextStyle, ViewStyle } from "react-native"

import type { TNativeFocusViewProps } from "../../input/types"
import type { TNativeButtonProps } from "../Button/types"
import type { TNativeTextProps } from "../Text/types"

export const AVAILABLE_TOAST_POSITIONS = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-right",
  "bottom-center",
  "bottom-left",
] as const
export type TNativeToastPosition = (typeof AVAILABLE_TOAST_POSITIONS)[number]
export const AVAILABLE_TOAST_TYPES = ["info", "warning", "error", "danger", "delete", "success"] as const
export type TNativeToastType = (typeof AVAILABLE_TOAST_TYPES)[number]
export type TNativeToastID = number | string
export const DEFAULT_TOAST_DURATION = 4000
export const DEFAULT_TOAST_WIDTH = 325
export const DEFAULT_VIEWPORT_OFFSET = 15
export const DEFAULT_MAX_VISIBLE_TOASTS = 5
export const DEFAULT_TOAST_GAP = 15
export const DEFAULT_TOAST_POSITION = "top-right"
export const DURATION_BEFORE_UNMOUNT = 250

export type TNativeToastLabels = {
  cancelActionButton: string
  cancelActionButtonAriaLabel: string
  closeButtonAriaLabel: string
  confirmActionButton: string
  confirmActionButtonAriaLabel: string
}
export type TNativeToast = {
  id: TNativeToastID
  height?: ViewStyle["height"]
  width?: ViewStyle["width"]
  style?: StyleProp<ViewStyle>
  position?: TNativeToastPosition
  type?: TNativeToastType
  geometry?: "orthogonal" | "rounded"
  raised?: boolean
  dismissable?: boolean
  duration?: number | "persistent"
  deletingToast?: boolean
  important?: boolean
  cancelAction?: () => unknown
  confirmAction?: () => unknown
  cancelActionBtnText?: string
  confirmActionBtnText?: string
  labels?: Partial<TNativeToastLabels>
  showCancelAction?: boolean
  showButtons?: boolean
  titleText?: string
  bodyText?: string
  ToastIcon?: ReactNode
  CloseIcon?: ReactNode
  onDismiss?: (toast: TNativeToast) => void
  onAutoClose?: (toast: TNativeToast) => void
  customStyles?: StyleProp<ViewStyle>
  customTopRibbonStyles?: StyleProp<ViewStyle>
  customTopRibbonLeftContentStyles?: StyleProp<ViewStyle>
  customTitleStyles?: StyleProp<TextStyle>
  customContentStyles?: StyleProp<ViewStyle>
  customBodyTextStyles?: StyleProp<TextStyle>
  customBodyTextProps?: Partial<TNativeTextProps>
  customBottomRowStyles?: StyleProp<ViewStyle>
  customTimestampStyles?: StyleProp<TextStyle>
  customTimestampTextProps?: Partial<TNativeTextProps>
  customButtonRowStyles?: StyleProp<ViewStyle>
  customCloseButtonStyles?: StyleProp<TextStyle>
  customCloseButtonProps?: Partial<TNativeButtonProps>
  customCancelButtonStyles?: StyleProp<TextStyle>
  customCancelButtonProps?: Partial<TNativeButtonProps>
  customConfirmButtonStyles?: StyleProp<TextStyle>
  customConfirmButtonProps?: Partial<TNativeButtonProps>
}
export type TNativeExternalToast = Omit<TNativeToast, "id"> & { id?: TNativeToastID }
export type TNativeToastPublication = TNativeToast | { id: TNativeToastID; dismiss: true }
export type TNativeToastHeight = { id: TNativeToastID; height: number; position: TNativeToastPosition }

export type TNativeToasterProps = Omit<TNativeFocusViewProps, "children" | "style" | "onKeyDown" | "onKeyUp"> & {
  duration?: number | "persistent"
  pauseWhenPageIsHidden?: boolean
  expandToggleHotkey?: readonly string[]
  dismissalHotkey?: readonly string[]
  position?: TNativeToastPosition
  toastGap?: number
  offset?: number
  expandByDefault?: boolean
  maxVisibleToasts?: number
  toastLabels?: Partial<TNativeToastLabels>
  customRootStyles?: StyleProp<ViewStyle>
  customStyles?: StyleProp<ViewStyle>
  customStackStyles?: StyleProp<ViewStyle>
  customToastBridgeStyles?: StyleProp<ViewStyle>
  style?: StyleProp<ViewStyle>
  "data-testid"?: string
  "aria-label"?: string
  ariaLabel?: string
}

export type TNativeToastProps = {
  toast: TNativeToast
  index: number
  numToasts: number
  position: TNativeToastPosition
  offset: number
  firstHeight: number
  maxVisibleToasts: number
  toasterExpanded: boolean
  expandByDefault?: boolean
  interacting: boolean
  pauseWhenPageIsHidden?: boolean
  duration?: number | "persistent"
  dismissalHotkey?: readonly string[]
  toastLabels?: Partial<TNativeToastLabels>
  toastGap?: number
  removeToast: (toast: TNativeToast) => void
  onHeight: (id: TNativeToastID, height: number) => void
}
