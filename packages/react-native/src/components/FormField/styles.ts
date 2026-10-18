import type { TextStyle, ViewStyle } from "react-native"

import type { TNativeTheme } from "../../theme/types"
import { resolveNativeStyle } from "../colors"

import type { TNativeFormFieldProps } from "./types"

export const getNativeFormFieldStyles = (theme: TNativeTheme, props: TNativeFormFieldProps) => {
  const hasMessages = !!(props.errorMessages || props.warningMessages || props.successMessages)
  const root = resolveNativeStyle<TextStyle>(
    [
      {
        width: "100%",
        flexDirection: "column",
        gap: theme.spacing.unit,
        ...(props.raised
          ? {
              boxShadow: [
                {
                  offsetX: 0,
                  offsetY: 2,
                  blurRadius: 3,
                  color: theme.mode === "dark" ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.12)",
                },
                {
                  offsetX: 0,
                  offsetY: 2,
                  blurRadius: 2,
                  color: theme.mode === "dark" ? "rgba(0,0,0,0.28)" : "rgba(0,0,0,0.24)",
                },
              ],
            }
          : {}),
      },
      props.customStyles,
      props.style,
    ],
    "FormField",
    "style",
  )
  const top = resolveNativeStyle<ViewStyle>(
    [{ flexDirection: "row", justifyContent: props.label ? "space-between" : "flex-end" }, props.customTopRowStyles],
    "FormField",
    "customTopRowStyles",
  )
  const bottom = resolveNativeStyle<ViewStyle>(
    [
      {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: hasMessages ? "space-between" : "flex-end",
      },
      props.customBottomRowStyles,
    ],
    "FormField",
    "customBottomRowStyles",
  )
  return {
    root,
    top,
    bottom,
    label: resolveNativeStyle<TextStyle>(
      [{ flexShrink: 1 }, props.customLabelStyles],
      "FormField",
      "customLabelStyles",
    ),
    topRight: resolveNativeStyle<ViewStyle>(
      [{ flexShrink: 1 }, props.customTopRightStyles],
      "FormField",
      "customTopRightStyles",
    ),
    bottomRight: resolveNativeStyle<ViewStyle>(
      [{ flexShrink: 1 }, props.customBottomRightStyles],
      "FormField",
      "customBottomRightStyles",
    ),
    validation: resolveNativeStyle<TextStyle>(
      [
        { width: "100%", flexDirection: "column", gap: theme.spacing.unit, flexShrink: 1 },
        props.customValidationMessageStyles,
      ],
      "FormField",
      "customValidationMessageStyles",
    ),
    message: resolveNativeStyle(props.customValidationMessageStyles, "FormField", "customValidationMessageStyles"),
    description: resolveNativeStyle(props.customDescriptionStyles, "FormField", "customDescriptionStyles"),
    hasBottom: hasMessages || !!props.bottomRightContent,
  }
}
