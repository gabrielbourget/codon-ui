import {
  AVAILABLE_TABLE_FILTER_CONDITION_TYPES,
  type TTableFilterArgumentValue,
  type TTableFilterOperationCode,
  type TTableSortDirection,
} from "./queryTypes"

const createListItems = <T extends readonly string[]>(items: T) => {
  return items.map((item) => ({
    id: item,
    name: item,
  })) as { id: T[number]; name: T[number] }[]
}

export const FILTER_ARGUMENT_DATA_TYPE__TEXT = "text"
export const FILTER_ARGUMENT_DATA_TYPE__NUMBER = "number"
export const FILTER_ARGUMENT_DATA_TYPE__DATE = "date"
export const FILTER_ARGUMENT_DATA_TYPE__DATETIME = "date-time"
export const FILTER_ARGUMENT_DATA_TYPE__TIME = "time"
export const FILTER_ARGUMENT_DATA_TYPE__BOOLEAN = "boolean"

export type TAvailableFilterArgumentDataTypes =
  | typeof FILTER_ARGUMENT_DATA_TYPE__TEXT
  | typeof FILTER_ARGUMENT_DATA_TYPE__NUMBER
  | typeof FILTER_ARGUMENT_DATA_TYPE__DATE
  | typeof FILTER_ARGUMENT_DATA_TYPE__DATETIME
  | typeof FILTER_ARGUMENT_DATA_TYPE__TIME
  | typeof FILTER_ARGUMENT_DATA_TYPE__BOOLEAN

export const FILTER_ARGUMENT_TYPE__INPUT = "Input"
export const FILTER_ARGUMENT_TYPE__TYPEAHEAD_SEARCH = "Typeahead Search"
export const FILTER_ARGUMENT_TYPE__RANGE = "Range"
export const FILTER_ARGUMENT_TYPE__MULTI_INPUT = "Multi Input"
export const FILTER_ARGUMENT_TYPE__MULTI_TYPEAHEAD_SEARCH = "Multi-Typeahead Search"
export const FILTER_ARGUMENT_TYPE__SELECT = "Select"
export const FILTER_ARGUMENT_TYPE__COMBOBOX = "Combo Box"
export const FILTER_ARGUMENT_TYPE__MULTI_SELECT = "Multi Select"
export const FILTER_ARGUMENT_TYPE__CHECKBOX = "Checkbox"
export const FILTER_ARGUMENT_TYPE__TOGGLE = "Toggle"
export const FILTER_ARGUMENT_TYPE__BOOLEAN = "Boolean"
export const AVAILABLE_FILTER_ARGUMENT_TYPES = [
  FILTER_ARGUMENT_TYPE__INPUT,
  FILTER_ARGUMENT_TYPE__TYPEAHEAD_SEARCH,
  FILTER_ARGUMENT_TYPE__RANGE,
  FILTER_ARGUMENT_TYPE__MULTI_INPUT,
  FILTER_ARGUMENT_TYPE__MULTI_TYPEAHEAD_SEARCH,
  FILTER_ARGUMENT_TYPE__SELECT,
  FILTER_ARGUMENT_TYPE__COMBOBOX,
  FILTER_ARGUMENT_TYPE__MULTI_SELECT,
  FILTER_ARGUMENT_TYPE__CHECKBOX,
  FILTER_ARGUMENT_TYPE__TOGGLE,
  FILTER_ARGUMENT_TYPE__BOOLEAN,
] as const

export type TAvailableFilterArgumentTypes = (typeof AVAILABLE_FILTER_ARGUMENT_TYPES)[number]

export const BOOLEAN_ARGUMENT_COMPONENT__CHECKBOX = "Checkbox"
export const BOOLEAN_ARGUMENT_COMPONENT__TOGGLE = "Toggle"
export const AVAILABLE_BOOLEAN_ARGUMENT_COMPONENTS = [
  BOOLEAN_ARGUMENT_COMPONENT__CHECKBOX,
  BOOLEAN_ARGUMENT_COMPONENT__TOGGLE,
] as const

export type TAvailableBooleanArgumentComponents = (typeof AVAILABLE_BOOLEAN_ARGUMENT_COMPONENTS)[number]

export type TAvailableListItem = {
  id: string
  name: string
  argumentValue?: TTableFilterArgumentValue
}

export type TAvailableSortCriteria = {
  id: string
  name: string
  queryKey?: string
  defaultDirection?: TTableSortDirection
}

export type TAvailableFilterCriteria = {
  id: string
  name: string
  queryKey?: string
  dataType: TAvailableFilterArgumentDataTypes
  allowedOperationCodes?: readonly TTableFilterOperationCode[]
  usesTypeAheadInput?: boolean
  typeAheadInputOnChange?: (value: string) => void
  usesSelectInput?: boolean
  usesComboBoxInput?: boolean
  availableCriteriaArguments?: TAvailableListItem[]
}

export const possibleFilterConditionTypes = createListItems(AVAILABLE_TABLE_FILTER_CONDITION_TYPES)
