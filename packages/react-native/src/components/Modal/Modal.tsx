import { forwardRef, useRef } from "react"
import type { View } from "react-native"

import { OverlayFrame } from "../../overlays/OverlayFrame"
import { useNativeTheme } from "../../theme"
import { Button } from "../Button/Button"
import { getNativeButtonContent } from "../Button/content"
import { Text } from "../Text/Text"

import type { TNativeModalProps, TNativeModalRef } from "./types"
import { useModalState } from "./useModalState"

export const Modal = forwardRef<TNativeModalRef, TNativeModalProps>((props, ref) => {
  const state = useModalState(props)
  const theme = useNativeTheme()
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
      requestOpen={state.request}
      getOpen={state.getOpen}
      panelRef={ref}
      dialogDefaults={{ gap: theme.spacing.unit * 3 }}
      initialFocusRef={props.initialFocusRef ?? (children == null ? heading : undefined)}
    >
      {({ close }) =>
        children == null ? (
          <>
            <Text ref={heading} elementType="h2" variant="b8" fontWeight="bold">
              {titleText}
            </Text>
            <Text>Placeholder text</Text>
            <Button
              order="primary"
              accessibilityLabel={closeLabel}
              customStyles={{ alignSelf: "flex-end" }}
              onPress={close}
            >
              {getNativeButtonContent(closeButtonText, {
                fontSize: theme.typography.fontSizes.b11,
                color: theme.colors.controlSelectedForeground,
              })}
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
