import type { GestureResponderEvent, NativeSyntheticEvent, View, ViewProps } from "react-native"

import type { NativeFocusData, NativeKeyData } from "./specs/CUIFocusViewNativeComponent"

export type TNativeKeyboardData = Omit<NativeKeyData, "kind"> & Readonly<{ kind: "keyboard" }>
export type TNativeKeyboardEvent = NativeSyntheticEvent<TNativeKeyboardData>
export type TNativePressEvent = GestureResponderEvent | TNativeKeyboardEvent
export type TNativeFocusEvent = NativeSyntheticEvent<NativeFocusData>
export type TNativeFocusViewRef = View
export type TNativeFocusViewProps = Omit<ViewProps, "onFocus" | "onBlur"> & {
  onFocus?: ((event: TNativeFocusEvent) => void) | null
  onBlur?: ((event: TNativeFocusEvent) => void) | null
  onKeyDown?: (event: TNativeKeyboardEvent) => void
  onKeyUp?: (event: TNativeKeyboardEvent) => void
}
