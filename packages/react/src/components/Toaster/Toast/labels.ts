export type TToastLabels = {
  cancelActionButton: string
  cancelActionButtonAriaLabel: string
  closeButtonAriaLabel: string
  confirmActionButton: string
  confirmActionButtonAriaLabel: string
}

export type TPartialToastLabels = Partial<TToastLabels>

export const DEFAULT_TOAST_LABELS: TToastLabels = {
  cancelActionButton: "Cancel",
  cancelActionButtonAriaLabel: "Cancel Action",
  closeButtonAriaLabel: "Close Toast",
  confirmActionButton: "Confirm",
  confirmActionButtonAriaLabel: "Confirm Action",
}

export const resolveToastLabels = (args: {
  labels?: TPartialToastLabels
  cancelActionBtnText?: string
  confirmActionBtnText?: string
}): TToastLabels => {
  const { labels, cancelActionBtnText, confirmActionBtnText } = args

  return {
    ...DEFAULT_TOAST_LABELS,
    cancelActionButton: cancelActionBtnText ?? DEFAULT_TOAST_LABELS.cancelActionButton,
    confirmActionButton: confirmActionBtnText ?? DEFAULT_TOAST_LABELS.confirmActionButton,
    ...labels,
  }
}
