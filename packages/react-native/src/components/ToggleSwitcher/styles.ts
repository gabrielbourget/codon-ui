import type { TextStyle, ViewStyle } from "react-native"

import type { TNativeTheme } from "../../theme/types"
import { resolveNativeStyle } from "../colors"

import {
  AVAILABLE_TOGGLE_SWITCHER_FONT_WEIGHTS,
  type TNativeToggleSwitcherFontWeight,
  type TNativeToggleSwitcherOptionStyle,
} from "./types"

const TEXT_FIELDS = [
  "color",
  "fontFamily",
  "fontSize",
  "fontStyle",
  "fontWeight",
  "fontVariant",
  "letterSpacing",
  "lineHeight",
  "textAlign",
  "textAlignVertical",
  "verticalAlign",
  "includeFontPadding",
  "textDecorationLine",
  "textDecorationStyle",
  "textDecorationColor",
  "textShadowColor",
  "textShadowOffset",
  "textShadowRadius",
  "textTransform",
  "writingDirection",
  "userSelect",
] as const
export const splitNativeSwitcherOptionStyle = (style: TNativeToggleSwitcherOptionStyle) => {
  const resolved = resolveNativeStyle(style, "ToggleSwitcher", "optionStyle")
  return {
    text: Object.fromEntries(
      Object.entries(resolved).filter(([key]) => TEXT_FIELDS.some((field) => field === key)),
    ) as TextStyle,
    view: Object.fromEntries(
      Object.entries(resolved).filter(([key]) => !TEXT_FIELDS.some((field) => field === key)),
    ) as ViewStyle,
  }
}
export const nativeSwitcherWeight = (
  theme: TNativeTheme,
  weight: TNativeToggleSwitcherFontWeight | undefined,
  selected: boolean,
) => {
  if (weight !== undefined && !AVAILABLE_TOGGLE_SWITCHER_FONT_WEIGHTS.includes(weight))
    throw new TypeError("ToggleSwitcher: unsupported font weight")
  const key =
    weight === "normal" ? "regular" : weight === "lighter" ? "light" : weight === "bolder" ? "extrabold" : weight
  return theme.typography.fontWeights[key ?? (selected ? "semibold" : "regular")]
}
