import { createRef } from "react"
import { Animated, View, type NativeSyntheticEvent, type PointerEvent, type TextInput } from "react-native"

import { Modal, NativeFloatingLayerHost, NativeOverlayProvider, type ModalProps } from "../src"

export const ValidOverlay = (
  <NativeOverlayProvider>
    <Modal
      aria-label="Dialog"
      ref={createRef<View>()}
      initialFocusRef={createRef<View>()}
      restoreFocusRef={createRef<View>()}
      width="95%"
      overlayBlur={false}
    />
  </NativeOverlayProvider>
)
// @ts-expect-error an explicit native name is required
export const InvalidUnnamedModal = <Modal />
// @ts-expect-error Modal refs retain the original native View.
export const InvalidModalRef = <Modal aria-label="Dialog" ref={createRef<{ tagName: string }>()} />
export const AdapterBackedBlur = <Modal aria-label="Dialog" overlayBlur />
// @ts-expect-error DOM role forwarding is excluded
export const InvalidDialogRole = <Modal aria-label="Dialog" dialogRole="alertdialog" />
// @ts-expect-error CSS lengths are excluded
export const InvalidOverlayWidth: ModalProps = { "aria-label": "Dialog", width: "10px" }
// @ts-expect-error round is not a panel geometry
export const InvalidOverlayGeometry = <Modal aria-label="Dialog" geometry="round" />
// @ts-expect-error the provider has no public registration API
export const InvalidProvider = <NativeOverlayProvider dismissAll />

// @ts-expect-error static modal dimensions exclude animated nodes
export const InvalidAnimatedWidth = <Modal aria-label="Dialog" width={new Animated.Value(200)} />
// @ts-expect-error omission selects the default; null is not a static dimension
export const InvalidNullHeight = <Modal aria-label="Dialog" height={null} />

export const ValidEditorFocus = <Modal aria-label="Editor" initialFocusRef={createRef<TextInput>()} />

export const RenderedModal = (
  <Modal
    aria-label="Task"
    render={(props, values) => {
      const original: React.Ref<View> | undefined = props.ref
      const nativeState: import("../src").ModalRenderState = values
      nativeState.state.setOpen(false)
      return <View {...props} ref={original} />
    }}
  />
)
// @ts-expect-error Native render props carry the original View ref, not a DOM node.
export const InvalidModalRenderer = <Modal aria-label="Task" render={(_props: { ref: HTMLDivElement }) => <View />} />
// @ts-expect-error The viewport bridge is private to the native window implementation.
export const InvalidFloatingViewportBridge = <NativeFloatingLayerHost nativeBackgroundRender={() => <View />} />

export const NativeOutsideObservation = (
  <Modal
    aria-label="Task"
    shouldCloseOnInteractOutside={({ event, target, kind }) => {
      const originalTarget: typeof event.target = target
      event.persist()
      return kind === "touch" && originalTarget === event.target
    }}
    onScroll={(event) => {
      const offset: number = event.nativeEvent.contentOffset.y
      void offset
    }}
    render={(props) => {
      const viewport: import("../src").ModalViewportProps = {
        ...props,
        onClick: (event) => event.persist(),
        onClickCapture: (event) => event.persist(),
        onPointerOver: (event) => {
          const pointer: string = event.nativeEvent.pointerType
          void pointer
        },
        onPointerOverCapture: (event) => event.persist(),
        onPointerOut: (event) => event.persist(),
        onPointerOutCapture: (event) => event.persist(),
        onTouchStartCapture: (event) => event.persist(),
        onTouchMoveCapture: (event) => event.persist(),
        onTouchCancelCapture: (event) => event.persist(),
      }
      return <View {...viewport} />
    }}
  />
)
export const InvalidOutsideDOMPredicate = (
  // @ts-expect-error Native outside interaction carries the native event record, not a DOM element with tagName.
  <Modal aria-label="Task" shouldCloseOnInteractOutside={(_target: HTMLElement & { tagName: string }) => true} />
)
export const InvalidDOMWheelObservation = (
  // @ts-expect-error Native scroll observations are not browser wheel events.
  <Modal aria-label="Task" onScroll={(_event: WheelEvent & { deltaY: number; deltaMode: number }) => undefined} />
)

