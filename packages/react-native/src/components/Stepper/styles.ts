import { processColor, type ColorValue, type TextStyle } from "react-native"

import type { TNativeTheme } from "../../theme/types"
import { resolveNativeStyle, validateNativeColor } from "../colors"
import { validateNativeDisplayDimension } from "../displayDimensions"
import { getNativeControlRadius } from "../selection"

import type { TNativeStepperProps, TNativeStepperRenderState, TNativeStepperRootStyle } from "./types"

const readableForeground = (color: ColorValue) => {
  const processed = processColor(color)
  if (typeof processed !== "number") return "#ffffff"
  const channels = [16, 8, 0].map((shift) => {
    const channel = ((processed >>> shift) & 255) / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  const luminance = channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722
  return 1.05 / (luminance + 0.05) >= (luminance + 0.05) / 0.05 ? "#ffffff" : "#000000"
}

export const getNativeStepperStyles = (
  theme: TNativeTheme,
  props: TNativeStepperProps,
  state: TNativeStepperRenderState,
) => {
  const { color, colorMode = "fill", type, order, geometry = "round", width, height } = props
  validateNativeColor(color, "Stepper", "color")
  validateNativeDisplayDimension(width, "Stepper", "width")
  validateNativeDisplayDimension(height, "Stepper", "height")
  const cohesive = type === "cohesive"
  const outlined = colorMode === "outline"
  const action = order === undefined ? undefined : theme.actions[order]
  const inputColor = !cohesive
    ? undefined
    : color !== undefined
      ? outlined
        ? color
        : readableForeground(color)
      : outlined
        ? theme.colors.controlForeground
        : (action?.foreground ?? theme.colors.controlBackground)
  const base: TNativeStepperRootStyle = {
    width,
    height,
    alignItems: "center",
    borderRadius: geometry === "round" ? theme.radius.round : theme.radius.rounded,
    opacity: state.isDisabled ? theme.opacity.disabled : 1,
  }
  const baseline = { ...base, ...resolveNativeStyle(props.customStyles, "Stepper", "customStyles") }
  const root = resolveNativeStyle(
    [baseline, typeof props.style === "function" ? props.style({ ...state, defaultStyle: baseline }) : props.style],
    "Stepper",
    "style",
  )
  const group = resolveNativeStyle<TNativeStepperRootStyle>(
    [
      {
        width: width ?? "100%",
        height,
        flexDirection: props.orientation === "vertical" ? "column-reverse" : "row",
        alignItems: "center",
        gap: 8,
        borderRadius: getNativeControlRadius(theme, geometry),
        backgroundColor:
          color !== undefined
            ? outlined
              ? undefined
              : color
            : cohesive
              ? outlined
                ? order === undefined
                  ? theme.colors.controlBackground
                  : "transparent"
                : (action?.background ?? theme.colors.controlForeground)
              : undefined,
        borderWidth: cohesive && outlined && color === undefined ? 2 : 0,
        borderColor:
          color !== undefined && outlined
            ? color
            : props.errorState
              ? theme.colors.validationErrorBorder
              : props.warningState
                ? theme.colors.validationWarningBorder
                : props.successState
                  ? theme.colors.validationSuccessBorder
                  : (action?.border ?? theme.colors.controlBorder),
        ...(props.enableFocusStyle !== false && state.isFocused
          ? {
              outlineColor: theme.colors.focusRing,
              outlineWidth: 1.5,
              outlineOffset: props.offsetFocusRing === false ? 0 : 1.5,
            }
          : {}),
      },
      props.customGroupStyles,
    ],
    "Stepper",
    "customGroupStyles",
  )
  const input = resolveNativeStyle<TextStyle>(
    [
      {
        backgroundColor: "transparent",
        width: "auto",
        minWidth: 25,
        maxWidth: 40,
        ...(inputColor === undefined ? {} : { borderColor: inputColor, color: inputColor }),
        marginTop: type === "segmented" ? 0 : 2.5,
        marginBottom: type === "segmented" ? 0 : 2.5,
        marginLeft: 0,
        marginRight: 0,
      },
      props.customInputStyles,
    ],
    "Stepper",
    "customInputStyles",
  )
  const button = resolveNativeStyle<TNativeStepperRootStyle>(
    [
      {
        aspectRatio: 1,
        color: inputColor ?? color,
        ...(cohesive && outlined ? { backgroundColor: "transparent" } : {}),
      },
      props.customButtonStyles,
    ],
    "Stepper",
    "customButtonStyles",
  )
  return {
    root,
    group,
    input,
    button,
    buttonColorMode: type === "segmented" && outlined ? ("outline" as const) : ("fill" as const),
    buttonTransparent: cohesive && outlined,
    buttonRaised: !cohesive,
  }
}
