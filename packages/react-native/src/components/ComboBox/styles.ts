import type { ColorValue, ViewStyle } from "react-native"

import type { TNativeTheme } from "../../theme/types"
import { resolveNativeStyle } from "../colors"
import { getNativeControlRadius, getNativeControlRootStyle } from "../selection"

import type { TNativeComboBoxProps, TNativeComboBoxRenderState, TNativeComboBoxRootStyle } from "./types"

export const getNativeComboBoxStyles = <T>(
  theme: TNativeTheme,
  props: TNativeComboBoxProps<T>,
  state: TNativeComboBoxRenderState,
  focused: boolean,
  pressed: boolean,
  hovered: boolean,
) => {
  const root = getNativeControlRootStyle(
    "ComboBox",
    {
      width: props.width,
      height: props.height,
      color: props.color ?? theme.colors.controlForeground,
      backgroundColor: theme.colors.controlBackground,
      opacity: state.isDisabled ? theme.opacity.disabled : 1,
    } satisfies TNativeComboBoxRootStyle,
    props.customStyles,
    props.style,
    state,
  )
  const foreground: ColorValue = root.color ?? theme.colors.controlForeground
  const group = resolveNativeStyle<ViewStyle>(
    [
      {
        borderWidth: 1,
        borderColor: props.errorState
          ? theme.colors.validationErrorBorder
          : props.warningState
            ? theme.colors.validationWarningBorder
            : props.successState
              ? theme.colors.validationSuccessBorder
              : theme.colors.controlBorder,
        borderRadius: getNativeControlRadius(theme, props.geometry ?? "rounded"),
        backgroundColor: theme.colors.controlBackground,
        ...(props.enableFocusStyle !== false && focused
          ? {
              outlineColor: theme.colors.focusRing,
              outlineWidth: 1.5,
              outlineOffset: props.offsetFocusRing !== false ? 1.5 : 0,
            }
          : {}),
      },
      props.customInputButtonGroupStyles,
    ],
    "ComboBox",
    "customInputButtonGroupStyles",
  )
  const button = getNativeControlRootStyle(
    "ComboBox",
    {
      width: "100%",
      height: root.height != null ? "100%" : undefined,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: theme.spacing.unit,
      gap: theme.spacing.unit,
      borderRadius: group.borderRadius,
      color: foreground,
      backgroundColor: pressed
        ? theme.colors.controlPressedBackground
        : hovered
          ? theme.colors.controlHoverBackground
          : "transparent",
    } satisfies TNativeComboBoxRootStyle,
    props.customButtonStyles,
    undefined,
    state,
  )
  const input = resolveNativeStyle(
    [
      {
        color: foreground,
        borderWidth: 0,
        backgroundColor: "transparent",
      },
      props.customInputStyles,
    ],
    "ComboBox",
    "customInputStyles",
  )
  const list = resolveNativeStyle<ViewStyle>(
    [{ flex: 1, backgroundColor: theme.colors.background }, props.customOptionsListStyles],
    "ComboBox",
    "customOptionsListStyles",
  )
  return { root, group, button, input, list, foreground }
}
