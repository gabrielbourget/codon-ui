import { DEFAULT_FILTER_EDITOR_LABELS, type TFilterEditorLabels } from "./editorLabels"
import { DEFAULT_FILTER_OPTION_LABELS, type TFilterOptionLabels } from "./labels"

export type TNonTemporalFilterArgumentLabels = TFilterEditorLabels &
  Pick<TFilterOptionLabels, "selectLabel" | "selectPlaceholder" | "tagComboBox"> & {
    comboBox: { triggerButtonAriaLabel: string; emptyListMessage: string }
    typeAheadSearchUnavailable: string
    multiTypeAheadSearchUnavailable: string
  }

export const DEFAULT_NON_TEMPORAL_FILTER_ARGUMENT_LABELS: TNonTemporalFilterArgumentLabels = {
  ...DEFAULT_FILTER_EDITOR_LABELS,
  selectLabel: DEFAULT_FILTER_OPTION_LABELS.selectLabel,
  selectPlaceholder: DEFAULT_FILTER_OPTION_LABELS.selectPlaceholder,
  tagComboBox: DEFAULT_FILTER_OPTION_LABELS.tagComboBox,
  comboBox: {
    triggerButtonAriaLabel: "Show filter argument suggestions",
    emptyListMessage: "No filter arguments remaining to select",
  },
  typeAheadSearchUnavailable: "placeholder: typeahead search not implemented yet",
  multiTypeAheadSearchUnavailable: "placeholder: multi-typeahead search not implemented yet",
}
