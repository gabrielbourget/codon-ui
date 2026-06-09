export type TDateTimePickerLabels = {
  inputButtonGroupAriaLabel: string
  triggerButtonAriaLabel: string
  calendarAriaLabel: string
}

export type TPartialDateTimePickerLabels = Partial<TDateTimePickerLabels>

export const DEFAULT_DATE_TIME_PICKER_LABELS: TDateTimePickerLabels = {
  inputButtonGroupAriaLabel: "DateTimePicker Input Icon Group",
  triggerButtonAriaLabel: "DateTimePicker Trigger Button",
  calendarAriaLabel: "Datetime Picker Calendar",
}

export const resolveDateTimePickerLabels = (labels?: TPartialDateTimePickerLabels): TDateTimePickerLabels => ({
  ...DEFAULT_DATE_TIME_PICKER_LABELS,
  ...labels,
})
