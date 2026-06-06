export type TDateTimeRangePickerLabels = {
  inputButtonGroupAriaLabel: string
  triggerButtonAriaLabel: string
  calendarAriaLabel: string
}

export type TPartialDateTimeRangePickerLabels = Partial<TDateTimeRangePickerLabels>

export const DEFAULT_DATE_TIME_RANGE_PICKER_LABELS: TDateTimeRangePickerLabels = {
  inputButtonGroupAriaLabel: "DateTimeRangePicker Input Icon Group",
  triggerButtonAriaLabel: "DateTimeRangePicker Trigger Button",
  calendarAriaLabel: "Datetime Range Picker Calendar",
}

export const resolveDateTimeRangePickerLabels = (
  labels?: TPartialDateTimeRangePickerLabels,
): TDateTimeRangePickerLabels => ({
  ...DEFAULT_DATE_TIME_RANGE_PICKER_LABELS,
  ...labels,
})
