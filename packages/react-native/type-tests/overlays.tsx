import { createRef } from "react"
import { Animated, type TextInput, type View } from "react-native"

import { Modal, NativeOverlayProvider, type ModalProps } from "../src"

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
// @ts-expect-error blur needs a separately approved dependency/host contract
export const InvalidNativeBlur = <Modal aria-label="Dialog" overlayBlur />
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
