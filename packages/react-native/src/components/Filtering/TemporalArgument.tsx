import { View, type StyleProp, type TextStyle, type ViewStyle } from "react-native"

import { useNativeTheme } from "../../theme"
import { resolveNativeStyle } from "../colors"
import { DateTimePicker } from "../DateTimePicker/DateTimePicker"
import { FormField } from "../FormField/FormField"
import type { TTableFilterDraftArgumentValue } from "../Table/queryTypes"
import { TimePicker } from "../TimePicker/TimePicker"

import { getFilterArrayArgument } from "./argumentValues"
import { DEFAULT_FILTER_ARGUMENT_LABELS, type TFilterArgumentLabels } from "./dispatchLabels"
import type { TFilterArgumentChangeArgs } from "./OptionArguments"
import { useFilterRequest, type TFilterAvailability } from "./requests"
import { parseFilterDateArgument, parseFilterDateTimeArgument, parseFilterTimeArgument } from "./temporalValues"

export const TEMPORAL_FILTER_ARGUMENT_DATA_TYPES = ["date", "date-time", "time"] as const
export type TTemporalFilterArgumentDataType = (typeof TEMPORAL_FILTER_ARGUMENT_DATA_TYPES)[number]
export const isTemporalFilterArgumentDataType = (value: string): value is TTemporalFilterArgumentDataType =>
  (TEMPORAL_FILTER_ARGUMENT_DATA_TYPES as readonly string[]).includes(value)

export type TTemporalFilterArgumentProps = TFilterAvailability & {
  dataType: TTemporalFilterArgumentDataType
  argument?: TTableFilterDraftArgumentValue
  range?: boolean
  labels?: TFilterArgumentLabels
  onArgumentChange: (args: TFilterArgumentChangeArgs) => void
  customFieldStyles?: StyleProp<TextStyle>
  customInputStyles?: StyleProp<TextStyle>
  customRowStyles?: StyleProp<ViewStyle>
}

export const TemporalFilterArgument = (props: TTemporalFilterArgumentProps) => {
  const labels = props.labels ?? DEFAULT_FILTER_ARGUMENT_LABELS
  const theme = useNativeTheme()
  const request = useFilterRequest(props, false)
  const values = props.range ? getFilterArrayArgument(props.argument) : [props.argument]
  const inputStyles = resolveNativeStyle<TextStyle>(
    [{ width: "100%" }, props.customInputStyles],
    "TemporalFilterArgument",
    "customInputStyles",
  )
  const fields = props.range ? [0, 1] : [0]
  const children = fields.map((index) => {
    const label = props.range
      ? index === 0
        ? props.dataType === "date"
          ? labels.minValueLabel
          : labels.minimumLabel
        : props.dataType === "date"
          ? labels.maxValueLabel
          : labels.maximumLabel
      : props.dataType === "date"
        ? labels.dateLabel
        : props.dataType === "date-time"
          ? labels.dateTimeLabel
          : labels.timeLabel
    const change = request((current, value: { toString(): string } | null) => {
      const next = value?.toString() ?? null
      if (!current.range) current.onArgumentChange({ argument: next })
      else {
        const previous = getFilterArrayArgument(current.argument)
        current.onArgumentChange({ argument: index === 0 ? [next, previous[1]] : [previous[0], next] })
      }
    })
    return (
      <FormField key={index} label={label} customStyles={props.customFieldStyles}>
        {props.dataType === "time" ? (
          <TimePicker
            accessibilityLabel={label}
            granularity="second"
            value={parseFilterTimeArgument(values[index])}
            labels={labels.timePicker}
            customStyles={inputStyles}
            onChange={change}
          />
        ) : props.dataType === "date" ? (
          <DateTimePicker
            accessibilityLabel={label}
            granularity="day"
            multiMonth
            value={parseFilterDateArgument(values[index])}
            labels={labels.dateTimePicker}
            customStyles={inputStyles}
            onChange={change}
          />
        ) : (
          <DateTimePicker
            accessibilityLabel={label}
            granularity="second"
            multiMonth
            value={parseFilterDateTimeArgument(values[index])}
            labels={labels.dateTimePicker}
            customStyles={inputStyles}
            onChange={change}
          />
        )}
      </FormField>
    )
  })
  return props.range ? (
    <View
      testID="filter-temporal-range"
      style={[
        {
          flexDirection: props.dataType === "date-time" ? "column" : "row",
          ...(props.dataType === "date-time" ? {} : { alignItems: "center" as const }),
          gap: theme.spacing.unit,
        },
        props.customRowStyles,
      ]}
    >
      {children}
    </View>
  ) : (
    children[0]
  )
}
