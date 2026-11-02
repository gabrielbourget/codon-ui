import { forwardRef } from "react"
import { View, type ViewProps, type ViewStyle } from "react-native"

import { useNativeTheme } from "../../theme"
import { resolveNativeTagTransition, useNativeTagColor, useNativeTagReducedMotion } from "../Tag/motion"

type TNativeSliderThumbPaintProps = Omit<ViewProps, "style"> & { style: ViewStyle }

export const NativeSliderThumbPaint = forwardRef<View, TNativeSliderThumbPaintProps>(({ style, ...props }, ref) => {
  const theme = useNativeTheme()
  const reduced = useNativeTagReducedMotion()
  const timing = resolveNativeTagTransition(theme.transitions?.backgroundColor)
  const color = useNativeTagColor(style.backgroundColor, timing, reduced, true)
  return <View {...props} ref={ref} style={{ ...style, backgroundColor: color.rendered }} />
})
NativeSliderThumbPaint.displayName = "NativeSliderThumbPaint"
