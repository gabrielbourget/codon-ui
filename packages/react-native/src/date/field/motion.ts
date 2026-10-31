import { useInsertionEffect, useRef } from "react"
import { I18nManager, type ColorValue, type ViewStyle } from "react-native"

import {
  resolveNativeBorderColors as resolveNativeTimePickerBorderColors,
  useNativeBorderColors as useBorderColors,
} from "../../components/borderMotion"
import { resolveNativeTagTransition, useNativeTagColor, useNativeTagReducedMotion } from "../../components/Tag/motion"

export { resolveNativeTimePickerBorderColors }
const TEXT_TIMING = resolveNativeTagTransition(350)

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
