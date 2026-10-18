import type { ColorValue, TextStyle, ViewStyle } from "react-native"

import type { TNativeTheme } from "../../theme/types"
import { AVAILABLE_CORNER_GEOMETRY_CODES } from "../../tokens/geometry"
import { resolveNativeStyle, validateNativeColor } from "../colors"
import { validateNativeDisplayDimension } from "../displayDimensions"
import { getNativeControlRadius, getNativeControlRootStyle } from "../selection"

import type {
  TNativeTagBorder,
  TNativeTagProps,
  TNativeTagRenderState,
  TNativeTagRootStyle,
  TNativeTagStyleState,
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

const borderStyle = (border: TNativeTagBorder, componentField: string) => {
  const value = border === "none" ? { borderWidth: 0, borderColor: "transparent" } : border
  if (value.borderWidth !== undefined && (!Number.isFinite(value.borderWidth) || value.borderWidth < 0))
    throw new TypeError(`Tag: ${componentField}.borderWidth must be finite and nonnegative`)
  validateNativeColor(value.borderColor, "Tag", componentField + ".borderColor")
  if (value.borderStyle !== undefined && !["solid", "dashed", "dotted"].includes(value.borderStyle))
    throw new TypeError(`Tag: unsupported ${componentField}.borderStyle`)
  return { borderWidth: 0, borderColor: "transparent", borderStyle: "solid" as const, ...value }
}

export const getNativeTagStyle = (
  theme: TNativeTheme,
  props: TNativeTagProps,
  flags: Omit<TNativeTagRenderState, "foregroundColor">,
  foreground: ColorValue,
) => {
  const {
    width,
    height,
    geometry = "rounded",
    raised = false,
    raisedOnHover = false,
    hoverCursor,
    customStyles,
    style,
    focusOutline,
    outlineOffset = 2,
  } = props
  validateNativeDisplayDimension(width, "Tag", "width")
  validateNativeDisplayDimension(height, "Tag", "height")
  if (!AVAILABLE_CORNER_GEOMETRY_CODES.includes(geometry)) throw new TypeError("Tag: unsupported geometry")
  if (hoverCursor !== undefined && !["auto", "pointer"].includes(hoverCursor))
    throw new TypeError("Tag: unsupported native cursor")
  if (!Number.isFinite(outlineOffset)) throw new TypeError("Tag: outlineOffset must be finite")
  const active = !props.pressable || props.isPressed
  const background = props.pressable
    ? ((active ? props.activeColor : props.inactiveColor) ??
      (active ? theme.colors.controlSelectedBackground : theme.colors.controlBackground))
    : (props.color ?? theme.colors.controlSelectedBackground)
  const border = props.pressable
    ? active
      ? (props.activeBorder ?? "none")
      : (props.inactiveBorder ?? { borderWidth: 2, borderColor: theme.mode === "dark" ? "#3d3d3d" : "#c6c6c6" })
    : (props.border ?? "none")
  validateNativeColor(background, "Tag", "background")
  const outline =
    focusOutline === "none"
      ? { outlineWidth: 0, outlineColor: undefined }
      : { outlineWidth: 1, outlineColor: theme.colors.focusRing, ...focusOutline }
  if (outline.outlineWidth !== undefined && (!Number.isFinite(outline.outlineWidth) || outline.outlineWidth < 0))
    throw new TypeError("Tag: focusOutline.outlineWidth must be finite and nonnegative")
  validateNativeColor(outline.outlineColor, "Tag", "focusOutline.outlineColor")
  const lifted = raised || (raisedOnHover && flags.isHovered)
  const base: TNativeTagRootStyle = {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.unit,
    width,
    height,
    borderRadius: getNativeControlRadius(theme, geometry),
    ...borderStyle(border, "border"),
    backgroundColor: background,
    color: foreground,
    opacity: flags.isDisabled ? theme.opacity.disabled : 1,
    cursor: hoverCursor ?? (props.pressable ? "pointer" : "auto"),
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    shadowOpacity: lifted ? 0.24 : 0,
    elevation: lifted ? 2 : 0,
    ...(props.pressable && flags.isFocused ? { ...outline, outlineOffset } : {}),
  }
  const state = { ...flags, foregroundColor: foreground }
  const interactiveStyle =
    typeof style === "function"
      ? (next: TNativeTagStyleState) => style({ ...next, foregroundColor: next.defaultStyle.color ?? foreground })
      : style
  const resolved = props.pressable
    ? getNativeControlRootStyle("Tag", base, customStyles, interactiveStyle, state)
    : (() => {
        const baseline = { ...base, ...resolveNativeStyle(customStyles, "Tag", "customStyles") }
        return resolveNativeStyle(
          [
            baseline,
            typeof style === "function"
              ? style({ ...state, foregroundColor: baseline.color ?? foreground, defaultStyle: baseline })
              : style,
          ],
          "Tag",
          "style",
        )
      })()
  const text = Object.fromEntries(
    Object.entries(resolved).filter(([key]) => TEXT_FIELDS.some((field) => field === key)),
  ) as TextStyle
  const view = Object.fromEntries(
    Object.entries(resolved).filter(([key]) => !TEXT_FIELDS.some((field) => field === key)),
  ) as ViewStyle
  return { text, view, foregroundColor: text.color ?? foreground }
}
