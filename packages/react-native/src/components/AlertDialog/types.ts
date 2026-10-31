import type { ReactNode } from "react"

import type { TNativeModalProps, TNativeModalRef } from "../Modal/types"

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
export type TNativeAlertDialogType = (typeof AVAILABLE_ALERT_DIALOG_TYPES)[number]
export type TNativeAlertDialogLabels = Readonly<{
  cancelActionButton: string
  cancelActionButtonAriaLabel: string
  confirmActionButton: string
  confirmActionButtonAriaLabel: string
}>
export type TPartialNativeAlertDialogLabels = Partial<TNativeAlertDialogLabels>
export type TNativeAlertDialogRef = TNativeModalRef
type TAlertFrameProps<T> = T extends unknown
  ? Omit<T, "titleText" | "closeButtonText" | "closeLabel" | "isScrollable" | "color" | "order">
  : never
export type TNativeAlertDialogProps = TAlertFrameProps<TNativeModalProps> & {
  type?: TNativeAlertDialogType
  titleText: string
  bodyText: string
  AlertIcon?: ReactNode
  showCancelAction?: boolean
  cancelAction?: () => unknown
  confirmAction?: () => unknown
  cancelActionBtnText?: string
  confirmActionBtnText?: string
  labels?: TPartialNativeAlertDialogLabels
}
