import type { CSSProperties, HTMLAttributes, ReactElement } from "react"

import type { TAriaLabelingProps } from "../../../tokens/a11y"
import {
  BOOLEAN_ARGUMENT_COMPONENT__CHECKBOX,
  BOOLEAN_ARGUMENT_COMPONENT__TOGGLE,
  FILTER_ARGUMENT_TYPE__BOOLEAN,
  FILTER_ARGUMENT_TYPE__CHECKBOX,
  FILTER_ARGUMENT_TYPE__COMBOBOX,
  FILTER_ARGUMENT_TYPE__INPUT,
  FILTER_ARGUMENT_TYPE__MULTI_INPUT,
  FILTER_ARGUMENT_TYPE__MULTI_SELECT,
  FILTER_ARGUMENT_TYPE__MULTI_TYPEAHEAD_SEARCH,
  FILTER_ARGUMENT_TYPE__RANGE,
  FILTER_ARGUMENT_TYPE__SELECT,
  FILTER_ARGUMENT_TYPE__TOGGLE,
  FILTER_ARGUMENT_TYPE__TYPEAHEAD_SEARCH,
  type TAvailableBooleanArgumentComponents,
  type TAvailableFilterArgumentDataTypes,
  type TAvailableFilterArgumentTypes,
  type TAvailableListItem,
} from "../../Table/filterMetadata"
import type { TTableFilterDraftArgumentValue } from "../../Table/queryTypes"
import { DEFAULT_TABLE_FILTERING_LABELS, type TTableFilterArgumentInputLabels } from "../labels"

import BooleanTypeFilterArgument from "./InternalComponents/BooleanTypeFilterArgument/BooleanTypeFilterArgument"
import ComboBoxTypeFilterArgument from "./InternalComponents/ComboBoxTypeFilterArgument/ComboBoxTypeFilterArgument"
import InputTypeFilterArgument from "./InternalComponents/InputTypeFilterArgument/InputTypeFilterArgument"
import MultiInputTypeFilterArgument from "./InternalComponents/MultiInputTypeFilterArgument/MultiInputTypeFilterArgument"
import MultiSelectTypeFilterArgument from "./InternalComponents/MultiSelectTypeFilterArgument/MultiSelectTypeFilterArgument"
import RangeTypeFilterArgument from "./InternalComponents/RangeTypeFilterArgument/RangeTypeFilterArgument"
import SelectTypeFilterArgument from "./InternalComponents/SelectTypeFilterArgument/SelectTypeFilterArgument"

export type TFilterArgumentChangeArgs = {
  argument: TTableFilterDraftArgumentValue
  filterArgumentSelectedKey?: string | null
}

export type TFilterArgumentSlotProps = {
  customFieldClassName?: string
  customFieldStyles?: CSSProperties
  customInputClassName?: string
  customInputStyles?: CSSProperties
  customRowClassName?: string
  customRowStyles?: CSSProperties
  customActionButtonClassName?: string
  customActionButtonStyles?: CSSProperties
  customPlaceholderClassName?: string
  customPlaceholderStyles?: CSSProperties
}

export type TFilterArgumentInputContext = TFilterArgumentSlotProps & {
  dataType: TAvailableFilterArgumentDataTypes
  argument?: TTableFilterDraftArgumentValue
  availableFilterArguments?: TAvailableListItem[]
  filterArgumentSelectedKey?: string | null
  filterArgumentAccessibleLabel?: string
  booleanArgumentComponent?: TAvailableBooleanArgumentComponents
  labels?: TTableFilterArgumentInputLabels
  onArgumentChange: (args: TFilterArgumentChangeArgs) => void
}

export type TDynamicFilterArgumentInputContextProps = TFilterArgumentInputContext & {
  filterArgumentType?: TAvailableFilterArgumentTypes
}

type TDynamicFilterArgumentInputNativeProps = Omit<HTMLAttributes<HTMLDivElement>, "children">

export type TDynamicFilterArgumentInputProps = TDynamicFilterArgumentInputNativeProps &
  TAriaLabelingProps &
  TDynamicFilterArgumentInputContextProps & {
    "data-testid"?: string
    customClassName?: string
    customStyles?: CSSProperties
  }

type TResolvedFilterArgumentInputContext = TFilterArgumentInputContext & {
  filterArgumentType: TAvailableFilterArgumentTypes
}

