import type { TNativeAlertDialogLabels, TNativeAlertDialogProps } from "./types"

const DEFAULT_LABELS: TNativeAlertDialogLabels = {
  cancelActionButton: "Cancel",
  cancelActionButtonAriaLabel: "Cancel Action",
  confirmActionButton: "Confirm",
  confirmActionButtonAriaLabel: "Confirm Action",
}

export const resolveAlertDialogLabels = (
  props: Pick<TNativeAlertDialogProps, "labels" | "cancelActionBtnText" | "confirmActionBtnText">,
): TNativeAlertDialogLabels => {
  const labels = { ...DEFAULT_LABELS, ...props.labels }
  return {
    ...labels,
    cancelActionButton: props.cancelActionBtnText ?? labels.cancelActionButton,
    confirmActionButton: props.confirmActionBtnText ?? labels.confirmActionButton,
  }
}
