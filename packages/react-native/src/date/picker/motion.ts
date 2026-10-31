import type { ColorValue, ViewStyle } from "react-native"

import { resolveNativeBorderColors, useNativeBorderColors } from "../../components/borderMotion"
import { resolveNativeTagTransition, useNativeTagColor, useNativeTagReducedMotion } from "../../components/Tag/motion"

const textTiming = resolveNativeTagTransition(350)
export const useNativeDatePickerMotion = (
  root: ViewStyle,
  group: ViewStyle,
  foreground: ColorValue,
  icon: ColorValue,
  border: ColorValue,
  direction: "ltr" | "rtl",
) => {
  const reduced = useNativeTagReducedMotion(),
    rtl = (root.direction ?? direction) === "rtl"
  return {
    group: useNativeBorderColors(group, resolveNativeBorderColors(group, border, rtl), reduced, true),
    foreground: useNativeTagColor(foreground, textTiming, reduced, true).rendered ?? foreground,
    icon: useNativeTagColor(icon, textTiming, reduced, true).rendered ?? icon,
  }
}
