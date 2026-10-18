import { Platform, type ColorValue, type TextStyle, type ViewStyle } from "react-native"

import type { TNativeTheme } from "../../theme/types"
import { resolveNativeStyle, validateNativeColor } from "../colors"

import type { TNativeButtonProps, TNativeButtonRenderState, TNativeButtonRootStyle } from "./types"

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

export const getNativeButtonStyle = (
  theme: TNativeTheme,
  props: TNativeButtonProps,
  state: Omit<TNativeButtonRenderState, "foregroundColor">,
  isFocusVisible = true,
) => {
  const {
    color,
    hoverColor,
    colorMode = "fill",
    geometry = "rounded",
    order,
    transparent = false,
    raised = true,
    raisedOnHover = false,
    enableFocusStyle = true,
    offsetFocusRing = true,
    width,
    height,
    customStyles,
    style,
  } = props
  const action = order ? theme.actions[order] : undefined
  const outlined = colorMode === "outline"
  const themed = action !== undefined && color === undefined && !transparent
  let background: ColorValue = transparent
    ? "transparent"
    : outlined
      ? (action?.outlineBackground ?? theme.colors.controlBackground)
      : (action?.background ?? theme.colors.background)
  let foreground: ColorValue = transparent
    ? theme.colors.foreground
    : outlined
      ? (action?.border ?? theme.colors.controlForeground)
      : (action?.foreground ?? theme.colors.foreground)
  let border: ColorValue = action?.border ?? theme.colors.controlBorder
  if (color !== undefined) {
    validateNativeColor(color, "Button", "color")
    if (outlined) {
      background = "transparent"
      foreground = color
      border = color
    } else {
      background = color
      foreground = theme.colors.foreground
    }
  }
  if (state.isPressed) {
    if (themed) background = outlined ? action.outlinePressedBackground : action.pressedBackground
  } else if (state.isHovered) {
    if (transparent) background = "transparent"
    else if (hoverColor !== undefined) background = hoverColor
    else if (themed) background = outlined ? action.outlineHoverBackground : action.hoverBackground
  }
  validateNativeColor(hoverColor, "Button", "hoverColor")
  const target = Platform.OS === "ios" ? 44 : 48
  const base: TNativeButtonRootStyle = {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.unit,
    padding: theme.spacing.unit,
    paddingHorizontal: geometry === "round" ? 7 : theme.spacing.unit,
    borderRadius: geometry === "round" ? theme.radius.round : geometry === "rounded" ? theme.radius.rounded : 0,
    borderWidth: outlined && (!transparent || color !== undefined) ? 2 : 0,
    borderColor: border,
    backgroundColor: background,
    color: foreground,
    width,
    height,
    minWidth: width === undefined ? target : undefined,
    minHeight: height === undefined ? target : undefined,
    opacity: state.isDisabled ? theme.opacity.disabled : 1,
    ...(raised || (raisedOnHover && state.isHovered)
      ? {
          shadowColor: "#000000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.24,
          shadowRadius: 3,
          elevation: 2,
        }
      : {}),
    ...(enableFocusStyle && state.isFocused && isFocusVisible
      ? { outlineColor: theme.colors.focusRing, outlineWidth: 1.5, outlineOffset: offsetFocusRing ? 1.5 : 0 }
      : {}),
  }
  const custom = resolveNativeStyle(customStyles, "Button", "customStyles")
  const baseline = {
    ...base,
    minWidth: (custom.width ?? width) === undefined ? target : undefined,
    minHeight: (custom.height ?? height) === undefined ? target : undefined,
    ...custom,
  }
  const final = resolveNativeStyle(
    typeof style === "function"
      ? style({ ...state, foregroundColor: baseline.color ?? foreground, defaultStyle: baseline })
      : style,
    "Button",
    "style",
  )
  const authoredWidth = final.width ?? custom.width ?? width
  const authoredHeight = final.height ?? custom.height ?? height
  const resolved = resolveNativeStyle(
    [
      {
        ...base,
        minWidth: authoredWidth === undefined ? target : undefined,
        minHeight: authoredHeight === undefined ? target : undefined,
      },
      custom,
      final,
    ],
    "Button",
    "resolvedStyle",
  )
  const textStyle = Object.fromEntries(
    Object.entries(resolved).filter(
      ([key, value]) => value !== undefined && TEXT_FIELDS.some((field) => field === key),
    ),
  ) as TextStyle
  const viewStyle = Object.fromEntries(
    Object.entries(resolved).filter(([key]) => !TEXT_FIELDS.some((field) => field === key)),
  ) as ViewStyle
  return { viewStyle, textStyle, foregroundColor: textStyle.color ?? foreground, target }
}
