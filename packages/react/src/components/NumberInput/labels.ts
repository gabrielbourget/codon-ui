export type TNumberInputLabels = {
  inputButtonGroupAriaLabel: string
}

export type TPartialNumberInputLabels = Partial<TNumberInputLabels>

export const DEFAULT_NUMBER_INPUT_LABELS: TNumberInputLabels = {
  inputButtonGroupAriaLabel: "NumberInput Input Button Group",
}

export const resolveNumberInputLabels = (labels?: TPartialNumberInputLabels): TNumberInputLabels => ({
  ...DEFAULT_NUMBER_INPUT_LABELS,
  ...labels,
})
