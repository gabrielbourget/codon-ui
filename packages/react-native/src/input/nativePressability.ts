import type { RefObject } from "react"
import type { GestureResponderEvent, PressableProps, View, ViewProps } from "react-native"
// @ts-expect-error Pinned RN publishes this inspected hook without TypeScript declarations.
import upstreamUseAndroidRippleForView from "react-native/Libraries/Components/Pressable/useAndroidRippleForView"
// @ts-expect-error Pinned RN publishes this inspected hook without TypeScript declarations.
import upstreamUsePressability from "react-native/Libraries/Pressability/usePressability"

type TConfig = Pick<
  PressableProps,
  | "cancelable"
  | "disabled"
  | "hitSlop"
  | "android_disableSound"
  | "delayHoverIn"
  | "delayHoverOut"
  | "delayLongPress"
  | "onBlur"
  | "onFocus"
  | "onHoverIn"
  | "onHoverOut"
  | "onLongPress"
  | "onPress"
  | "onPressIn"
  | "onPressMove"
  | "onPressOut"
> & {
  blockNativeResponder?: boolean
  pressRectOffset?: PressableProps["pressRetentionOffset"]
  delayPressIn?: number
}
type THandlers = Pick<
  ViewProps,
  | "onResponderGrant"
  | "onResponderMove"
  | "onResponderRelease"
  | "onResponderTerminate"
  | "onResponderTerminationRequest"
  | "onStartShouldSetResponder"
  | "onFocus"
  | "onBlur"
> & {
  onClick: (event: GestureResponderEvent) => void
}
type TRipple = {
  viewProps: Record<string, unknown>
  onPressIn: (event: GestureResponderEvent) => void
  onPressMove: (event: GestureResponderEvent) => void
  onPressOut: (event: GestureResponderEvent) => void
} | null

export const useNativePressability: (config: TConfig) => THandlers = upstreamUsePressability
export const useNativeAndroidRipple: (
  config: PressableProps["android_ripple"],
  ref: RefObject<View | null>,
) => TRipple = upstreamUseAndroidRippleForView
