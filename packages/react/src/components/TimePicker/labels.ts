export type TTimePickerLabels = {
  inputIconGroupAriaLabel: string
}

export type TPartialTimePickerLabels = Partial<TTimePickerLabels>

export const DEFAULT_TIME_PICKER_LABELS: TTimePickerLabels = {
  inputIconGroupAriaLabel: "TimePicker Input Icon Group",
}

export const resolveTimePickerLabels = (labels?: TPartialTimePickerLabels): TTimePickerLabels => ({
  ...DEFAULT_TIME_PICKER_LABELS,
  ...labels,
})
