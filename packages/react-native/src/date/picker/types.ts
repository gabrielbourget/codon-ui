import type { ReactElement, ReactNode, RefAttributes } from "react"
import type { StyleProp, TextStyle, View } from "react-native"

import type { TNativeSlotProps } from "../../collection/context"
import type { TNativeFieldSemanticLabels } from "../../form/semantics"
import type { TNativeFieldPointerEvent } from "../../input/fieldInput"
import type { TNativeFocusViewProps } from "../../input/types"
import type { TNativeFloatingPlacement } from "../../overlays/floating/placement"
import type { TNativeTimePickerAppearanceProps } from "../field/appearance"
import type { DateValue } from "../state/types"
import type { DatePickerStateOptions, DatePickerState } from "../state/useDatePickerState"
import type { DateRangePickerStateOptions, DateRangePickerState } from "../state/useDateRangePickerState"

export type TNativeDatePickerLabels = {
  inputButtonGroupAriaLabel: string
  triggerButtonAriaLabel: string
  calendarAriaLabel: string
}
export type TNativeDatePickerAppearance = Omit<
  TNativeTimePickerAppearanceProps,
  "labels" | "customInputIconGroupStyles" | "width" | "height"
> & {
  multiMonth?: boolean
  dayLength?: "narrow" | "short" | "long"
  placement?: TNativeFloatingPlacement
  labels?: Partial<TNativeDatePickerLabels>
  customButtonStyles?: StyleProp<TextStyle>
  customInputButtonGroupStyles?: StyleProp<TextStyle>
  customPopoverStyles?: StyleProp<TextStyle>
  customDialogStyles?: StyleProp<TextStyle>
  customCalendarStyles?: StyleProp<TextStyle>
  customCalendarHeaderStyles?: StyleProp<TextStyle>
  customCalendarPrevBtnStyles?: StyleProp<TextStyle>
  customCalendarNextBtnStyles?: StyleProp<TextStyle>
  customCalendarGridStyles?: StyleProp<TextStyle>
  customCalendarGridHeaderStyles?: StyleProp<TextStyle>
  customCalendarGridHeaderCellStyles?: StyleProp<TextStyle>
  customCalendarGridBodyStyles?: StyleProp<TextStyle>
  customCalendarGridBodyCellStyles?: StyleProp<TextStyle>
}
export type TNativeDatePickerRenderState<S = DatePickerState> = Readonly<{
  state: S
  isFocusWithin: boolean
  isFocusVisible: boolean
  isOpen: boolean
  isDisabled: boolean
  isReadOnly: boolean
  isRequired: boolean
  isInvalid: boolean
}>
type TDOMFocus =
  | "onFocus"
  | "onBlur"
  | "onFocusChange"
  | "onKeyDown"
  | "onKeyUp"
  | "label"
  | "description"
  | "errorMessage"
  | "validationState"
type TCommon<S> = Omit<TNativeFocusViewProps, "style" | "children"> &
  TNativeSlotProps &
  TNativeDatePickerAppearance & {
    "aria-describedby"?: string
    "aria-details"?: string
    ariaDescribedBy?: string | readonly string[]
    ariaDetails?: string | readonly string[]
    nativeAccessibilityLabels?: Partial<TNativeFieldSemanticLabels>
    form?: string
    id?: string
    "data-testid"?: string
    onClick?: (event: TNativeFieldPointerEvent) => void
    onFocusChange?: (value: boolean) => void
    autoComplete?: string
    children?: ReactNode | ((state: TNativeDatePickerRenderState<S>) => ReactNode)
    style?:
      | StyleProp<TextStyle>
      | ((state: TNativeDatePickerRenderState<S> & { defaultStyle: TextStyle }) => StyleProp<TextStyle>)
    render?: (
      props: TNativeFocusViewProps & RefAttributes<View>,
      state: TNativeDatePickerRenderState<S>,
    ) => ReactElement
  }
export type TNativeDateTimePickerProps<T extends DateValue = DateValue> = Omit<DatePickerStateOptions<T>, TDOMFocus> &
  TCommon<DatePickerState>
export type TNativeDateTimeRangePickerProps<T extends DateValue = DateValue> = Omit<
  DateRangePickerStateOptions<T>,
  TDOMFocus
> &
  TCommon<DateRangePickerState>

export type TNativeDateTimePickerRef = View
export type TNativeDateTimeRangePickerRef = View
export type TNativeDateTimePickerValue = DateValue
export const NATIVE_DATE_PICKER_TEXT_SIZES = ["small", "medium", "large"] as const
export const NATIVE_DATE_PICKER_DAY_LENGTHS = ["narrow", "short", "long"] as const
export const NATIVE_DATE_PICKER_HOUR_CYCLES = [12, 24] as const
export const NATIVE_DATE_PICKER_GRANULARITIES = ["day", "hour", "minute", "second"] as const

export type TNativeDateTimePickerRenderState = TNativeDatePickerRenderState<DatePickerState>
export type TNativeDateTimeRangePickerRenderState = TNativeDatePickerRenderState<DateRangePickerState>
export type TPartialNativeDatePickerLabels = Partial<TNativeDatePickerLabels>
