import type { ColorValue, StyleProp, View, ViewStyle } from "react-native"

import type { TNativeDisplayDimension } from "../displayDimensions"
import type { TNativeLoaderDuration, TNativeLoaderHostProps } from "../Loaders/types"

export type TNativeLaggingLinesLoaderRef = View
export type TNativeLaggingLineStyle = ViewStyle & { color?: ColorValue; animationDuration?: TNativeLoaderDuration }
export type TNativeLaggingLinesLoaderProps = TNativeLoaderHostProps & {
  width?: TNativeDisplayDimension
  color?: ColorValue
  duration?: TNativeLoaderDuration
  customStyles?: StyleProp<TNativeLaggingLineStyle>
}
