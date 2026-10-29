import type { ViewStyle } from "react-native"

import { useNativeLinkColor } from "../Link/motion"
import { resolveNativeTagTransition, useNativeTagNumberValue, useNativeTagReducedMotion } from "../Tag/motion"

const shapeTiming = resolveNativeTagTransition(250)

export const useNativeRadioShape = (style: ViewStyle): ViewStyle => {
  const reduced = useNativeTagReducedMotion()
  const backgroundColor = useNativeLinkColor(style.backgroundColor ?? "transparent", 250, shapeTiming.easing)
  const width = useNativeTagNumberValue(typeof style.width === "number" ? style.width : 0, shapeTiming, reduced)
  const height = useNativeTagNumberValue(typeof style.height === "number" ? style.height : 0, shapeTiming, reduced)
  const radius = useNativeTagNumberValue(
    typeof style.borderRadius === "number" ? style.borderRadius : 0,
    shapeTiming,
    reduced,
  )
  const opacity = useNativeTagNumberValue(typeof style.opacity === "number" ? style.opacity : 1, shapeTiming, reduced)
  return {
    ...style,
    backgroundColor,
    width: typeof style.width === "number" ? width : style.width,
    height: typeof style.height === "number" ? height : style.height,
    borderRadius: typeof style.borderRadius === "number" ? radius : style.borderRadius,
    opacity: style.opacity === undefined || typeof style.opacity === "number" ? opacity : style.opacity,
  }
}
