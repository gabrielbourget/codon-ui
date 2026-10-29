import { useEffect, useState } from "react"
import type { ColorValue, ViewStyle } from "react-native"

import { useNativeLinkColor } from "../Link/motion"
import { resolveNativeTagTransition, useNativeTagNumber, useNativeTagReducedMotion } from "../Tag/motion"

const colorTiming = resolveNativeTagTransition(250)
const shadowTiming = resolveNativeTagTransition(450)

const useShadowNumber = (target: number, reduced: boolean) => {
  const value = useNativeTagNumber(target, shadowTiming, reduced)
  const [rendered, setRendered] = useState(target)
  useEffect(() => {
    if (typeof value !== "object") return
    const listener = value.addListener(({ value: current }) => setRendered(current))
    return () => value.removeListener(listener)
  }, [value])
  return typeof value === "number" ? value : rendered
}

export const useNativeButtonMotion = (style: ViewStyle, foreground: ColorValue, enabled: boolean) => {
  const reduced = useNativeTagReducedMotion(enabled)
  const backgroundColor = useNativeLinkColor(style.backgroundColor ?? "transparent", 250, colorTiming.easing, enabled)
  const borderColor = useNativeLinkColor(style.borderColor ?? "transparent", 250, colorTiming.easing, enabled)
  const foregroundColor = useNativeLinkColor(foreground, 250, colorTiming.easing, enabled)
  const shadowColor = useNativeLinkColor(style.shadowColor ?? "transparent", 450, shadowTiming.easing, enabled)
  const shadowOpacity = useShadowNumber(typeof style.shadowOpacity === "number" ? style.shadowOpacity : 0, reduced)
  const shadowRadius = useShadowNumber(style.shadowRadius ?? 0, reduced)
  const shadowX = useShadowNumber(style.shadowOffset?.width ?? 0, reduced)
  const shadowY = useShadowNumber(style.shadowOffset?.height ?? 0, reduced)
  const elevation = useShadowNumber(style.elevation ?? 0, reduced)
  return {
    foregroundColor,
    viewStyle: enabled
      ? {
          ...style,
          backgroundColor,
          borderColor,
          shadowColor,
          shadowOpacity: typeof style.shadowOpacity === "object" ? style.shadowOpacity : shadowOpacity,
          shadowRadius,
          shadowOffset: { width: shadowX, height: shadowY },
          elevation,
        }
      : style,
  }
}
