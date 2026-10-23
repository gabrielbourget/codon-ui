import {
  DEFAULT_NON_TEMPORAL_FILTER_ARGUMENT_LABELS,
  type TNonTemporalFilterArgumentLabels,
} from "../Filtering/dispatchLabels"
import { resolveFilterClauseLabels, type TPartialFilterClauseLabels } from "../Filtering/labels"
import type { TNonTemporalFilterArgumentContext } from "../Filtering/renderNonTemporalArgument"

type TPopoverLabels = {
  triggerButtonAriaLabel: (args: { criteriaName: string }) => string
  title: string
  criteriaTagAriaLabel: (args: { criteriaName: string }) => string
  addConditionButtonAriaLabel: string
  matchModeAriaLabel: (args: { criteriaName: string }) => string
  clearButton: string
  applyButton: string
  joinOperators: { and: string; or: string }
}
export type TPartialNativeTableFilteringLabels = {
  popover?: Omit<Partial<TPopoverLabels>, "joinOperators"> & {
    joinOperators?: Partial<TPopoverLabels["joinOperators"]>
  }
  filterClause?: TPartialFilterClauseLabels
  argumentInput?: Omit<Partial<TNonTemporalFilterArgumentLabels>, "comboBox"> & {
    comboBox?: Partial<TNonTemporalFilterArgumentLabels["comboBox"]>
  }
  native?: {
    [K in keyof TNonTemporalFilterArgumentContext["nativeLabels"]]?: Partial<
      TNonTemporalFilterArgumentContext["nativeLabels"][K]
    >
  } & {
    closeOperation?: string
    closeConditionType?: string
  }
}
const popover: TPopoverLabels = {
  triggerButtonAriaLabel: ({ criteriaName }) => `Filter by ${criteriaName}`,
  title: "Filters:",
  criteriaTagAriaLabel: ({ criteriaName }) => `Filtering ${criteriaName}`,
  addConditionButtonAriaLabel: "Add filter condition",
  matchModeAriaLabel: ({ criteriaName }) => `${criteriaName} match mode`,
  clearButton: "Clear",
  applyButton: "Apply",
  joinOperators: { and: "Match all", or: "Match any" },
}
export const resolveNativeTableFilteringLabels = (labels?: TPartialNativeTableFilteringLabels) => ({
  popover: {
    ...popover,
    ...labels?.popover,
    joinOperators: { ...popover.joinOperators, ...labels?.popover?.joinOperators },
  },
  filterClause: resolveFilterClauseLabels(labels?.filterClause),
  argumentInput: {
    ...DEFAULT_NON_TEMPORAL_FILTER_ARGUMENT_LABELS,
    ...labels?.argumentInput,
    comboBox: { ...DEFAULT_NON_TEMPORAL_FILTER_ARGUMENT_LABELS.comboBox, ...labels?.argumentInput?.comboBox },
    tagComboBox: {
      ...DEFAULT_NON_TEMPORAL_FILTER_ARGUMENT_LABELS.tagComboBox,
      ...labels?.argumentInput?.tagComboBox,
      comboBox: {
        ...DEFAULT_NON_TEMPORAL_FILTER_ARGUMENT_LABELS.tagComboBox.comboBox,
        ...labels?.argumentInput?.tagComboBox?.comboBox,
      },
    },
  },
  native: {
    number: {
      incrementLabel: "Increase filter argument",
      decrementLabel: "Decrease filter argument",
      ...labels?.native?.number,
    },
    range: {
      minimumIncrement: "Increase minimum",
      minimumDecrement: "Decrease minimum",
      maximumIncrement: "Increase maximum",
      maximumDecrement: "Decrease maximum",
      ...labels?.native?.range,
    },
    options: { inputLabel: "Edit filter argument", closeLabel: "Close filter arguments", ...labels?.native?.options },
    closeOperation: labels?.native?.closeOperation ?? "Close filter operation",
    closeConditionType: labels?.native?.closeConditionType ?? "Close filter condition type",
  },
})
