import { parseDate, parseTime } from "@internationalized/date"
import type { FC } from "react"

import DateTimePicker from "../../../../DateTimePicker/DateTimePicker"
import FormField from "../../../../FormField/FormField"
import Input from "../../../../Input/Input"
import NumberInput from "../../../../NumberInput/NumberInput"
import TimePicker from "../../../../TimePicker/TimePicker"
import { DEFAULT_TABLE_FILTERING_LABELS } from "../../../labels"
import type { TFilterArgumentInputContext } from "../../helpers"

export type TInputTypeFilterArgumentProps = TFilterArgumentInputContext

const InputTypeFilterArgument: FC<TInputTypeFilterArgumentProps> = (props) => {
  const {
    argument,
    customFieldClassName,
    customFieldStyles,
    customInputClassName,
    customInputStyles,
    dataType,
    filterArgumentAccessibleLabel,
    labels,
    onArgumentChange,
  } = props
  const resolvedLabels = labels ?? DEFAULT_TABLE_FILTERING_LABELS.argumentInput
  let ComputedFilterArgumentInput: React.ReactElement | undefined = undefined

  if (dataType === "text") {
    ComputedFilterArgumentInput = (
      <FormField
        label={resolvedLabels.label}
        labelID="input-type-filter-argument"
        customClassName={customFieldClassName}
        customStyles={customFieldStyles}
      >
        <Input
          aria-label={filterArgumentAccessibleLabel}
          aria-labelledby={filterArgumentAccessibleLabel ? undefined : "input-type-filter-argument"}
          className={customInputClassName}
          value={typeof argument === "string" ? argument : ""}
          placeholder={resolvedLabels.placeholder}
          customStyles={{ width: "100%", ...customInputStyles }}
          onChange={(event) => {
            onArgumentChange({ argument: event.target.value })
          }}
        />
      </FormField>
    )
  } else if (dataType === "number") {
    ComputedFilterArgumentInput = (
      <FormField
        label={resolvedLabels.label}
        labelID="input-type-filter-argument"
        customClassName={customFieldClassName}
        customStyles={customFieldStyles}
      >
        <NumberInput
          aria-labelledby="input-type-filter-argument"
          className={customInputClassName}
          value={argument as number}
          placeholder={resolvedLabels.placeholder}
          labels={resolvedLabels.numberInput}
          customStyles={{ width: "100%", ...customInputStyles }}
          onChange={(value) => {
            onArgumentChange({ argument: value })
          }}
        />
      </FormField>
    )
  } else if (dataType === "date") {
    ComputedFilterArgumentInput = (
      <FormField
        label={resolvedLabels.dateLabel}
        labelID="date-input-type-filter-argument"
        customClassName={customFieldClassName}
        customStyles={customFieldStyles}
      >
        <DateTimePicker
          granularity="day"
          multiMonth
          aria-labelledby="date-input-type-filter-argument"
          className={customInputClassName}
          value={argument ? parseDate(argument as string) : null}
          labels={resolvedLabels.dateTimePicker}
          customStyles={{ width: "100%", ...customInputStyles }}
          onChange={(value) => {
            if (!value) return
            onArgumentChange({ argument: value.toString() })
          }}
        />
      </FormField>
    )
  } else if (dataType === "date-time") {
    ComputedFilterArgumentInput = (
      <FormField
        label={resolvedLabels.dateTimeLabel}
        labelID="date-time-input-type-filter-argument"
        customClassName={customFieldClassName}
        customStyles={customFieldStyles}
      >
        <DateTimePicker
          granularity="second"
          multiMonth
          aria-labelledby="date-time-input-type-filter-argument"
          className={customInputClassName}
          value={argument ? parseDate(argument as string) : null}
          labels={resolvedLabels.dateTimePicker}
          customStyles={{ width: "100%", ...customInputStyles }}
          onChange={(value) => {
            if (!value) return
            onArgumentChange({ argument: value.toString() })
          }}
        />
      </FormField>
    )
  } else if (dataType === "time") {
    ComputedFilterArgumentInput = (
      <FormField
        label={resolvedLabels.timeLabel}
        labelID="time-input-type-filter-argument"
        customClassName={customFieldClassName}
        customStyles={customFieldStyles}
      >
        <TimePicker
          granularity="second"
          aria-labelledby="time-input-type-filter-argument"
          className={customInputClassName}
          value={argument ? parseTime(argument as string) : null}
          labels={resolvedLabels.timePicker}
          customStyles={{ width: "100%", ...customInputStyles }}
          onChange={(value) => {
            if (!value) return
            onArgumentChange({ argument: value.toString() })
          }}
        />
      </FormField>
    )
  }

  return ComputedFilterArgumentInput
}

export default InputTypeFilterArgument
