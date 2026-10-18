import { createRef } from "react"
import type { View } from "react-native"

import {
  AlertDialog,
  AVAILABLE_ALERT_DIALOG_TYPES,
  NativeOverlayProvider,
  type AlertDialogLabels,
  type AlertDialogProps,
  type AvailableAlertDialogTypes,
  type PartialAlertDialogLabels,
} from "../src"

const labels: AlertDialogLabels = {
  cancelActionButton: "Annuler",
  cancelActionButtonAriaLabel: "Annuler les modifications",
  confirmActionButton: "Confirmer",
  confirmActionButtonAriaLabel: "Confirmer les modifications",
}
export const PartialLabels: PartialAlertDialogLabels = { confirmActionButton: "Continue" }
export const AlertType: AvailableAlertDialogTypes = AVAILABLE_ALERT_DIALOG_TYPES[0]
export const ValidAlertProps: AlertDialogProps = {
  "aria-label": "Review",
  titleText: "Review",
  bodyText: "Review the changes.",
  labels,
  type: AlertType,
  width: "95%",
}
export const ValidAlert = (
  <NativeOverlayProvider>
    <AlertDialog {...ValidAlertProps} ref={createRef<View>()} />
  </NativeOverlayProvider>
)
// @ts-expect-error native dialog names are explicit and required
export const InvalidUnnamedAlert = <AlertDialog titleText="Title" bodyText="Body" />
// @ts-expect-error title/body text are required strings
export const InvalidAlertTitle = <AlertDialog {...ValidAlertProps} titleText={<></>} />
// @ts-expect-error the six canonical tones are closed
export const InvalidAlertTone = <AlertDialog {...ValidAlertProps} type="urgent" />
export const AdapterBackedAlertBlur = <AlertDialog {...ValidAlertProps} overlayBlur />
// @ts-expect-error AlertDialog owns its body/action scrolling
export const InvalidAlertScroll = <AlertDialog {...ValidAlertProps} isScrollable={false} />
// @ts-expect-error Modal's starter Close is not an AlertDialog action
export const InvalidAlertCloseLabel = <AlertDialog {...ValidAlertProps} closeLabel="Close" />
// @ts-expect-error no new action-order or root-color prop is introduced
export const InvalidAlertOrder = <AlertDialog {...ValidAlertProps} order="primary" />
