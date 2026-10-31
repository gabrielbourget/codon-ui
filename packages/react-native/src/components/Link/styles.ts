import { processColor, type ColorValue, type TextStyle, type ViewStyle } from "react-native"

import type { TNativeTheme } from "../../theme/types"
import { AVAILABLE_THEMING_ORDER_CODES } from "../../tokens/theme-order"
import { resolveNativeStyle, validateNativeColor } from "../colors"
import { getNativeControlRootStyle } from "../selection"

import type { TNativeLinkProps, TNativeLinkRenderState, TNativeLinkRootStyle } from "./types"

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

const visitedColor = (color: ColorValue, background: ColorValue) => {
  const from = processColor(color)
  const to = processColor(background)
  if (typeof from !== "number" || typeof to !== "number") return color
  const fromAlpha = (from >>> 24) / 255
  const toAlpha = (to >>> 24) / 255
  const alpha = fromAlpha * 0.85 + toAlpha * 0.15
  const channel = (shift: number) =>
    alpha === 0
      ? 0
      : Math.round((((from >>> shift) & 255) * fromAlpha * 0.85 + ((to >>> shift) & 255) * toAlpha * 0.15) / alpha)
  return `rgba(${channel(16)}, ${channel(8)}, ${channel(0)}, ${alpha})`
}

export const getNativeLinkStyle = (
  theme: TNativeTheme,
  props: TNativeLinkProps,
  flags: Omit<TNativeLinkRenderState, "foregroundColor">,
  inherited: ColorValue,
  isFocusVisible = true,
) => {
  if (props.order !== undefined && !AVAILABLE_THEMING_ORDER_CODES.includes(props.order))
    throw new TypeError("Link: unsupported order")
  if (
    props.textDecoration !== undefined &&
    !["none", "underline", "line-through", "underline line-through"].includes(props.textDecoration)
  )
    throw new TypeError("Link: unsupported textDecoration")
  validateNativeColor(props.color, "Link", "color")
  validateNativeColor(props.visitedColor, "Link", "visitedColor")
  const action = props.order ? theme.actions[props.order] : undefined
  const foreground =
    props.color ??
    (action
      ? flags.isPressed
        ? action.pressedBackground
        : flags.isHovered
          ? action.hoverBackground
          : flags.isVisited
            ? (props.visitedColor ?? visitedColor(action.background, theme.colors.background))
            : action.background
      : flags.isVisited
        ? (props.visitedColor ?? inherited)
        : inherited)
  const base: TNativeLinkRootStyle = {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.unit,
    borderRadius: theme.radius.rounded,
    color: foreground,
    textDecorationLine: props.textDecoration ?? (flags.isHovered && !flags.isVisited ? "underline" : "none"),
    cursor: flags.isDisabled || flags.isVisited ? "auto" : "pointer",
    opacity: flags.isDisabled ? theme.opacity.disabled : 1,
    ...(props.enableFocusStyle !== false && flags.isFocused && isFocusVisible
      ? {
          outlineColor: theme.colors.focusRing,
          outlineWidth: 1.5,
          outlineOffset: props.offsetFocusRing === false ? 0 : 2,
        }
      : {}),
  }
  const custom = resolveNativeStyle(props.customStyles, "Link", "customStyles")
  const style = props.style
  const resolved = getNativeControlRootStyle(
    "Link",
    base,
    custom,
    typeof style === "function"
      ? (state) => style({ ...state, foregroundColor: state.defaultStyle.color ?? foreground })
      : style,
    { ...flags, foregroundColor: custom.color ?? foreground },
  )
  const text = Object.fromEntries(
    Object.entries(resolved).filter(([key]) => TEXT_FIELDS.some((field) => field === key)),
  ) as TextStyle
  const view = Object.fromEntries(
    Object.entries(resolved).filter(([key]) => !TEXT_FIELDS.some((field) => field === key)),
  ) as ViewStyle
  return { text, view, foregroundColor: text.color ?? foreground }
}
