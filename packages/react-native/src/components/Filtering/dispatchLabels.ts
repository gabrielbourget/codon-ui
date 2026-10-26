import type { TNativeDatePickerLabels } from "../../date/picker/types"
import type { TNativeTimePickerLabels } from "../TimePicker/types"

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

export type TFilterArgumentLabels = TNonTemporalFilterArgumentLabels & {
  dateLabel: string
  datePlaceholder: string
  dateTimeLabel: string
  dateTimePlaceholder: string
  timeLabel: string
  timePlaceholder: string
  minimumLabel: string
  maximumLabel: string
  dateTimePicker: Partial<TNativeDatePickerLabels>
  timePicker: Partial<TNativeTimePickerLabels>
}
export const DEFAULT_FILTER_ARGUMENT_LABELS: TFilterArgumentLabels = {
  ...DEFAULT_NON_TEMPORAL_FILTER_ARGUMENT_LABELS,
  dateLabel: "Filter Argument",
  datePlaceholder: "Select date",
  dateTimeLabel: "Filter Argument",
  dateTimePlaceholder: "Select date and time",
  timeLabel: "Filter Argument",
  timePlaceholder: "Select time",
  minimumLabel: "Minimum",
  maximumLabel: "Maximum",
  dateTimePicker: {
    inputButtonGroupAriaLabel: "Filter argument date and time picker controls",
    triggerButtonAriaLabel: "Open filter argument calendar",
    calendarAriaLabel: "Filter argument calendar",
  },
  timePicker: { inputIconGroupAriaLabel: "Filter argument time picker controls" },
}
