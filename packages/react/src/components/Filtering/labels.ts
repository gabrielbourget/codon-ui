import type { TPartialComboBoxLabels } from "../ComboBox/labels"
import type { TPartialDateTimePickerLabels } from "../DateTimePicker/labels"
import type { TPartialNumberInputLabels } from "../NumberInput/labels"
import {
  TABLE_FILTER_JOIN_OPERATOR__AND,
  TABLE_FILTER_JOIN_OPERATOR__OR,
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
import type { TPartialTagComboBoxLabels } from "../TagComboBox/labels"
import type { TPartialTimePickerLabels } from "../TimePicker/labels"

export type TTableFilteringCriteriaNameFormatter = (args: { criteriaName: string }) => string

export type TTableFilteringPopoverLabels = {
  triggerButtonAriaLabel: TTableFilteringCriteriaNameFormatter
  title: string
  criteriaTagAriaLabel: TTableFilteringCriteriaNameFormatter
  addConditionButtonAriaLabel: string
  matchModeAriaLabel: TTableFilteringCriteriaNameFormatter
  clearButton: string
  applyButton: string
  joinOperators: {
    [TABLE_FILTER_JOIN_OPERATOR__AND]: string
    [TABLE_FILTER_JOIN_OPERATOR__OR]: string
  }
}

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

export type TTableFilterArgumentInputLabels = {
  label: string
  placeholder: string
  booleanLabel: string
  dateLabel: string
  datePlaceholder: string
  dateTimeLabel: string
  dateTimePlaceholder: string
  timeLabel: string
  timePlaceholder: string
  selectLabel: string
  selectPlaceholder: string
  minValueLabel: string
  minValuePlaceholder: string
  maxValueLabel: string
  maxValuePlaceholder: string
  minimumLabel: string
  maximumLabel: string
  addMultiInputItemButtonAriaLabel: string
  deleteMultiInputItemButtonAriaLabel: string
  multiInputItemAriaLabel: (args: { index: number }) => string
  multiInputItemPlaceholder: (args: { position: number }) => string
  multiInputFallbackPlaceholder: (args: { position: number }) => string
  typeAheadSearchUnavailable: string
  multiTypeAheadSearchUnavailable: string
  numberInput: TPartialNumberInputLabels
  dateTimePicker: TPartialDateTimePickerLabels
  timePicker: TPartialTimePickerLabels
  comboBox: TPartialComboBoxLabels
  tagComboBox: TPartialTagComboBoxLabels
}

export type TTableFilteringLabels = {
  popover: TTableFilteringPopoverLabels
  filterClause: TTableFilterClauseLabels
  argumentInput: TTableFilterArgumentInputLabels
}

export type TPartialTableFilteringPopoverLabels = Omit<Partial<TTableFilteringPopoverLabels>, "joinOperators"> & {
  joinOperators?: Partial<TTableFilteringPopoverLabels["joinOperators"]>
}

export type TPartialTableFilterClauseLabels = Omit<Partial<TTableFilterClauseLabels>, "operations"> & {
  operations?: Partial<Record<TTableFilterOperationCode, string>>
}

export type TPartialTableFilteringLabels = {
  popover?: TPartialTableFilteringPopoverLabels
  filterClause?: TPartialTableFilterClauseLabels
  argumentInput?: Partial<TTableFilterArgumentInputLabels>
}

export const DEFAULT_TABLE_FILTERING_LABELS: TTableFilteringLabels = {
  popover: {
    triggerButtonAriaLabel: ({ criteriaName }) => `Filter by ${criteriaName}`,
    title: "Filters:",
    criteriaTagAriaLabel: ({ criteriaName }) => `Filtering ${criteriaName}`,
    addConditionButtonAriaLabel: "Add filter condition",
    matchModeAriaLabel: ({ criteriaName }) => `${criteriaName} match mode`,
    clearButton: "Clear",
    applyButton: "Apply",
    joinOperators: {
      [TABLE_FILTER_JOIN_OPERATOR__AND]: "Match all",
      [TABLE_FILTER_JOIN_OPERATOR__OR]: "Match any",
    },
  },
  filterClause: {
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
  },
  argumentInput: {
    label: "Filter Argument",
    placeholder: "Filter Argument",
    booleanLabel: "Filter Argument",
    dateLabel: "Filter Argument",
    datePlaceholder: "Select date",
    dateTimeLabel: "Filter Argument",
    dateTimePlaceholder: "Select date and time",
    timeLabel: "Filter Argument",
    timePlaceholder: "Select time",
    selectLabel: "Filter Argument",
    selectPlaceholder: "Select Filter Argument",
    minValueLabel: "Min Value",
    minValuePlaceholder: "Enter min value",
    maxValueLabel: "Max Value",
    maxValuePlaceholder: "Enter max value",
    minimumLabel: "Minimum",
    maximumLabel: "Maximum",
    addMultiInputItemButtonAriaLabel: "Add Filter Argument Entry",
    deleteMultiInputItemButtonAriaLabel: "Delete Filter Entry",
    multiInputItemAriaLabel: ({ index }) => `Filter Argument ${index}`,
    multiInputItemPlaceholder: ({ position }) => `Filter Argument Entry #${position}`,
    multiInputFallbackPlaceholder: ({ position }) => `Filter Argument #${position}`,
    typeAheadSearchUnavailable: "placeholder: typeahead search not implemented yet",
    multiTypeAheadSearchUnavailable: "placeholder: multi-typeahead search not implemented yet",
    numberInput: {
      inputButtonGroupAriaLabel: "Filter argument number input controls",
    },
    dateTimePicker: {
      inputButtonGroupAriaLabel: "Filter argument date and time picker controls",
      triggerButtonAriaLabel: "Open filter argument calendar",
      calendarAriaLabel: "Filter argument calendar",
    },
    timePicker: {
      inputIconGroupAriaLabel: "Filter argument time picker controls",
    },
    comboBox: {
      inputButtonGroupAriaLabel: "Filter argument combobox controls",
      triggerButtonAriaLabel: "Show filter argument suggestions",
      emptyListMessage: "No filter arguments remaining to select",
    },
    tagComboBox: {
      groupAriaLabel: "Filter argument tag combobox controls",
      tagGroupAriaLabel: "Selected filter arguments",
      comboBox: {
        inputButtonGroupAriaLabel: "Filter argument combobox controls",
        triggerButtonAriaLabel: "Show filter argument suggestions",
        emptyListMessage: "No filter arguments remaining to select",
      },
    },
  },
}

export const resolveTableFilteringLabels = (labels?: TPartialTableFilteringLabels): TTableFilteringLabels => ({
  popover: {
    ...DEFAULT_TABLE_FILTERING_LABELS.popover,
    ...labels?.popover,
    joinOperators: {
      ...DEFAULT_TABLE_FILTERING_LABELS.popover.joinOperators,
      ...labels?.popover?.joinOperators,
    },
  },
  filterClause: {
    ...DEFAULT_TABLE_FILTERING_LABELS.filterClause,
    ...labels?.filterClause,
    operations: {
      ...DEFAULT_TABLE_FILTERING_LABELS.filterClause.operations,
      ...labels?.filterClause?.operations,
    },
  },
  argumentInput: {
    ...DEFAULT_TABLE_FILTERING_LABELS.argumentInput,
    ...labels?.argumentInput,
    numberInput: {
      ...DEFAULT_TABLE_FILTERING_LABELS.argumentInput.numberInput,
      ...labels?.argumentInput?.numberInput,
    },
    dateTimePicker: {
      ...DEFAULT_TABLE_FILTERING_LABELS.argumentInput.dateTimePicker,
      ...labels?.argumentInput?.dateTimePicker,
    },
    timePicker: {
      ...DEFAULT_TABLE_FILTERING_LABELS.argumentInput.timePicker,
      ...labels?.argumentInput?.timePicker,
    },
    comboBox: {
      ...DEFAULT_TABLE_FILTERING_LABELS.argumentInput.comboBox,
      ...labels?.argumentInput?.comboBox,
    },
    tagComboBox: {
      ...DEFAULT_TABLE_FILTERING_LABELS.argumentInput.tagComboBox,
      ...labels?.argumentInput?.tagComboBox,
      comboBox: {
        ...DEFAULT_TABLE_FILTERING_LABELS.argumentInput.tagComboBox.comboBox,
        ...labels?.argumentInput?.tagComboBox?.comboBox,
      },
    },
  },
})
