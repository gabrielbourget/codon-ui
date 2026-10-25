import { Platform, type TextStyle } from "react-native"

import type { TNativeTheme } from "../../theme/types"
import { AVAILABLE_CORNER_GEOMETRY_CODES } from "../../tokens/geometry"
import { AVAILABLE_THEMING_ORDER_CODES } from "../../tokens/theme-order"
import { mixNativeSRGBColors, resolveNativeStyle, validateNativeColor } from "../colors"
import { validateNativeDisplayDimension } from "../displayDimensions"
import { splitNativeTextStyle } from "../nativeTextStyle"
import { getNativeControlRadius } from "../selection"

import {
  NATIVE_TAG_GROUP_ORIENTATIONS,
  type TNativeGroupedTagState,
  type TNativeGroupedTagVisualProps,
  type TNativeTagGroupVisualProps,
} from "./visualTypes"

export const getNativeTagGroupStyles = (theme: TNativeTheme, props: TNativeTagGroupVisualProps) => {
  const orientation = props.orientation ?? "horizontal"
  if (!NATIVE_TAG_GROUP_ORIENTATIONS.includes(orientation)) throw new TypeError("TagGroup: unsupported orientation")
  validateNativeDisplayDimension(props.width, "TagGroup", "width")
  validateNativeDisplayDimension(props.height, "TagGroup", "height")
  const dimensions = { width: props.width ?? ("auto" as const), height: props.height ?? ("auto" as const) }
  const root = splitNativeTextStyle(
    resolveNativeStyle([{ ...dimensions, flexDirection: "row" }, props.customStyles, props.style], "TagGroup", "root"),
  )
  const list = splitNativeTextStyle(
    resolveNativeStyle(
      [
        {
          ...dimensions,
          flexDirection: orientation === "horizontal" ? "row" : "column",
          flexWrap: "wrap",
          alignItems: "center",
          gap: theme.spacing.unit,
        },
        props.customTagListStyles,
      ],
      "TagGroup",
      "list",
    ),
  )
  return {
    root: root.view,
    list: list.view,
    text: { ...root.text, ...list.text },
  }
}

export const getNativeGroupedTagColors = (
  theme: TNativeTheme,
  props: TNativeGroupedTagVisualProps,
  state: TNativeGroupedTagState,
) => {
  validateNativeColor(props.color, "TagGroup.Tag", "color")
  if (props.order !== undefined && !AVAILABLE_THEMING_ORDER_CODES.includes(props.order))
    throw new TypeError("TagGroup.Tag: unsupported order")
  const colors = theme.colors
  const base = {
    color: colors.controlForeground,
    borderColor: colors.controlBorder,
    backgroundColor: colors.controlBackground,
  }
  if (props.color !== undefined) return { ...base, backgroundColor: props.color }
  if (props.transparent) return { ...base, backgroundColor: "transparent" }
  const active = !state.isDisabled
  if (props.order === undefined)
    return {
      color: state.isSelected ? colors.controlSelectedForeground : colors.controlForeground,
      borderColor: state.isSelected ? colors.controlSelectedBackground : colors.controlBorder,
      backgroundColor: state.isSelected
        ? active && state.isPressed
          ? colors.controlSelectedPressedBackground
          : active && state.isHovered
            ? colors.controlSelectedHoverBackground
            : colors.controlSelectedBackground
        : active && state.isPressed
          ? colors.controlPressedBackground
          : active && state.isHovered
            ? colors.controlHoverBackground
            : colors.controlBackground,
    }
  const selected = {
    primary: colors.controlSelectedBackground,
    secondary: colors.controlPressedBackground,
    tertiary: colors.statusSuccess,
    quaternary: colors.statusWarning,
    quintenary: colors.statusDanger,
  }[props.order]
  const foreground =
    props.order === "primary"
      ? colors.controlSelectedForeground
      : props.order === "secondary"
        ? colors.foreground
        : colors.background
  const selectedOther = props.order === "secondary" ? colors.foreground : colors.background
  let background = colors.controlBackground
  if (state.isSelected)
    background =
      props.order === "primary"
        ? active && state.isPressed
          ? colors.controlSelectedPressedBackground
          : active && state.isHovered
            ? colors.controlSelectedHoverBackground
            : selected
        : active && state.isPressed
          ? mixNativeSRGBColors(selected, selectedOther, 0.75)
          : active && state.isHovered
            ? mixNativeSRGBColors(selected, selectedOther, 0.85)
            : selected
  else if (active && state.isPressed)
    background =
      props.order === "secondary"
        ? colors.controlPressedBackground
        : mixNativeSRGBColors(selected, colors.background, 0.25)
  else if (active && state.isHovered)
    background = mixNativeSRGBColors(selected, colors.background, props.order === "secondary" ? 0.4 : 0.15)
  return {
    color: state.isSelected ? foreground : colors.controlForeground,
    backgroundColor: background,
    borderColor: state.isSelected ? selected : colors.controlBorder,
  }
}

export const getNativeGroupedTagStyles = (
  theme: TNativeTheme,
  props: TNativeGroupedTagVisualProps,
  state: TNativeGroupedTagState,
  inherited?: TextStyle,
) => {
  const geometry = props.geometry ?? "rounded"
  if (!AVAILABLE_CORNER_GEOMETRY_CODES.includes(geometry)) throw new TypeError("TagGroup.Tag: unsupported geometry")
  validateNativeDisplayDimension(props.width, "TagGroup.Tag", "width")
  validateNativeDisplayDimension(props.height, "TagGroup.Tag", "height")
  const computed: TextStyle = {
    ...inherited,
    width: props.width,
    height: props.height,
    flexDirection: "row",
    gap: theme.spacing.unit,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing.unit,
    ...(geometry === "round" ? { paddingHorizontal: 7 } : {}),
    borderWidth: 1,
    borderRadius: getNativeControlRadius(theme, geometry),
    ...getNativeGroupedTagColors(theme, props, state),
    opacity: state.isDisabled ? theme.opacity.disabled : 1,
    ...(props.raised
      ? {
          shadowColor: "#000000",
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 3,
          shadowOpacity: 0.24,
          elevation: 2,
        }
      : {}),
    outlineWidth: props.enableFocusStyle !== false && state.isFocused ? 1.5 : 0,
    outlineColor: theme.colors.focusRing,
    outlineOffset: props.offsetFocusRing !== false ? 1.5 : 0,
  }
  const custom = resolveNativeStyle([computed, props.customStyles], "TagGroup.Tag", "customStyles")
  const target = Platform.OS === "ios" ? 44 : 48
  const interactive = state.allowsSelection || state.hasAction
  const defaults = {
    minWidth: interactive && custom.width === undefined ? target : undefined,
    minHeight: interactive && custom.height === undefined ? target : undefined,
    ...custom,
  }
  const final = resolveNativeStyle(
    typeof props.style === "function" ? props.style({ ...state, defaultStyle: { ...defaults } }) : props.style,
    "TagGroup.Tag",
    "style",
  )
  const resolved = resolveNativeStyle(
    [
      {
        ...defaults,
        minWidth: interactive && (final.width ?? custom.width) === undefined ? defaults.minWidth : undefined,
        minHeight: interactive && (final.height ?? custom.height) === undefined ? defaults.minHeight : undefined,
      },
      final,
    ],
    "TagGroup.Tag",
    "resolvedStyle",
  )
  return {
    ...splitNativeTextStyle(resolved),
    defaultStyle: defaults,
    foregroundColor: resolved.color ?? theme.colors.controlForeground,
  }
}
