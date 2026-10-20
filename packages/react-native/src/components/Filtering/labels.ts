import {
  TABLE_FILTER_OPERATION_CODE__BETWEEN,
  TABLE_FILTER_OPERATION_CODE__EQUAL,
  TABLE_FILTER_OPERATION_CODE__GREATER_THAN,
  TABLE_FILTER_OPERATION_CODE__GREATER_THAN_EQUAL,
  TABLE_FILTER_OPERATION_CODE__IN,
  TABLE_FILTER_OPERATION_CODE__LESS_THAN,
  TABLE_FILTER_OPERATION_CODE__LESS_THAN_EQUAL,
  TABLE_FILTER_OPERATION_CODE__LIKE,
  TABLE_FILTER_OPERATION_CODE__NOT_EQUAL,
  TABLE_FILTER_OPERATION_CODE__NOT_GREATER_THAN,
  TABLE_FILTER_OPERATION_CODE__NOT_GREATER_THAN_EQUAL,
  TABLE_FILTER_OPERATION_CODE__NOT_IN,
  TABLE_FILTER_OPERATION_CODE__NOT_LESS_THAN,
  TABLE_FILTER_OPERATION_CODE__NOT_LESS_THAN_EQUAL,
  TABLE_FILTER_OPERATION_CODE__NOT_LIKE,
  TABLE_FILTER_OPERATION_CODE__SIMILAR_TO,
  type TTableFilterOperationCode,
} from "../Table/queryTypes"
import type { TNativeTagComboBoxPartialLabels } from "../TagComboBox/types"

export type TTableFilteringCriteriaNameFormatter = (args: { criteriaName: string }) => string

export type TTableFilterClauseLabels = {
  parameterAriaLabel: (args: { index: number; criteriaName: string }) => string
  deleteButtonAriaLabel: string
  criteriaLabel: string
  criteriaPlaceholder: string
  conditionLabel: string
  conditionPlaceholder: string
  conditionTypeLabel: string
  conditionTypePlaceholder: string
  argumentAccessibleLabel: TTableFilteringCriteriaNameFormatter
  containedTextArgumentAccessibleLabel: TTableFilteringCriteriaNameFormatter
  similarTextArgumentAccessibleLabel: TTableFilteringCriteriaNameFormatter
  operations: Record<TTableFilterOperationCode, string>
}

export const DEFAULT_FILTER_CLAUSE_LABELS: TTableFilterClauseLabels = {
  parameterAriaLabel: ({ index, criteriaName }) => `Filter Parameter #${index + 1} - ${criteriaName}`,
  deleteButtonAriaLabel: "Delete Filter Entry",
  criteriaLabel: "Filter Criteria",
  criteriaPlaceholder: "Filter Criteria",
  conditionLabel: "Filter Condition",
  conditionPlaceholder: "Filter Condition",
  conditionTypeLabel: "Filter Condition Type",
  conditionTypePlaceholder: "Filter Condition Type",
  argumentAccessibleLabel: ({ criteriaName }) => `Filter ${criteriaName}`,
  containedTextArgumentAccessibleLabel: ({ criteriaName }) => `Filter ${criteriaName} by contained text`,
  similarTextArgumentAccessibleLabel: ({ criteriaName }) => `Filter ${criteriaName} by similar text`,
  operations: {
    [TABLE_FILTER_OPERATION_CODE__EQUAL]: "Equal to",
    [TABLE_FILTER_OPERATION_CODE__NOT_EQUAL]: "Not equal to",
    [TABLE_FILTER_OPERATION_CODE__LIKE]: "Contains",
    [TABLE_FILTER_OPERATION_CODE__NOT_LIKE]: "Does not contain",
    [TABLE_FILTER_OPERATION_CODE__SIMILAR_TO]: "Similar to",
    [TABLE_FILTER_OPERATION_CODE__GREATER_THAN]: "Greater than",
    [TABLE_FILTER_OPERATION_CODE__GREATER_THAN_EQUAL]: "Greater than or equal to",
    [TABLE_FILTER_OPERATION_CODE__LESS_THAN]: "Less than",
    [TABLE_FILTER_OPERATION_CODE__LESS_THAN_EQUAL]: "Less than or equal to",
    [TABLE_FILTER_OPERATION_CODE__NOT_GREATER_THAN]: "Not greater than",
    [TABLE_FILTER_OPERATION_CODE__NOT_GREATER_THAN_EQUAL]: "Not greater than or equal to",
    [TABLE_FILTER_OPERATION_CODE__NOT_LESS_THAN]: "Not less than",
    [TABLE_FILTER_OPERATION_CODE__NOT_LESS_THAN_EQUAL]: "Not less than or equal to",
    [TABLE_FILTER_OPERATION_CODE__IN]: "Included in",
    [TABLE_FILTER_OPERATION_CODE__NOT_IN]: "Not included in",
    [TABLE_FILTER_OPERATION_CODE__BETWEEN]: "Between",
  },
}

export type TPartialFilterClauseLabels = Omit<Partial<TTableFilterClauseLabels>, "operations"> & {
  operations?: Partial<TTableFilterClauseLabels["operations"]>
}
export const resolveFilterClauseLabels = (labels?: TPartialFilterClauseLabels): TTableFilterClauseLabels => ({
  ...DEFAULT_FILTER_CLAUSE_LABELS,
  ...labels,
  operations: { ...DEFAULT_FILTER_CLAUSE_LABELS.operations, ...labels?.operations },
})
export type TFilterOptionLabels = {
  label: string
  selectLabel: string
  selectPlaceholder: string
  tagComboBox: TNativeTagComboBoxPartialLabels
}
export const DEFAULT_FILTER_OPTION_LABELS: TFilterOptionLabels = {
  label: "Filter Argument",
  selectLabel: "Filter Argument",
  selectPlaceholder: "Select Filter Argument",
  tagComboBox: {
    groupAriaLabel: "Filter argument tag combobox controls",
    tagGroupAriaLabel: "Selected filter arguments",
    comboBox: {
      inputButtonGroupAriaLabel: "Filter argument combobox controls",
      triggerButtonAriaLabel: "Show filter argument suggestions",
      emptyListMessage: "No filter arguments remaining to select",
    },
  },
}
