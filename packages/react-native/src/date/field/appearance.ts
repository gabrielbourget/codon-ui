import type { ReactNode } from "react"
import type { StyleProp, TextStyle, ViewStyle } from "react-native"

import { resolveNativeStyle } from "../../components/colors"
import type { TNativeTheme } from "../../theme/types"
import type { TCornerGeometry } from "../../tokens/geometry"

import type { TNativeTimeFieldProps, TNativeTimeFieldRenderState } from "./types"

export type TNativeTimePickerAppearanceProps = {
  height?: ViewStyle["height"]
  width?: ViewStyle["width"]
  textSize?: "small" | "medium" | "large"
  geometry?: TCornerGeometry
  enableFocusStyle?: boolean
  offsetFocusRing?: boolean
  errorState?: boolean
  warningState?: boolean
  successState?: boolean
  ComponentIcon?: ReactNode
  labels?: Partial<{ inputIconGroupAriaLabel: string }>
  customStyles?: StyleProp<TextStyle>
  customInputIconGroupStyles?: StyleProp<TextStyle>
  customInputStyles?: StyleProp<TextStyle>
}

// Calibrate before context merging, just as the canonical wrapper does. The
// field renderer supplies defaultStyle; computed dimensions are not that value.
export const calibrateNativeTimePickerStyle = (
  props: Pick<TNativeTimeFieldProps, "style"> & TNativeTimePickerAppearanceProps,
): TNativeTimeFieldProps["style"] => {
  const computed = resolveNativeStyle<TextStyle>(
    [{ height: props.height, width: props.width }, props.customStyles],
    "TimePicker",
    "customStyles",
  )
  const authored = props.style
  return typeof authored === "function" ? (state) => [computed, authored(state)] : [computed, authored]
}

export const getNativeTimePickerAppearance = (
  theme: TNativeTheme,
  props: TNativeTimePickerAppearanceProps,
  state: Pick<TNativeTimeFieldRenderState, "isDisabled"> & { isFocusWithin: boolean },
) => {
  const geometry = props.geometry ?? "rounded"
  const defaultBorderColor = props.errorState
    ? theme.colors.validationErrorBorder
    : props.warningState
      ? theme.colors.validationWarningBorder
      : props.successState
        ? theme.colors.validationSuccessBorder
        : theme.colors.controlBorder
  const group = resolveNativeStyle<TextStyle>(
    [
      {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: theme.spacing.unit,
        paddingLeft: 1.5,
        borderWidth: 1,
        borderColor: defaultBorderColor,
        ...(geometry === "rounded" ? { borderRadius: theme.radius.rounded } : {}),
        ...(geometry === "round"
          ? { borderRadius: "50%", padding: theme.spacing.unit, paddingHorizontal: 7, paddingLeft: 7 }
          : {}),
        ...(props.enableFocusStyle !== false && state.isFocusWithin
          ? {
              outlineColor: theme.colors.focusRing,
              outlineWidth: 1.5,
              outlineOffset: props.offsetFocusRing === false ? 0 : 1.5,
            }
          : {}),
      },
      props.customInputIconGroupStyles,
    ],
    "TimePicker",
    "customInputIconGroupStyles",
  )
  const input = resolveNativeStyle<TextStyle>(
    [{ flexDirection: "row", padding: 3.5, borderWidth: 0, backgroundColor: "transparent" }, props.customInputStyles],
    "TimePicker",
    "customInputStyles",
  )
  const textSize = props.textSize === "small" ? "b11" : props.textSize === "large" ? "b9" : "b10"
  const text: TextStyle = {
    fontFamily: theme.typography.fontFamilies.body,
    fontWeight: theme.typography.fontWeights.regular,
    fontSize: theme.typography.fontSizes[textSize],
    lineHeight: theme.typography.lineHeight,
  }
  return {
    root: {
      alignItems: "center",
      borderRadius: theme.radius.rounded,
      ...(state.isDisabled ? { opacity: theme.opacity.disabled } : {}),
    } satisfies ViewStyle,
    group,
    defaultBorderColor,
    input,
    text,
    segment: { alignItems: "center", justifyContent: "center", borderRadius: 3, padding: 1.5 } satisfies ViewStyle,
    placeholder: { color: theme.colors.controlPlaceholder, fontStyle: "italic", fontSize: 12 } satisfies TextStyle,
    focusedSegment: { outlineColor: theme.colors.focusRing, outlineWidth: 1.5 } satisfies ViewStyle,
    iconColor: state.isFocusWithin ? theme.colors.controlSelectedBackground : theme.colors.controlForeground,
  }
}
