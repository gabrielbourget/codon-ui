import type { ViewStyle } from "react-native"

import { useNativeLinkColor } from "../Link/motion"
import { resolveNativeTagTransition, useNativeTagNumberValue, useNativeTagReducedMotion } from "../Tag/motion"

const colorTiming = resolveNativeTagTransition(250)
const movementTiming = resolveNativeTagTransition(225)

export const useNativeSwitchMotion = (
  track: ViewStyle,
  indicator: ViewStyle,
  maxLeft: number,
  ownsPosition: boolean,
) => {
  const reduced = useNativeTagReducedMotion()
  const backgroundColor = useNativeLinkColor(track.backgroundColor ?? "transparent", 250, colorTiming.easing)
  const borderColor = useNativeLinkColor(track.borderColor ?? "transparent", 250, colorTiming.easing)
  const indicatorColor = useNativeLinkColor(indicator.backgroundColor ?? "transparent", 250, colorTiming.easing)
  const left = useNativeTagNumberValue(typeof indicator.left === "number" ? indicator.left : 0, movementTiming, reduced)
  return {
    track: { ...track, backgroundColor, borderColor },
    indicator: {
      ...indicator,
      backgroundColor: indicatorColor,
      left:
        typeof indicator.left === "number"
          ? ownsPosition
            ? Math.max(0, Math.min(maxLeft, left))
            : left
          : indicator.left,
    },
  }
}
