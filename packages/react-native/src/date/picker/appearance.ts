import type { StyleProp, TextStyle, ViewStyle } from "react-native"

import { mixNativeSRGBColors, resolveNativeStyle } from "../../components/colors"
import type { TNativeTheme } from "../../theme/types"
import { getNativeTimePickerAppearance } from "../field/appearance"

import type { TNativeDatePickerAppearance, TNativeDatePickerLabels, TNativeDatePickerRenderState } from "./types"

export const DEFAULT_DATE_TIME_PICKER_LABELS: TNativeDatePickerLabels = {
  inputButtonGroupAriaLabel: "DateTimePicker Input Icon Group",
  triggerButtonAriaLabel: "DateTimePicker Trigger Button",
  calendarAriaLabel: "Datetime Picker Calendar",
}
export const DEFAULT_DATE_TIME_RANGE_PICKER_LABELS: TNativeDatePickerLabels = {
  inputButtonGroupAriaLabel: "DateTimeRangePicker Input Icon Group",
  triggerButtonAriaLabel: "DateTimeRangePicker Trigger Button",
  calendarAriaLabel: "Datetime Range Picker Calendar",
}
export const resolveNativeDatePickerLabels = (range: boolean, labels?: Partial<TNativeDatePickerLabels>) => ({
  ...(range ? DEFAULT_DATE_TIME_RANGE_PICKER_LABELS : DEFAULT_DATE_TIME_PICKER_LABELS),
  ...labels,
})
export const getNativeDatePickerAppearance = (
  theme: TNativeTheme,
  props: TNativeDatePickerAppearance,
  flags: { isDisabled: boolean; isFocusWithin: boolean; isOpen: boolean },
) => {
  const base = getNativeTimePickerAppearance(
    theme,
    { ...props, labels: undefined, customInputIconGroupStyles: undefined },
    flags,
  )
  const style = (defaults: TextStyle, custom: Parameters<typeof resolveNativeStyle<TextStyle>>[0]) =>
    resolveNativeStyle<TextStyle>([defaults, custom], "DatePicker", "style")
  const radius = props.geometry === "orthogonal" ? 0 : theme.radius.rounded
  const shadow =
    theme.mode === "dark"
      ? "0 2px 3px rgba(0,0,0,0.35), 0 2px 2px rgba(0,0,0,0.28)"
      : "0 2px 3px rgba(0,0,0,0.12), 0 2px 2px rgba(0,0,0,0.24)"
  return {
    ...base,
    root: {
      alignItems: "center",
      ...(flags.isDisabled ? { opacity: theme.opacity.disabled } : {}),
    } satisfies ViewStyle,
    group: style(
      {
        ...base.group,
        paddingLeft: undefined,
        paddingHorizontal: undefined,
        ...(props.geometry === "round" ? { padding: theme.spacing.unit, paddingHorizontal: 7 } : {}),
        ...(props.geometry === "round" ? { padding: theme.spacing.unit, paddingHorizontal: 7 } : {}),
        backgroundColor: theme.colors.controlBackground,
      },
      props.customInputButtonGroupStyles,
    ),
    input: style(
      { flexDirection: "row", padding: 3.5, borderWidth: 0, backgroundColor: "transparent" },
      props.customInputStyles,
    ),
    button: style({ borderWidth: 0, backgroundColor: "transparent", paddingLeft: 1.5 }, props.customButtonStyles),
    iconColor:
      flags.isFocusWithin || flags.isOpen ? theme.colors.controlSelectedBackground : theme.colors.controlForeground,
    popover: style({ borderRadius: radius }, props.customPopoverStyles),
    dialog: style(
      {
        width: "100%",
        alignItems: "center",
        backgroundColor: theme.colors.background,
        padding: theme.spacing.unit,
        boxShadow: shadow,
        borderRadius: radius,
      },
      props.customDialogStyles,
    ),
    calendar: style({ width: "100%", alignItems: "center" }, props.customCalendarStyles),
    top: {
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing.unit,
    } satisfies ViewStyle,
    heading: style(
      { ...base.text, flex: 1, textAlign: "center", fontWeight: theme.typography.fontWeights.bold },
      props.customCalendarHeaderStyles,
    ),
    previous: style({ justifyContent: "flex-start", padding: 1.5 }, props.customCalendarPrevBtnStyles),
    next: style({ justifyContent: "flex-end", padding: 1.5 }, props.customCalendarNextBtnStyles),
    months: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.unit } satisfies ViewStyle,
    grid: style({ flex: 1, alignItems: "center" }, props.customCalendarGridStyles),
    gridHeader: style({ ...base.text, padding: 3.5, width: "100%" }, props.customCalendarGridHeaderStyles),
    headerCell: style(
      { ...base.text, padding: 1.5, fontWeight: theme.typography.fontWeights.bold },
      props.customCalendarGridHeaderCellStyles,
    ),
    body: style({ ...base.text, padding: 3, width: "100%" }, props.customCalendarGridBodyStyles),
    day: style({ ...base.text, padding: theme.spacing.unit, borderRadius: 3 }, props.customCalendarGridBodyCellStyles),
    selected: mixNativeSRGBColors(
      theme.colors.controlSelectedBackground,
      theme.colors.background,
      theme.mode === "dark" ? 0.85 : 0.15,
    ),
    boundary: mixNativeSRGBColors(
      theme.colors.controlSelectedBackground,
      theme.colors.background,
      theme.mode === "dark" ? 1 : 0.3,
    ),
    hover: theme.mode === "dark" ? theme.colors.controlPressedBackground : theme.colors.controlHoverBackground,
    shadow,
    outsideOpacity: theme.opacity.disabled,
    focusColor: theme.colors.focusRing,
  }
}
export type TNativeDatePickerAppearanceResult = ReturnType<typeof getNativeDatePickerAppearance>

export const calibrateNativeDatePickerStyle = <S>(props: {
  customStyles?: StyleProp<TextStyle>
  style?:
    | StyleProp<TextStyle>
    | ((state: TNativeDatePickerRenderState<S> & { defaultStyle: TextStyle }) => StyleProp<TextStyle>)
}) => {
  const computed = resolveNativeStyle<TextStyle>(props.customStyles, "DatePicker", "customStyles"),
    authored = props.style
  return typeof authored === "function"
    ? (state: TNativeDatePickerRenderState<S> & { defaultStyle: TextStyle }) => [computed, authored(state)]
    : [computed, authored]
}
export const resolveDateTimePickerLabels = (labels?: Partial<TNativeDatePickerLabels>) =>
  resolveNativeDatePickerLabels(false, labels)
export const resolveDateTimeRangePickerLabels = (labels?: Partial<TNativeDatePickerLabels>) =>
  resolveNativeDatePickerLabels(true, labels)
