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
    event.nativeEvent.metaKey.valueOf()
    event.nativeEvent.key.toUpperCase()
  } else event.nativeEvent.pageX.toFixed()
}
// @ts-expect-error A keyboard event has no fabricated touch coordinates.
export const fabricatedTouch = <NativeFocusView onKeyDown={(event) => event.nativeEvent.pageX} />
// @ts-expect-error Capture/default handling is private native policy.
export const lateDefault = <NativeFocusView capturedKeys={["0000:Enter"]} />
