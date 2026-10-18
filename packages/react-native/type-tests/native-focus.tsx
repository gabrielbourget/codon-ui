import { createRef } from "react"
import type { TextInput, View } from "react-native"

import { NativeFocusView, focusNativeTarget, blurNativeTarget, type TNativePressEvent } from "../src"

const viewRef = createRef<View>()
const inputRef = createRef<TextInput>()
export const focusable = (
  <NativeFocusView
    ref={viewRef}
    style={[{ height: 0, width: "0%" }, false]}
    accessibilityLabel="Details"
    onKeyDown={(event) => {
      event.persist()
      event.nativeEvent.metaKey.valueOf()
      event.nativeEvent.nativeCode.toFixed()
    }}
    onPointerEnter={(event) => event.nativeEvent.pointerType.toUpperCase()}
    onFocus={(event) => {
      event.nativeEvent.target.toFixed()
      event.nativeEvent.origin.toUpperCase()
    }}
  />
)
focusNativeTarget(viewRef.current)
focusNativeTarget(inputRef.current)
blurNativeTarget(null)

export const nativePress = (event: TNativePressEvent) => {
  event.persist()
  if ("kind" in event.nativeEvent) {
    if (event.nativeEvent.kind === "keyboard") {
      event.nativeEvent.metaKey.valueOf()
      event.nativeEvent.key.toUpperCase()
    } else {
      event.nativeEvent.source.toUpperCase()
      event.nativeEvent.observedAt.toFixed()
      // @ts-expect-error Activation carries no fabricated hardware key.
      void event.nativeEvent.nativeCode
      // @ts-expect-error Callback observation time is not a hardware timestamp.
      void event.nativeEvent.timestamp
    }
  } else event.nativeEvent.pageX.toFixed()
}
// @ts-expect-error A keyboard event has no fabricated touch coordinates.
export const fabricatedTouch = <NativeFocusView onKeyDown={(event) => event.nativeEvent.pageX} />
// @ts-expect-error Capture/default handling is private native policy.
export const lateDefault = <NativeFocusView capturedKeys={["0000:Enter"]} />
// @ts-expect-error Native press/click wiring is private adapter policy.
export const privatePressable = <NativeFocusView nativePressable />

// @ts-expect-error Native activation transport is private adapter policy.
export const privateActivation = <NativeFocusView onNativeActivation={() => undefined} />
