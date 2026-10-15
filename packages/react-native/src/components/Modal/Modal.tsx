import { forwardRef, useRef } from "react"
import type { View } from "react-native"

import { OverlayFrame } from "../../overlays/OverlayFrame"
import { Button } from "../Button/Button"
import { getNativeButtonContent } from "../Button/content"
import { Text } from "../Text/Text"

import type { TNativeModalProps, TNativeModalRef } from "./types"
import { useModalState } from "./useModalState"

export const Modal = forwardRef<TNativeModalRef, TNativeModalProps>((props, ref) => {
  const state = useModalState(props)
  const heading = useRef<View>(null)
  const { children, titleText = "Modal Title", closeButtonText = "Close Modal" } = props
  const closeLabel = props.closeLabel ?? (typeof closeButtonText === "string" ? closeButtonText : undefined)
  if (children == null && (typeof closeLabel !== "string" || !closeLabel.trim()))
    throw new TypeError("Modal: fallback Close requires a nonempty closeLabel or string closeButtonText")
  return (
    <OverlayFrame
      props={props}
      open={state.open}
      requestClose={() => state.request(false)}
      panelRef={ref}
      initialFocusRef={props.initialFocusRef ?? (children == null ? heading : undefined)}
    >
      {(close) =>
        children == null ? (
          <>
            <Text ref={heading} elementType="h2" variant="b8" fontWeight="bold">
              {titleText}
            </Text>
            <Text>Placeholder text</Text>
            <Button order="primary" accessibilityLabel={closeLabel} onPress={close}>
              {closeButtonText}
            </Button>
          </>
        ) : (
          getNativeButtonContent(children)
        )
      }
    </OverlayFrame>
  )
})
Modal.displayName = "Modal"
