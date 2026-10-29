import { Easing, type TextStyle } from "react-native"

import { useNativeLinkColor } from "../Link/motion"

const borderColorEasing = Easing.bezier(0.42, 0, 0.58, 1)

export const useNativeInputBorder = (style: TextStyle, enabled = true): TextStyle => {
  const borderColor = useNativeLinkColor(style.borderColor ?? "transparent", 250, borderColorEasing, enabled)
  return enabled ? { ...style, borderColor } : style
}
