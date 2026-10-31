import type { TTableFilterArgumentDataType } from "../Table/queryTypes"

import { DEFAULT_FILTER_ARGUMENT_LABELS, type TFilterArgumentLabels } from "./dispatchLabels"
import { renderFilterArgumentKind, type TNonTemporalFilterArgumentContext } from "./renderNonTemporalArgument"
import { isTemporalFilterArgumentDataType, TemporalFilterArgument } from "./TemporalArgument"

export type TFilterArgumentContext = Omit<TNonTemporalFilterArgumentContext, "dataType" | "labels"> & {
  dataType: TTableFilterArgumentDataType
  labels?: TNonTemporalFilterArgumentContext["labels"] & Partial<TFilterArgumentLabels>
}
export const renderFilterArgumentInput = (props: TFilterArgumentContext) => {
  if (!props.filterArgumentType) return null
  const labels = {
    ...DEFAULT_FILTER_ARGUMENT_LABELS,
    ...props.labels,
    dateTimePicker: { ...DEFAULT_FILTER_ARGUMENT_LABELS.dateTimePicker, ...props.labels?.dateTimePicker },
    timePicker: { ...DEFAULT_FILTER_ARGUMENT_LABELS.timePicker, ...props.labels?.timePicker },
  }
  if (isTemporalFilterArgumentDataType(props.dataType) && ["Input", "Range"].includes(props.filterArgumentType))
    return (
      <TemporalFilterArgument
        {...props}
        dataType={props.dataType}
        range={props.filterArgumentType === "Range"}
        labels={labels}
      />
    )
  return renderFilterArgumentKind({ ...props, labels })
}
