import type { TPartialComboBoxLabels } from "../ComboBox/labels"

export type TTagComboBoxLabels = {
  groupAriaLabel: string
  tagGroupAriaLabel: string
  comboBox?: TPartialComboBoxLabels
}

export type TPartialTagComboBoxLabels = Partial<Omit<TTagComboBoxLabels, "comboBox">> & {
  comboBox?: TPartialComboBoxLabels
}

export const DEFAULT_TAG_COMBO_BOX_LABELS: TTagComboBoxLabels = {
  groupAriaLabel: "TagComboBox TagGroup ComboBox Group",
  tagGroupAriaLabel: "Tag Group",
  comboBox: undefined,
}

export const resolveTagComboBoxLabels = (labels?: TPartialTagComboBoxLabels): TTagComboBoxLabels => ({
  ...DEFAULT_TAG_COMBO_BOX_LABELS,
  ...labels,
  comboBox: labels?.comboBox,
})
