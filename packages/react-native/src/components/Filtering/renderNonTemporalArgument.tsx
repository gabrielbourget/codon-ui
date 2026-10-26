import type { ReactElement } from "react"
import type { StyleProp, TextStyle, ViewStyle } from "react-native"

import type {
  TAvailableBooleanArgumentComponents,
  TAvailableFilterArgumentTypes,
  TAvailableListItem,
} from "../Table/filterMetadata"
import type { TTableFilterArgumentDataType, TTableFilterDraftArgumentValue } from "../Table/queryTypes"
import { Text } from "../Text/Text"

import { BooleanFilterArgument } from "./BooleanArgument"
import { ComboBoxFilterArgument } from "./ComboBoxArgument"
import { DEFAULT_NON_TEMPORAL_FILTER_ARGUMENT_LABELS, type TNonTemporalFilterArgumentLabels } from "./dispatchLabels"
import { ListFilterArgument } from "./ListArgument"
import { NumberFilterArgument } from "./NumberArgument"
import { MultiSelectFilterArgument, SelectFilterArgument, type TFilterArgumentChangeArgs } from "./OptionArguments"
import { RangeFilterArgument, type TRangeFilterArgumentProps } from "./RangeArgument"
import type { TFilterAvailability } from "./requests"
import { TextFilterArgument } from "./TextArgument"

export const NON_TEMPORAL_FILTER_ARGUMENT_DATA_TYPES = ["text", "number", "boolean"] as const
export type TNonTemporalFilterArgumentDataType = (typeof NON_TEMPORAL_FILTER_ARGUMENT_DATA_TYPES)[number]
export const isNonTemporalFilterArgumentDataType = (dataType: string): dataType is TNonTemporalFilterArgumentDataType =>
  (NON_TEMPORAL_FILTER_ARGUMENT_DATA_TYPES as readonly string[]).includes(dataType)

export type TNonTemporalFilterArgumentContext = TFilterAvailability & {
  dataType: TNonTemporalFilterArgumentDataType
  argument?: TTableFilterDraftArgumentValue
  filterArgumentType?: TAvailableFilterArgumentTypes
  filterArgumentAccessibleLabel?: string
  filterArgumentSelectedKey?: string | null
  availableFilterArguments?: TAvailableListItem[]
  booleanArgumentComponent?: TAvailableBooleanArgumentComponents
  labels?: TNonTemporalFilterArgumentLabels
  nativeLabels: {
    number: { incrementLabel: string; decrementLabel: string }
    range: TRangeFilterArgumentProps["numberLabels"]
    options: { inputLabel: string; closeLabel: string }
  }
  onArgumentChange: (args: TFilterArgumentChangeArgs) => void
  customFieldStyles?: StyleProp<TextStyle>
  customInputStyles?: StyleProp<TextStyle>
  customRowStyles?: StyleProp<ViewStyle>
  customActionButtonStyles?: StyleProp<TextStyle>
  customPlaceholderStyles?: StyleProp<TextStyle>
}
type TResolvedContext = Omit<TNonTemporalFilterArgumentContext, "dataType"> & {
  dataType: TTableFilterArgumentDataType
  labels: TNonTemporalFilterArgumentLabels
}
type TRenderer = (context: TResolvedContext) => ReactElement

const renderScalar: TRenderer = (props) => (
  <>
    {props.dataType === "text" ? (
      <TextFilterArgument {...props} />
    ) : props.dataType === "number" ? (
      <NumberFilterArgument {...props} {...props.nativeLabels.number} />
    ) : null}
  </>
)
const renderRange: TRenderer = (props) => (
  <>
    {props.dataType === "text" || props.dataType === "number" ? (
      <RangeFilterArgument {...props} dataType={props.dataType} numberLabels={props.nativeLabels.range} />
    ) : null}
  </>
)
const renderers = {
  Input: renderScalar,
  Range: renderRange,
  "Multi Input": (props) => <ListFilterArgument {...props} />,
  Select: (props) => <SelectFilterArgument {...props} closeLabel={props.nativeLabels.options.closeLabel} />,
  "Multi Select": (props) => <MultiSelectFilterArgument {...props} {...props.nativeLabels.options} />,
  "Combo Box": (props) => (
    <ComboBoxFilterArgument
      {...props}
      {...props.nativeLabels.options}
      labels={{ label: props.labels.label, ...props.labels.comboBox }}
    />
  ),
  Boolean: (props) => <BooleanFilterArgument {...props} />,
  Checkbox: (props) => <BooleanFilterArgument {...props} booleanArgumentComponent="Checkbox" />,
  Toggle: (props) => <BooleanFilterArgument {...props} booleanArgumentComponent="Toggle" />,
  "Typeahead Search": (props) => (
    <Text testID="filter-typeahead-placeholder" customStyles={props.customPlaceholderStyles}>
      {props.labels.typeAheadSearchUnavailable ??
        DEFAULT_NON_TEMPORAL_FILTER_ARGUMENT_LABELS.typeAheadSearchUnavailable}
    </Text>
  ),
  "Multi-Typeahead Search": (props) => (
    <Text testID="filter-multi-typeahead-placeholder" customStyles={props.customPlaceholderStyles}>
      {props.labels.multiTypeAheadSearchUnavailable ??
        DEFAULT_NON_TEMPORAL_FILTER_ARGUMENT_LABELS.multiTypeAheadSearchUnavailable}
    </Text>
  ),
} satisfies Record<TAvailableFilterArgumentTypes, TRenderer>

export const renderFilterArgumentKind = (props: TResolvedContext): ReactElement | null =>
  props.filterArgumentType ? renderers[props.filterArgumentType](props) : null

// Retain the named non-temporal renderer for its existing private callers.
export const renderNonTemporalFilterArgumentInput = (props: TNonTemporalFilterArgumentContext): ReactElement | null => {
  if (!props.filterArgumentType) return null
  if (!isNonTemporalFilterArgumentDataType(props.dataType))
    throw new TypeError("Non-temporal filter argument renderer requires text, number or boolean data")
  return renderFilterArgumentKind({
    ...props,
    labels: props.labels ?? DEFAULT_NON_TEMPORAL_FILTER_ARGUMENT_LABELS,
  })
}