export const StockModalClickPayloads = (
  pointer: PointerEvent,
  activation: NativeSyntheticEvent<Record<never, never>>,
) => {
  const onClick: NonNullable<import("../src").ModalViewportProps["onClick"]> = (event) => {
    event.persist()
    const originalTarget: typeof event.target = event.target
    void originalTarget
    // @ts-expect-error Android focusable-host click has no guaranteed native pointer payload.
    const requiredPointer: PointerEvent = event
    void requiredPointer
    // @ts-expect-error No click arm promises touch coordinates or identifier.
    void event.nativeEvent.identifier
    const data = event.nativeEvent
    if ("pointerType" in data && typeof data.pointerType === "string") {
      const pointerType: string = data.pointerType
      void pointerType
    }
    if ("pointerId" in data && typeof data.pointerId === "number") {
      const pointerId: number = data.pointerId
      void pointerId
    }
  }
  const onClickCapture: NonNullable<import("../src").ModalViewportProps["onClickCapture"]> = onClick
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
export const ApprovedModalBrowserBoundary: Extract<TExcludedNativeOverlayFields, keyof ModalProps> extends never
  ? true
  : never = true
export const ApprovedViewportBrowserBoundary: Extract<
  TExcludedNativeOverlayFields,
  keyof import("../src").ModalViewportProps
> extends never
  ? true
  : never = true
export const ExcludedModalTranslate = (
  // @ts-expect-error Owner-approved native overlay boundary omits translate.
  <Modal aria-label="Task" translate="no" />
)
export const ExcludedModalOnAuxClick = (
  // @ts-expect-error Owner-approved native overlay boundary omits onAuxClick.
  <Modal aria-label="Task" onAuxClick={() => undefined} />
)
export const ExcludedModalOnAuxClickCapture = (
  // @ts-expect-error Owner-approved native overlay boundary omits onAuxClickCapture.
  <Modal aria-label="Task" onAuxClickCapture={() => undefined} />
)
export const ExcludedModalOnContextMenu = (
  // @ts-expect-error Owner-approved native overlay boundary omits onContextMenu.
  <Modal aria-label="Task" onContextMenu={() => undefined} />
)
export const ExcludedModalOnContextMenuCapture = (
  // @ts-expect-error Owner-approved native overlay boundary omits onContextMenuCapture.
  <Modal aria-label="Task" onContextMenuCapture={() => undefined} />
)
export const ExcludedModalOnDoubleClick = (
  // @ts-expect-error Owner-approved native overlay boundary omits onDoubleClick.
  <Modal aria-label="Task" onDoubleClick={() => undefined} />
)
export const ExcludedModalOnDoubleClickCapture = (
  // @ts-expect-error Owner-approved native overlay boundary omits onDoubleClickCapture.
  <Modal aria-label="Task" onDoubleClickCapture={() => undefined} />
)
export const ExcludedModalOnScrollCapture = (
  // @ts-expect-error Owner-approved native overlay boundary omits onScrollCapture.
  <Modal aria-label="Task" onScrollCapture={() => undefined} />
)
export const ExcludedModalOnWheel = (
  // @ts-expect-error Owner-approved native overlay boundary omits onWheel.
  <Modal aria-label="Task" onWheel={() => undefined} />
)
export const ExcludedModalOnWheelCapture = (
  // @ts-expect-error Owner-approved native overlay boundary omits onWheelCapture.
  <Modal aria-label="Task" onWheelCapture={() => undefined} />
)

export const ExcludedModalInert = (
  // @ts-expect-error Owner-approved native inert boundary: no partial arbitrary-editor masking promise.
  <Modal aria-label="Task" inert />
)

export const OriginalModalCaptureContract = (
  original: import("../src").TNativeModalRef,
  viewport: import("../src").ModalViewportProps,
  event: PointerEvent,
) => {
  const handler = (actual: PointerEvent) => {
    actual.persist()
    const pointerId: number = actual.nativeEvent.pointerId
    void pointerId
  }
  const props: import("../src").ModalViewportProps = {
    ...viewport,
    onGotPointerCapture: handler,
    onGotPointerCaptureCapture: handler,
    onLostPointerCapture: handler,
    onLostPointerCaptureCapture: handler,
    onPointerOver: (actual) => {
      if (actual.nativeEvent.pointerType === "mouse") handler(actual)
    },
    onPointerOverCapture: (actual) => {
      if (actual.nativeEvent.pointerType === "mouse") handler(actual)
    },
    onPointerOut: (actual) => {
      if (actual.nativeEvent.pointerType === "mouse") handler(actual)
    },
    onPointerOutCapture: (actual) => {
      if (actual.nativeEvent.pointerType === "mouse") handler(actual)
    },
  }
  original.setPointerCapture(event.nativeEvent.pointerId)
  const captured: boolean = original.hasPointerCapture(event.nativeEvent.pointerId)
  original.releasePointerCapture(event.nativeEvent.pointerId)
  // @ts-expect-error Original native capture APIs accept native numeric pointer IDs, not collection labels.
  original.setPointerCapture("item-id")
  void captured
  return <View {...props} />
}
