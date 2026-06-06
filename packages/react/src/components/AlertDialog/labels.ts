export type TAlertDialogLabels = {
  cancelActionButton: string
  cancelActionButtonAriaLabel: string
  confirmActionButton: string
  confirmActionButtonAriaLabel: string
}

export type TPartialAlertDialogLabels = Partial<TAlertDialogLabels>

export const DEFAULT_ALERT_DIALOG_LABELS: TAlertDialogLabels = {
  cancelActionButton: "Cancel",
  cancelActionButtonAriaLabel: "Cancel Action",
  confirmActionButton: "Confirm",
  confirmActionButtonAriaLabel: "Confirm Action",
}

export const resolveAlertDialogLabels = (args: {
  labels?: TPartialAlertDialogLabels
  cancelActionBtnText?: string
  confirmActionBtnText?: string
}): TAlertDialogLabels => {
  const { labels, cancelActionBtnText, confirmActionBtnText } = args
  const resolvedLabels = {
    ...DEFAULT_ALERT_DIALOG_LABELS,
    ...labels,
  }

  return {
    ...resolvedLabels,
    cancelActionButton: cancelActionBtnText ?? resolvedLabels.cancelActionButton,
    confirmActionButton: confirmActionBtnText ?? resolvedLabels.confirmActionButton,
  }
}
