import type { ColorValue, StyleProp, ViewProps, ViewStyle } from "react-native"

export const LOADER_TIME_UNITS = ["ms", "s"] as const
export type TNativeLoaderDuration = number | `${number}${(typeof LOADER_TIME_UNITS)[number]}`
export type TNativeLoaderRootStyle = ViewStyle & { color?: ColorValue }
export type TNativeLoaderRenderState = Readonly<{ duration: number; isMotionEnabled: boolean }>
export type TNativeLoaderStyleState = TNativeLoaderRenderState & { defaultStyle: TNativeLoaderRootStyle }
export type TNativeLoaderHostProps = Pick<
  ViewProps,
  | "testID"
  | "nativeID"
  | "id"
  | "onLayout"
  | "pointerEvents"
  | "collapsable"
  | "accessible"
  | "accessibilityLabel"
  | "accessibilityHint"
  | "accessibilityLiveRegion"
  | "importantForAccessibility"
  | "accessibilityElementsHidden"
  | "aria-label"
> & {
  ariaLabel?: string
  "data-testid"?: string
  style?: StyleProp<TNativeLoaderRootStyle> | ((state: TNativeLoaderStyleState) => StyleProp<TNativeLoaderRootStyle>)
  "aria-busy"?: never
  "aria-valuemin"?: never
  "aria-valuemax"?: never
  "aria-valuenow"?: never
  "aria-valuetext"?: never
}
