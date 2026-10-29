import type { ColorValue, ViewStyle } from "react-native"

import { useNativeLinkColor } from "../Link/motion"
import { useNativeRadioShape } from "../Radio/motion"
import { resolveNativeTagTransition, useNativeTagNumberValue, useNativeTagReducedMotion } from "../Tag/motion"

const shapeTiming = resolveNativeTagTransition(175)
const glyphTiming = resolveNativeTagTransition({ duration: 250, easing: "ease" })

export const useNativeCheckboxMotion = (style: ViewStyle, foreground: ColorValue, filled: boolean) => {
  const shape = useNativeRadioShape(style, 175)
  const reduced = useNativeTagReducedMotion()
  const shadowColor = useNativeLinkColor(style.shadowColor ?? "transparent", 175, shapeTiming.easing)
  const shadowOpacity = useNativeTagNumberValue(
    typeof style.shadowOpacity === "number" ? style.shadowOpacity : 0,
    shapeTiming,
    reduced,
  )
  const shadowRadius = useNativeTagNumberValue(style.shadowRadius ?? 0, shapeTiming, reduced)
  const shadowX = useNativeTagNumberValue(style.shadowOffset?.width ?? 0, shapeTiming, reduced)
  const shadowY = useNativeTagNumberValue(style.shadowOffset?.height ?? 0, shapeTiming, reduced)
  const elevation = useNativeTagNumberValue(style.elevation ?? 0, shapeTiming, reduced)
  const ink = useNativeTagNumberValue(filled ? 1 : 0, glyphTiming, reduced)
  const glyphForeground = useNativeLinkColor(foreground, 250, glyphTiming.easing)
  return {
    shape: {
      ...shape,
      shadowColor,
      shadowOpacity,
      shadowRadius,
      shadowOffset: { width: shadowX, height: shadowY },
      elevation,
    },
    ink,
    glyphForeground,
  }
}
