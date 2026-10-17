import type { ColorValue, StyleProp, View } from "react-native"

import type { TNativeDisplayDimension } from "../displayDimensions"
import type { TNativeLoaderDuration, TNativeLoaderHostProps, TNativeLoaderRootStyle } from "../Loaders/types"

export type TNativeCircleLoaderRef = View
export type TNativeCircleLoaderProps = TNativeLoaderHostProps & {
  spinnerColor?: ColorValue
  spinnerTrackWidth?: number
  spinnerTrackColor?: ColorValue
  spinnerTrackIsTransparent?: boolean
  duration?: TNativeLoaderDuration
  size?: TNativeDisplayDimension
  customStyles?: StyleProp<TNativeLoaderRootStyle>
}
