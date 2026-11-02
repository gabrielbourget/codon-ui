import { createRef } from "react"
import { View, type NativeSyntheticEvent, type PointerEvent } from "react-native"

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
// @ts-expect-error AlertDialog refs retain the original native View.
export const InvalidAlertRef = <AlertDialog {...ValidAlertProps} ref={createRef<{ tagName: string }>()} />
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

export const RenderedAlert = (
  <AlertDialog
    {...ValidAlertProps}
    render={(props, values) => {
      const current: boolean = values.state.isOpen
      if (current) values.state.close()
      return <View {...props} />
    }}
  />
)
export const InvalidAlertRenderer = (
  // @ts-expect-error Alert renderers retain the original native viewport ref.
  <AlertDialog {...ValidAlertProps} render={(_props: { ref: HTMLDivElement }) => <View />} />
)

export const AlertOutsideObservation = (
  <AlertDialog
    {...ValidAlertProps}
    shouldCloseOnInteractOutside={({ event }) => {
      event.persist()
      return false
    }}
    onScroll={(event) => {
      const offset: number = event.nativeEvent.contentOffset.y
      void offset
    }}
  />
)
export const InvalidAlertDOMPredicate = (
  <AlertDialog
    {...ValidAlertProps}
    // @ts-expect-error Native alert predicates do not promise an original DOM element with tagName.
    shouldCloseOnInteractOutside={(_target: HTMLElement & { tagName: string }) => true}
  />
)

export const StockAlertClickPayloads = (
  pointer: PointerEvent,
  activation: NativeSyntheticEvent<Record<never, never>>,
) => {
  type TViewport = Parameters<NonNullable<AlertDialogProps["render"]>>[0]
  const onClick: NonNullable<TViewport["onClick"]> = (event) => {
    event.persist()
    // @ts-expect-error AlertDialog's native click may contain empty Android activation data.
    const requiredPointer: PointerEvent = event
    void requiredPointer
    const data = event.nativeEvent
    if ("pointerType" in data && typeof data.pointerType === "string") {
      const pointerType: string = data.pointerType
      void pointerType
    }
  }
  const onClickCapture: NonNullable<TViewport["onClickCapture"]> = onClick
  onClick(pointer)
  onClick(activation)
  onClickCapture(pointer)
  onClickCapture(activation)
  return { onClick, onClickCapture }
}

type TExcludedNativeOverlayFields =
  | "inert"
  | "translate"
  | "onAuxClick"
  | "onAuxClickCapture"
  | "onContextMenu"
  | "onContextMenuCapture"
  | "onDoubleClick"
  | "onDoubleClickCapture"
  | "onScrollCapture"
  | "onWheel"
  | "onWheelCapture"
export const ApprovedAlertDialogBrowserBoundary: Extract<
  TExcludedNativeOverlayFields,
  keyof AlertDialogProps
> extends never
  ? true
  : never = true
export const ExcludedAlertDialogTranslate = (
  // @ts-expect-error Owner-approved native overlay boundary omits translate.
  <AlertDialog {...ValidAlertProps} translate="no" />
)
export const ExcludedAlertDialogOnAuxClick = (
  // @ts-expect-error Owner-approved native overlay boundary omits onAuxClick.
  <AlertDialog {...ValidAlertProps} onAuxClick={() => undefined} />
)
export const ExcludedAlertDialogOnAuxClickCapture = (
  // @ts-expect-error Owner-approved native overlay boundary omits onAuxClickCapture.
  <AlertDialog {...ValidAlertProps} onAuxClickCapture={() => undefined} />
)
export const ExcludedAlertDialogOnContextMenu = (
  // @ts-expect-error Owner-approved native overlay boundary omits onContextMenu.
  <AlertDialog {...ValidAlertProps} onContextMenu={() => undefined} />
)
export const ExcludedAlertDialogOnContextMenuCapture = (
  // @ts-expect-error Owner-approved native overlay boundary omits onContextMenuCapture.
  <AlertDialog {...ValidAlertProps} onContextMenuCapture={() => undefined} />
)
export const ExcludedAlertDialogOnDoubleClick = (
  // @ts-expect-error Owner-approved native overlay boundary omits onDoubleClick.
  <AlertDialog {...ValidAlertProps} onDoubleClick={() => undefined} />
)
export const ExcludedAlertDialogOnDoubleClickCapture = (
  // @ts-expect-error Owner-approved native overlay boundary omits onDoubleClickCapture.
  <AlertDialog {...ValidAlertProps} onDoubleClickCapture={() => undefined} />
)
export const ExcludedAlertDialogOnScrollCapture = (
  // @ts-expect-error Owner-approved native overlay boundary omits onScrollCapture.
  <AlertDialog {...ValidAlertProps} onScrollCapture={() => undefined} />
)
export const ExcludedAlertDialogOnWheel = (
  // @ts-expect-error Owner-approved native overlay boundary omits onWheel.
  <AlertDialog {...ValidAlertProps} onWheel={() => undefined} />
)
export const ExcludedAlertDialogOnWheelCapture = (
  // @ts-expect-error Owner-approved native overlay boundary omits onWheelCapture.
  <AlertDialog {...ValidAlertProps} onWheelCapture={() => undefined} />
)

export const ExcludedAlertDialogInert = (
  // @ts-expect-error Owner-approved native inert boundary: no partial arbitrary-editor masking promise.
  <AlertDialog {...ValidAlertProps} inert />
)

export const OriginalAlertCaptureContract = (
  original: import("../src").TNativeAlertDialogRef,
  viewport: Parameters<NonNullable<AlertDialogProps["render"]>>[0],
  event: PointerEvent,
) => {
  const handler = (actual: PointerEvent) => {
    const pointerId: number = actual.nativeEvent.pointerId
    actual.persist()
    void pointerId
  }
  const props: typeof viewport = {
    ...viewport,
    onGotPointerCapture: handler,
    onGotPointerCaptureCapture: handler,
    onLostPointerCapture: handler,
    onLostPointerCaptureCapture: handler,
  }
  original.setPointerCapture(event.nativeEvent.pointerId)
  const captured: boolean = original.hasPointerCapture(event.nativeEvent.pointerId)
  original.releasePointerCapture(event.nativeEvent.pointerId)
  // @ts-expect-error No replacement/ref facade changes the original native numeric pointer-ID API.
  original.releasePointerCapture("stale-label")
  void captured
  return <View {...props} />
}
