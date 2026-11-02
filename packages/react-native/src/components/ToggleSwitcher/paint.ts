import type { ColorValue, ViewStyle } from "react-native"

import { useNativeTheme } from "../../theme"
import { useNativeTagBoxShadow } from "../Tag/boxShadow"
import {
  resolveNativeTagTransition,
  useNativeTagColor,
  useNativeTagNumberValue,
  useNativeTagReducedMotion,
} from "../Tag/motion"

export const useNativeSwitcherOptionPaint = (background: ColorValue | undefined, foreground: ColorValue) => {
  const theme = useNativeTheme()
  const reduced = useNativeTagReducedMotion()
  const backgroundTiming = resolveNativeTagTransition(theme.transitions?.backgroundColor)
  const colorTiming = resolveNativeTagTransition(theme.transitions?.color)
  return {
    backgroundColor: useNativeTagColor(background, backgroundTiming, reduced, true).rendered,
    color: useNativeTagColor(foreground, colorTiming, reduced, true).rendered,
  }
}

export const useNativeSwitcherRootPaint = (style: ViewStyle): ViewStyle => {
  const theme = useNativeTheme()
  const reduced = useNativeTagReducedMotion()
  const backgroundTiming = resolveNativeTagTransition(theme.transitions?.backgroundColor)
  const borderTiming = resolveNativeTagTransition(theme.transitions?.borderColor)
  const shadowTiming = resolveNativeTagTransition(theme.transitions?.boxShadow, 450)
  const backgroundColor = useNativeTagColor(style.backgroundColor, backgroundTiming, reduced, true).rendered
  const borderColor = useNativeTagColor(style.borderColor, borderTiming, reduced, true).rendered
  const shadowColor = useNativeTagColor(style.shadowColor ?? "transparent", shadowTiming, reduced, true).rendered
  const shadowOpacity = useNativeTagNumberValue(
    typeof style.shadowOpacity === "number" ? style.shadowOpacity : 0,
    shadowTiming,
    reduced,
  )
  const shadowRadius = useNativeTagNumberValue(style.shadowRadius ?? 0, shadowTiming, reduced)
  const shadowX = useNativeTagNumberValue(style.shadowOffset?.width ?? 0, shadowTiming, reduced)
  const shadowY = useNativeTagNumberValue(style.shadowOffset?.height ?? 0, shadowTiming, reduced)
  const elevation = useNativeTagNumberValue(style.elevation ?? 0, shadowTiming, reduced)
  const boxShadow = useNativeTagBoxShadow(style.boxShadow, shadowTiming, reduced)
  return {
    ...style,
    backgroundColor,
    borderColor,
    ...(!reduced
      ? {
          shadowColor,
          shadowOpacity: typeof style.shadowOpacity === "object" ? style.shadowOpacity : shadowOpacity,
          shadowRadius,
          shadowOffset: { width: shadowX, height: shadowY },
          elevation,
        }
      : {}),
    ...(style.boxShadow !== undefined || boxShadow !== undefined ? { boxShadow } : {}),
  }
}
