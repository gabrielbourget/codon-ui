import { Platform, type ColorValue, type TextStyle, type ViewStyle } from "react-native"

import type { TNativeTheme } from "../../theme/types"
import { AVAILABLE_THEMING_ORDER_CODES } from "../../tokens/theme-order"
import { resolveNativeStyle, validateNativeColor } from "../colors"
import { splitNativeTextStyle } from "../nativeTextStyle"

import type { TNativePaginationProps } from "./types"

export { splitNativeTextStyle as splitNativePaginationStyle } from "../nativeTextStyle"

export const getNativePaginationStyles = (
  theme: TNativeTheme,
  props: TNativePaginationProps,
  inherited: ColorValue = theme.colors.foreground,
) => {
  validateNativeColor(props.color, "Pagination", "color")
  if (props.order !== undefined && !AVAILABLE_THEMING_ORDER_CODES.includes(props.order))
    throw new TypeError("Pagination: unsupported order")
  const root = splitNativeTextStyle(
    resolveNativeStyle<TextStyle>(
      [
        {
          flexDirection: props.rtl ? "row-reverse" : "row",
          direction: "ltr",
          writingDirection: props.rtl ? "rtl" : "ltr",
          alignItems: "flex-end",
          alignContent: "center",
          gap: theme.spacing.unit * 2,
        },
        props.customComponentStyles,
        props.style,
      ],
      "Pagination",
      "style",
    ),
  )
  const foreground = root.text.color ?? inherited
  validateNativeColor(foreground, "Pagination", "root color")
  return {
    root,
    foreground,
    target: Platform.OS === "ios" ? 44 : 48,
    separator: resolveNativeStyle<ViewStyle>(
      [{ alignSelf: "stretch", width: 0.75 }, props.customSeparatorStyles],
      "Pagination",
      "customSeparatorStyles",
    ),
    list: resolveNativeStyle<TextStyle>(
      [
        root.text,
        {
          backgroundColor: theme.colors.background,
          padding: theme.spacing.unit,
          borderRadius: props.geometry === "orthogonal" ? 0 : theme.radius.rounded,
        },
        props.customOptionsListStyles,
      ],
      "Pagination",
      "customOptionsListStyles",
    ),
  }
}
