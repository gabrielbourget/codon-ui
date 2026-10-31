import type { GestureResponderEvent, NativeSyntheticEvent, View, ViewProps } from "react-native"

import type { NativeFocusData, NativeKeyData, NativeFormActionStatus } from "./specs/CUIFocusViewNativeComponent"

export type TNativeKeyboardData = Omit<NativeKeyData, "kind"> & Readonly<{ kind: "keyboard" }>
export type TNativeKeyboardEvent = NativeSyntheticEvent<TNativeKeyboardData>
export const NATIVE_ACTIVATION_SOURCES = ["android-click", "ios-accessibility-activate"] as const
export type TNativeActivationSource = (typeof NATIVE_ACTIVATION_SOURCES)[number]
export type TNativeInteractionEvent = GestureResponderEvent | TNativeKeyboardEvent
export type TNativeActivationData = Readonly<{
  kind: "activation"
  target: number
  source: TNativeActivationSource
  observedAt: number
}>
export type TNativeActivationEvent = NativeSyntheticEvent<TNativeActivationData>
export type TNativePressEvent = TNativeInteractionEvent | TNativeActivationEvent
export type TNativeFocusEvent = NativeSyntheticEvent<NativeFocusData>
export type TNativeFocusViewRef = View
export type TNativeFocusViewProps = Omit<ViewProps, "onFocus" | "onBlur"> & {
  nativeFormActionBinding?: string
  onNativeFormActionStatus?: (event: NativeSyntheticEvent<NativeFormActionStatus>) => void
  onFocus?: ((event: TNativeFocusEvent) => void) | null
  onBlur?: ((event: TNativeFocusEvent) => void) | null
  onKeyDown?: (event: TNativeKeyboardEvent) => void
  onKeyUp?: (event: TNativeKeyboardEvent) => void
}
