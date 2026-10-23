import { useInsertionEffect, useRef } from "react"
import { I18nManager, Platform, type ColorValue, type ViewStyle } from "react-native"

import { resolveNativeTagTransition, useNativeTagColor, useNativeTagReducedMotion } from "../../components/Tag/motion"

const BORDER_TIMING = resolveNativeTagTransition(250)
const TEXT_TIMING = resolveNativeTagTransition(350)

// Resolve the pinned platforms' border priorities before animating physical
// colors, including removal of an authored logical/physical override.
export const resolveNativeTimePickerBorderColors = (
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
const useBorderColors = (
  style: ViewStyle,
  colors: ReturnType<typeof resolveNativeTimePickerBorderColors>,
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

export const useNativeTimePickerMotion = (
  root: ViewStyle,
  group: ViewStyle,
  rootColor: ColorValue,
  groupColor: ColorValue,
  groupBorderDefault: ColorValue,
) => {
  const reduced = useNativeTagReducedMotion()
  const rootColors = resolveNativeTimePickerBorderColors(root, rootColor, I18nManager.isRTL)
  const groupColors = resolveNativeTimePickerBorderColors(group, groupBorderDefault, rootColors.rtl)
  // A core RN ancestor can supply a local direction that JS does not observe.
  // Preserve native aliases in that case instead of guessing from app locale.
  const rootDirectionKnown = root.direction === "ltr" || root.direction === "rtl"
  const groupDirectionKnown = group.direction === "ltr" || group.direction === "rtl" || rootDirectionKnown
  const committedMode = useRef({ root: rootDirectionKnown, group: groupDirectionKnown })
  const rootModeChanged = committedMode.current.root !== rootDirectionKnown
  const groupModeChanged = committedMode.current.group !== groupDirectionKnown
  useInsertionEffect(() => {
    committedMode.current = { root: rootDirectionKnown, group: groupDirectionKnown }
  })
  return {
    root: useBorderColors(root, rootColors, reduced || rootModeChanged, rootDirectionKnown),
    group: useBorderColors(group, groupColors, reduced || groupModeChanged, groupDirectionKnown),
    groupColor: useNativeTagColor(groupColor, TEXT_TIMING, reduced, true).rendered ?? groupColor,
  }
}
