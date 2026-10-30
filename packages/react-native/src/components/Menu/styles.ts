import { Platform, type TextStyle, type ViewStyle } from "react-native"

import type { TNativeTheme } from "../../theme/types"
import { resolveNativeStyle, validateNativeColor } from "../colors"
import { splitNativeTextStyle } from "../nativeTextStyle"

import type { TNativeMenuItemProps, TNativeMenuItemState, TNativeMenuProps, TNativeMenuSeparatorProps } from "./types"

export const getNativeMenuStyles = (theme: TNativeTheme, props: TNativeMenuProps, inherited?: TextStyle) => {
  validateNativeColor(props.color, "Menu", "color")
  const root = resolveNativeStyle(
    [
      {
        minWidth: 160,
        padding: theme.spacing.unit,
        color: props.color ?? theme.colors.foreground,
        backgroundColor:
          props.color !== undefined || props.order === undefined
            ? theme.colors.background
            : theme.actions[props.order].background,
      },
      props.customStyles,
      props.style,
    ],
    "Menu",
    "root",
  )
  const list = resolveNativeStyle(
    [
      inherited,
      splitNativeTextStyle(root).text,
      { flexDirection: "column", gap: 2, padding: 0, margin: 0 },
      props.customMenuStyles,
    ],
    "Menu",
    "list",
  )
  return { root, list: splitNativeTextStyle(list) }
}
export const getNativeMenuItemStyles = (
  theme: TNativeTheme,
  props: TNativeMenuItemProps,
  state: TNativeMenuItemState,
  inherited: TextStyle,
) => {
  const computed: TextStyle = {
    backgroundColor: "transparent",
    borderWidth: 0,
    justifyContent: "flex-start",
    minHeight: Platform.OS === "ios" ? 44 : 48,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.unit,
    padding: theme.spacing.unit,
    borderRadius: Math.max(0, theme.radius.rounded - 2),
    ...inherited,
    ...(props.variant === "destructive" ? { color: theme.colors.statusDanger } : {}),
    ...(state.isHovered ? { backgroundColor: theme.colors.controlHoverBackground } : {}),
    ...(state.isPressed ? { backgroundColor: theme.colors.controlPressedBackground } : {}),
    ...(state.isDisabled ? { opacity: theme.opacity.disabled } : {}),
    ...(state.isFocusVisible ? { outlineColor: theme.colors.focusRing, outlineWidth: 1.5, outlineOffset: -1.5 } : {}),
  }
  const defaults = resolveNativeStyle([computed, props.customStyles], "MenuItem", "customStyles")
  const final =
    typeof props.style === "function" ? props.style({ ...state, defaultStyle: { ...defaults } }) : props.style
  return splitNativeTextStyle(resolveNativeStyle([defaults, final], "MenuItem", "style"))
}
export const getNativeMenuSeparatorStyle = (theme: TNativeTheme, props: TNativeMenuSeparatorProps) =>
  resolveNativeStyle<ViewStyle>(
    [
      { height: 1, backgroundColor: theme.colors.borderMuted, marginVertical: Math.max(0, theme.spacing.unit - 2) },
      props.customStyles,
      props.style,
    ],
    "MenuSeparator",
    "style",
  )
