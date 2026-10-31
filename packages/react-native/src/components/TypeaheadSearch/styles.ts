import type { TextStyle, ViewStyle } from "react-native"

import type { TNativeTheme } from "../../theme/types"
import { AVAILABLE_CORNER_GEOMETRY_CODES } from "../../tokens/geometry"
import type { TNativeButtonRootStyle } from "../Button/types"
import { resolveNativeStyle } from "../colors"

import type { TNativeTypeaheadSearchProps } from "./types"

export const getTypeaheadStyles = <T extends object>(
  theme: TNativeTheme,
  props: TNativeTypeaheadSearchProps<T>,
  focused: boolean,
  windowHeight: number,
) => {
  const geometry = props.geometry ?? "rounded"
  if (!AVAILABLE_CORNER_GEOMETRY_CODES.includes(geometry)) throw new TypeError("TypeaheadSearch: unsupported geometry")
  const root = resolveNativeStyle<TextStyle>(
    [
      {
        width: "100%",
        flexDirection: "column",
        gap: theme.spacing.unit * 2,
        color: theme.colors.controlForeground,
        opacity: props.isDisabled ? theme.opacity.disabled : 1,
      },
      props.customStyles,
      props.style,
    ],
    "TypeaheadSearch",
    "style",
  )
  const foreground = root.color ?? theme.colors.controlForeground
  return {
    root,
    foreground,
    row: resolveNativeStyle<ViewStyle>(
      [
        {
          width: "100%",
          flexDirection: "row",
          alignItems: "center",
          borderWidth: 1,
          borderColor: focused ? theme.colors.focusRing : theme.colors.controlBorder,
          backgroundColor: theme.colors.controlBackground,
          borderRadius: geometry === "round" ? theme.radius.round : geometry === "rounded" ? theme.radius.rounded : 0,
          ...(focused ? { outlineColor: theme.colors.focusRing, outlineWidth: 1.5, outlineOffset: 0 } : {}),
        },
        props.customInputRowStyles,
      ],
      "TypeaheadSearch",
      "customInputRowStyles",
    ),
    input: resolveNativeStyle<TextStyle>(
      [
        {
          flexGrow: 1,
          flexShrink: 1,
          flexBasis: "auto",
          minWidth: 0,
          borderWidth: 0,
          backgroundColor: "transparent",
          color: foreground,
          padding: theme.spacing.unit,
          paddingHorizontal: 5,
          outlineWidth: 0,
          boxShadow: [],
        },
        props.customInputStyles,
      ],
      "TypeaheadSearch",
      "customInputStyles",
    ),
    button: resolveNativeStyle<TNativeButtonRootStyle>(
      [{ borderWidth: 0, backgroundColor: "transparent", color: foreground }, props.customSearchButtonStyles],
      "TypeaheadSearch",
      "customSearchButtonStyles",
    ),
    container: resolveNativeStyle<ViewStyle>(
      [{ width: "100%", minHeight: 160, maxHeight: Math.max(0, windowHeight) / 2 }, props.customResultsContainerStyles],
      "TypeaheadSearch",
      "customResultsContainerStyles",
    ),
    list: resolveNativeStyle<ViewStyle>(
      [
        { width: "100%", flexDirection: "column", gap: theme.spacing.unit, padding: 0, backgroundColor: "transparent" },
        props.customResultsListStyles,
      ],
      "TypeaheadSearch",
      "customResultsListStyles",
    ),
    status: {
      flexGrow: 1,
      minHeight: 120,
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.unit,
      padding: theme.spacing.unit * 2,
    } as ViewStyle,
  }
}
