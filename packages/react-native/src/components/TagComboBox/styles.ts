import type { TextStyle } from "react-native"

import type { TNativeTheme } from "../../theme/types"
import { AVAILABLE_CORNER_GEOMETRY_CODES } from "../../tokens/geometry"
import { resolveNativeStyle } from "../colors"
import { validateNativeDisplayDimension } from "../displayDimensions"
import { splitNativeTextStyle } from "../nativeTextStyle"
import { getNativeControlRadius } from "../selection"

import type { TNativeTagComboBoxProps } from "./types"

export const getNativeTagComboBoxStyles = <T extends object>(
  theme: TNativeTheme,
  props: TNativeTagComboBoxProps<T>,
  focused: boolean,
) => {
  for (const field of ["width", "height", "minWidth", "maxWidth"] as const)
    validateNativeDisplayDimension(props[field], "TagComboBox", field)
  const geometry = props.geometry ?? "rounded"
  if (!AVAILABLE_CORNER_GEOMETRY_CODES.includes(geometry)) throw new TypeError("TagComboBox: unsupported geometry")
  if (props.textSize !== undefined && !["small", "medium", "large"].includes(props.textSize))
    throw new TypeError("TagComboBox: unsupported text size")
  const style = resolveNativeStyle<TextStyle>(
    [
      {
        width: props.width ?? "auto",
        height: props.height ?? "auto",
        minWidth: props.minWidth,
        maxWidth: props.maxWidth ?? 280,
        padding: theme.spacing.unit,
        ...(geometry === "round" ? { paddingHorizontal: 7 } : {}),
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "flex-start",
        gap: theme.spacing.unit,
        flexWrap: "wrap",
        borderWidth: 1,
        borderColor: props.errorState
          ? theme.colors.validationErrorBorder
          : props.warningState
            ? theme.colors.validationWarningBorder
            : props.successState
              ? theme.colors.validationSuccessBorder
              : theme.colors.controlBorder,
        borderRadius: getNativeControlRadius(theme, geometry),
        opacity: props.isDisabled ? theme.opacity.disabled : 1,
        ...(focused && props.enableFocusStyle !== false
          ? {
              outlineWidth: 1.5,
              outlineColor: theme.colors.focusRing,
              outlineOffset: props.offsetFocusRing === false ? 0 : 1.5,
            }
          : {}),
      },
      props.customStyles,
      props.style,
    ],
    "TagComboBox",
    "root",
  )
  return {
    ...splitNativeTextStyle(style),
    foreground: style.color ?? theme.colors.foreground,
    textVariant:
      props.textSize === "small" ? ("b11" as const) : props.textSize === "large" ? ("b9" as const) : ("b10" as const),
  }
}