type TFilterArgumentRenderer = (props: TResolvedFilterArgumentInputContext) => ReactElement | null

const renderInputTypeFilterArgument: TFilterArgumentRenderer = (props) => <InputTypeFilterArgument {...props} />

const renderSelectTypeFilterArgument: TFilterArgumentRenderer = (props) => <SelectTypeFilterArgument {...props} />

const renderComboBoxTypeFilterArgument: TFilterArgumentRenderer = (props) => <ComboBoxTypeFilterArgument {...props} />

const renderRangeTypeFilterArgument: TFilterArgumentRenderer = (props) => <RangeTypeFilterArgument {...props} />

const renderMultiInputTypeFilterArgument: TFilterArgumentRenderer = (props) => (
  <MultiInputTypeFilterArgument {...props} />
)

const renderMultiSelectTypeFilterArgument: TFilterArgumentRenderer = (props) => (
  <MultiSelectTypeFilterArgument {...props} />
)

const renderBooleanTypeFilterArgument: TFilterArgumentRenderer = (props) => <BooleanTypeFilterArgument {...props} />

const renderCheckboxTypeFilterArgument: TFilterArgumentRenderer = (props) => (
  <BooleanTypeFilterArgument {...props} booleanArgumentComponent={BOOLEAN_ARGUMENT_COMPONENT__CHECKBOX} />
)

const renderToggleTypeFilterArgument: TFilterArgumentRenderer = (props) => (
  <BooleanTypeFilterArgument {...props} booleanArgumentComponent={BOOLEAN_ARGUMENT_COMPONENT__TOGGLE} />
)

const renderTypeAheadSearchPlaceholder: TFilterArgumentRenderer = (props) => (
  <div className={props.customPlaceholderClassName} style={props.customPlaceholderStyles}>
    {props.labels?.typeAheadSearchUnavailable ??
      DEFAULT_TABLE_FILTERING_LABELS.argumentInput.typeAheadSearchUnavailable}
  </div>
)

const renderMultiTypeAheadSearchPlaceholder: TFilterArgumentRenderer = (props) => (
  <div className={props.customPlaceholderClassName} style={props.customPlaceholderStyles}>
    {props.labels?.multiTypeAheadSearchUnavailable ??
      DEFAULT_TABLE_FILTERING_LABELS.argumentInput.multiTypeAheadSearchUnavailable}
  </div>
)

const filterArgumentRendererByType = {
  [FILTER_ARGUMENT_TYPE__INPUT]: renderInputTypeFilterArgument,
  [FILTER_ARGUMENT_TYPE__TYPEAHEAD_SEARCH]: renderTypeAheadSearchPlaceholder,
  [FILTER_ARGUMENT_TYPE__RANGE]: renderRangeTypeFilterArgument,
  [FILTER_ARGUMENT_TYPE__MULTI_INPUT]: renderMultiInputTypeFilterArgument,
  [FILTER_ARGUMENT_TYPE__MULTI_TYPEAHEAD_SEARCH]: renderMultiTypeAheadSearchPlaceholder,
  [FILTER_ARGUMENT_TYPE__SELECT]: renderSelectTypeFilterArgument,
  [FILTER_ARGUMENT_TYPE__COMBOBOX]: renderComboBoxTypeFilterArgument,
  [FILTER_ARGUMENT_TYPE__MULTI_SELECT]: renderMultiSelectTypeFilterArgument,
  [FILTER_ARGUMENT_TYPE__CHECKBOX]: renderCheckboxTypeFilterArgument,
  [FILTER_ARGUMENT_TYPE__TOGGLE]: renderToggleTypeFilterArgument,
  [FILTER_ARGUMENT_TYPE__BOOLEAN]: renderBooleanTypeFilterArgument,
} satisfies Record<TAvailableFilterArgumentTypes, TFilterArgumentRenderer>

/** Chooses a renderer for the controlled argument context; an unset kind has no input. */
export const renderFilterArgumentInput = ({
  filterArgumentType,
  ...context
}: TDynamicFilterArgumentInputContextProps): ReactElement | null => {
  if (!filterArgumentType) return null

  return filterArgumentRendererByType[filterArgumentType]({ ...context, filterArgumentType })
}
