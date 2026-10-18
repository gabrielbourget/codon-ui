import { parseDate, parseTime } from "@internationalized/date"
import classNames from "classnames"
import { type FC } from "react"

import DateTimePicker from "../../../../DateTimePicker/DateTimePicker"
import FormField from "../../../../FormField/FormField"
import Input from "../../../../Input/Input"
import NumberInput from "../../../../NumberInput/NumberInput"
import TimePicker from "../../../../TimePicker/TimePicker"
import { DEFAULT_TABLE_FILTERING_LABELS } from "../../../labels"
import type { TFilterArgumentInputContext } from "../../helpers"

import styles from "./RangeTypeFilterArgumentStyles.module.css"

const { rangeTypeFilterArgument, rangeTypeFilterArgument__row, rangeTypeFilterArgument__column } = styles

const getFilterArrayArgument = (argument: TFilterArgumentInputContext["argument"]) => {
  if (argument == null) return []
  if (!Array.isArray(argument)) throw new TypeError("Filter range/list argument must be an array or nullish")
  return argument
}

export type TRangeTypeFilterArgumentProps = TFilterArgumentInputContext

const RangeTypeFilterArgument: FC<TRangeTypeFilterArgumentProps> = (props) => {
  const {
    argument,
    customFieldClassName,
    customFieldStyles,
    customInputClassName,
    customInputStyles,
    customRowClassName,
    customRowStyles,
    dataType,
    labels,
    onArgumentChange,
  } = props
  const resolvedLabels = labels ?? DEFAULT_TABLE_FILTERING_LABELS.argumentInput
  let ComputedFilterArgumentInput: React.ReactElement | undefined = undefined

  if (dataType === "text") {
    const rangeArgument = getFilterArrayArgument(argument)

    ComputedFilterArgumentInput = (
      <div
        className={classNames(rangeTypeFilterArgument, rangeTypeFilterArgument__row, customRowClassName)}
        style={customRowStyles}
      >
        <FormField
          label={resolvedLabels.minValueLabel}
          labelID="filter-argument-input--minimum"
          customClassName={customFieldClassName}
          customStyles={customFieldStyles}
        >
          <Input
            aria-labelledby="filter-argument-input--minimum"
            className={customInputClassName}
            value={rangeArgument[0] == null ? "" : String(rangeArgument[0])}
            placeholder={resolvedLabels.minValuePlaceholder}
            customStyles={{ flex: 1, display: "flex", ...customInputStyles }}
            onChange={(event) => {
              onArgumentChange({
                argument: [event.target.value, rangeArgument[1]],
              })
            }}
          />
        </FormField>

        <FormField
          label={resolvedLabels.maxValueLabel}
          labelID="filter-argument-input--maximum"
          customClassName={customFieldClassName}
          customStyles={customFieldStyles}
        >
          <Input
            aria-labelledby="filter-argument-input--maximum"
            className={customInputClassName}
            value={rangeArgument[1] == null ? "" : String(rangeArgument[1])}
            placeholder={resolvedLabels.maxValuePlaceholder}
            customStyles={{ flex: 1, display: "flex", ...customInputStyles }}
            onChange={(event) => {
              onArgumentChange({
                argument: [rangeArgument[0], event.target.value],
              })
            }}
          />
        </FormField>
      </div>
    )
  } else if (dataType === "number") {
    const rangeArgument = getFilterArrayArgument(argument)

    ComputedFilterArgumentInput = (
      <div
        className={classNames(rangeTypeFilterArgument, rangeTypeFilterArgument__row, customRowClassName)}
        style={customRowStyles}
      >
        <FormField
          label={resolvedLabels.minValueLabel}
          labelID="filter-argument-input--minimum"
          customClassName={customFieldClassName}
          customStyles={customFieldStyles}
        >
          <NumberInput
            aria-labelledby="filter-argument-input--minimum"
            className={customInputClassName}
            value={rangeArgument[0] == null ? NaN : (rangeArgument[0] as number)}
            placeholder={resolvedLabels.minValuePlaceholder}
            labels={resolvedLabels.numberInput}
            customStyles={{ flex: 1, display: "flex", ...customInputStyles }}
            onChange={(value) => {
              onArgumentChange({ argument: [Number.isNaN(value) ? null : value, rangeArgument[1]] })
            }}
          />
        </FormField>

        <FormField
          label={resolvedLabels.maxValueLabel}
          labelID="filter-argument-input--maximum"
          customClassName={customFieldClassName}
          customStyles={customFieldStyles}
        >
          <NumberInput
            aria-labelledby="filter-argument-input--maximum"
            className={customInputClassName}
            value={rangeArgument[1] == null ? NaN : (rangeArgument[1] as number)}
            placeholder={resolvedLabels.maxValuePlaceholder}
            labels={resolvedLabels.numberInput}
            customStyles={{ flex: 1, display: "flex", ...customInputStyles }}
            onChange={(value) => {
              onArgumentChange({ argument: [rangeArgument[0], Number.isNaN(value) ? null : value] })
            }}
          />
        </FormField>
      </div>
    )
  } else if (dataType === "date") {
    const rangeArgument = getFilterArrayArgument(argument)

    ComputedFilterArgumentInput = (
      <div
        className={classNames(rangeTypeFilterArgument, rangeTypeFilterArgument__row, customRowClassName)}
        style={customRowStyles}
      >
        <FormField
          label={resolvedLabels.minValueLabel}
          labelID="filter-argument-input--minimum"
          customClassName={customFieldClassName}
          customStyles={customFieldStyles}
        >
          <DateTimePicker
            granularity="day"
            multiMonth
            aria-labelledby="filter-argument-input--minimum"
            className={customInputClassName}
            value={parseDate(rangeArgument[0] as string)}
            labels={resolvedLabels.dateTimePicker}
            customStyles={{ width: "100%", ...customInputStyles }}
            onChange={(value) => {
              if (!value) return
              // - TODO: -> Probably need to convert date from date picker back to a ms-since-epoch string.
              onArgumentChange({
                argument: [value.toString(), rangeArgument[1]],
              })
            }}
          />
        </FormField>

        <FormField
          label={resolvedLabels.maxValueLabel}
          labelID="filter-argument-input--maximum"
          customClassName={customFieldClassName}
          customStyles={customFieldStyles}
        >
          <DateTimePicker
            granularity="day"
            multiMonth
            aria-labelledby="filter-argument-input--maximum"
            className={customInputClassName}
            value={parseDate(rangeArgument[1] as string)}
            labels={resolvedLabels.dateTimePicker}
            customStyles={{ width: "100%", ...customInputStyles }}
            onChange={(value) => {
              if (!value) return
              // - TODO: -> Probably need to convert date from date picker back to a ms-since-epoch string.
              onArgumentChange({
                argument: [rangeArgument[0], value.toString()],
              })
            }}
          />
        </FormField>
      </div>
    )
  } else if (dataType === "date-time") {
    const rangeArgument = getFilterArrayArgument(argument)

    ComputedFilterArgumentInput = (
      <div
        className={classNames(rangeTypeFilterArgument, rangeTypeFilterArgument__column, customRowClassName)}
        style={customRowStyles}
      >
        <FormField
          label={resolvedLabels.minimumLabel}
          labelID="filter-argument-input--minimum"
          customClassName={customFieldClassName}
          customStyles={customFieldStyles}
        >
          <DateTimePicker
            granularity="second"
            multiMonth
            aria-labelledby="filter-argument-input--minimum"
            className={customInputClassName}
            value={parseDate(rangeArgument[0] as string)}
            labels={resolvedLabels.dateTimePicker}
            customStyles={{ width: "100%", ...customInputStyles }}
            onChange={(value) => {
              if (!value) return
              // - TODO: -> Probably need to convert date from date picker back to a ms-since-epoch string.
              onArgumentChange({
                argument: [value.toString(), rangeArgument[1]],
              })
            }}
          />
        </FormField>

        <FormField
          label={resolvedLabels.maximumLabel}
          labelID="filter-argument-input--maximum"
          customClassName={customFieldClassName}
          customStyles={customFieldStyles}
        >
          <DateTimePicker
            granularity="second"
            multiMonth
            aria-labelledby="filter-argument-input--maximum"
            className={customInputClassName}
            value={parseDate(rangeArgument[1] as string)}
            labels={resolvedLabels.dateTimePicker}
            customStyles={{ width: "100%", ...customInputStyles }}
            onChange={(value) => {
              if (!value) return
              // - TODO: -> Probably need to convert date from date picker back to a ms-since-epoch string.
              onArgumentChange({
                argument: [rangeArgument[0], value.toString()],
              })
            }}
          />
        </FormField>
      </div>
    )
  } else if (dataType === "time") {
    const rangeArgument = getFilterArrayArgument(argument)

    ComputedFilterArgumentInput = (
      <div
        className={classNames(rangeTypeFilterArgument, rangeTypeFilterArgument__row, customRowClassName)}
        style={customRowStyles}
      >
        <FormField
          label={resolvedLabels.minimumLabel}
          labelID="filter-argument-input--minimum"
          customClassName={customFieldClassName}
          customStyles={customFieldStyles}
        >
          <TimePicker
            granularity="second"
            aria-labelledby="filter-argument-input--minimum"
            className={customInputClassName}
            value={parseTime(rangeArgument[0] as string)}
            labels={resolvedLabels.timePicker}
            customStyles={{ width: "100%", ...customInputStyles }}
            onChange={(value) => {
              if (!value) return
              // - TODO: -> Probably need to convert time from time picker back to a ms-since-midnight string.
              onArgumentChange({
                argument: [value.toString(), rangeArgument[1]],
              })
            }}
          />
        </FormField>

        <FormField
          label={resolvedLabels.maximumLabel}
          labelID="filter-argument-input--maximum"
          customClassName={customFieldClassName}
          customStyles={customFieldStyles}
        >
          <TimePicker
            granularity="second"
            aria-labelledby="filter-argument-input--maximum"
            className={customInputClassName}
            value={parseTime(rangeArgument[1] as string)}
            labels={resolvedLabels.timePicker}
            customStyles={{ width: "100%", ...customInputStyles }}
            onChange={(value) => {
              if (!value) return
              // - TODO: -> Probably need to convert time from time picker back to a ms-since-midnight string.
              onArgumentChange({
                argument: [rangeArgument[0], value.toString()],
              })
            }}
          />
        </FormField>
      </div>
    )
  }

  return ComputedFilterArgumentInput
}

export default RangeTypeFilterArgument
