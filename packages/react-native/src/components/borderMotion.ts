import { useInsertionEffect, useRef } from "react"
import { I18nManager, Platform, type ColorValue, type ViewStyle } from "react-native"

import { resolveNativeTagTransition, useNativeTagColor, useNativeTagReducedMotion } from "./Tag/motion"

const BORDER_TIMING = resolveNativeTagTransition(250)

// Resolve the pinned platforms' border priorities before animating physical
// colors, including removal of an authored logical/physical override.
export const resolveNativeBorderColors = (
  style: ViewStyle,
  fallback: ColorValue,
  inheritedRTL: boolean,
  android = Platform.OS === "android",
  swapRTL = I18nManager.doLeftAndRightSwapInRTL,
) => {
  const rtl = style.direction === "rtl" || (style.direction !== "ltr" && inheritedRTL)
  const all = style.borderColor ?? fallback
  const leading = rtl ? style.borderEndColor : style.borderStartColor
  const trailing = rtl ? style.borderStartColor : style.borderEndColor
  const swapPhysical = android && rtl && swapRTL
  const left = swapPhysical ? style.borderRightColor : style.borderLeftColor
  const right = swapPhysical ? style.borderLeftColor : style.borderRightColor
  return {
    rtl,
    swapPhysical,
    borderColor: all,
    borderLeftColor: android ? (leading ?? left ?? all) : (left ?? leading ?? all),
    borderRightColor: android ? (trailing ?? right ?? all) : (right ?? trailing ?? all),
    borderTopColor:
      style.borderBlockStartColor ??
      (android ? (style.borderTopColor ?? style.borderBlockColor) : (style.borderBlockColor ?? style.borderTopColor)) ??
      all,
    borderBottomColor:
      style.borderBlockEndColor ??
      (android
        ? (style.borderBottomColor ?? style.borderBlockColor)
        : (style.borderBlockColor ?? style.borderBottomColor)) ??
      all,
  }
}
// Existing plain hosts retain their refs. Each computed property keeps its own
// color node, so unrelated target changes cannot reset its remaining deadline.
export const useNativeBorderColors = (
  style: ViewStyle,
  colors: ReturnType<typeof resolveNativeBorderColors>,
  reduced: boolean,
  directionKnown: boolean,
) => {
  const all = useNativeTagColor(colors.borderColor, BORDER_TIMING, reduced, true).rendered
  const top = useNativeTagColor(
    directionKnown ? colors.borderTopColor : style.borderTopColor,
    BORDER_TIMING,
    reduced,
    true,
  ).rendered
  const right = useNativeTagColor(
    directionKnown ? colors.borderRightColor : style.borderRightColor,
    BORDER_TIMING,
    reduced,
    true,
  ).rendered
  const bottom = useNativeTagColor(
    directionKnown ? colors.borderBottomColor : style.borderBottomColor,
    BORDER_TIMING,
    reduced,
    true,
  ).rendered
  const left = useNativeTagColor(
    directionKnown ? colors.borderLeftColor : style.borderLeftColor,
    BORDER_TIMING,
    reduced,
    true,
  ).rendered
  const start = useNativeTagColor(
    directionKnown ? undefined : style.borderStartColor,
    BORDER_TIMING,
    reduced,
    true,
  ).rendered
  const end = useNativeTagColor(
    directionKnown ? undefined : style.borderEndColor,
    BORDER_TIMING,
    reduced,
    true,
  ).rendered
  const block = useNativeTagColor(
    directionKnown ? undefined : style.borderBlockColor,
    BORDER_TIMING,
    reduced,
    true,
  ).rendered
  const blockStart = useNativeTagColor(
    directionKnown ? undefined : style.borderBlockStartColor,
    BORDER_TIMING,
    reduced,
    true,
  ).rendered
  const blockEnd = useNativeTagColor(
    directionKnown ? undefined : style.borderBlockEndColor,
    BORDER_TIMING,
    reduced,
    true,
  ).rendered
  return {
    borderColor: all,
    borderTopColor: top,
    borderBottomColor: bottom,
    // Android may swap physical inputs in RTL. Undo that mapping here so the
    // persistent animation nodes always represent the actual painted edges.
    borderRightColor: directionKnown && colors.swapPhysical ? left : right,
    borderLeftColor: directionKnown && colors.swapPhysical ? right : left,
    borderStartColor: start,
    borderEndColor: end,
    borderBlockColor: block,
    borderBlockStartColor: blockStart,
    borderBlockEndColor: blockEnd,
  }
}

export const useNativeBorderTransition = (style: ViewStyle, fallback: ColorValue) => {
  const reduced = useNativeTagReducedMotion()
  const colors = resolveNativeBorderColors(style, fallback, I18nManager.isRTL)
  const known = style.direction === "rtl" || style.direction === "ltr"
  const previous = useRef(known)
  const changed = previous.current !== known
  useInsertionEffect(() => {
    previous.current = known
  })
  return useNativeBorderColors(style, colors, reduced || changed, known)
}
