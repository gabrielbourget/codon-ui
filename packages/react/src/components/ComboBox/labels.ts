export type TComboBoxLabels = {
  inputButtonGroupAriaLabel: string
  triggerButtonAriaLabel: string
  emptyListMessage: string
}

export type TPartialComboBoxLabels = Partial<TComboBoxLabels>

export type TResolveComboBoxLabelsArgs = {
  labels?: TPartialComboBoxLabels
  emptyListMessage?: string
}

export const DEFAULT_COMBO_BOX_LABELS: TComboBoxLabels = {
  inputButtonGroupAriaLabel: "ComboBox Input Button Group",
  triggerButtonAriaLabel: "Show suggestions",
  emptyListMessage: "No items remaining to select",
}

export const resolveComboBoxLabels = ({
  labels,
  emptyListMessage,
}: TResolveComboBoxLabelsArgs = {}): TComboBoxLabels => ({
  ...DEFAULT_COMBO_BOX_LABELS,
  ...(emptyListMessage !== undefined ? { emptyListMessage } : {}),
  ...labels,
})
