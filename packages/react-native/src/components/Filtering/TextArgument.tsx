import { forwardRef } from "react"
import type { StyleProp, TextStyle } from "react-native"

import { FormField } from "../FormField/FormField"
import { Input } from "../Input/Input"
import type { TNativeInputRef } from "../Input/types"
import type { TTableFilterDraftArgumentValue } from "../Table/queryTypes"

import type { TFilterArgumentChangeArgs } from "./OptionArguments"
import { useFilterRequest, type TFilterAvailability } from "./requests"

export type TFilterTextLabels = { label: string; placeholder: string }
export const DEFAULT_FILTER_TEXT_LABELS: TFilterTextLabels = {
  label: "Filter Argument",
  placeholder: "Filter Argument",
}
export type TTextFilterArgumentProps = TFilterAvailability & {
  argument?: TTableFilterDraftArgumentValue
  filterArgumentAccessibleLabel?: string
  labels?: TFilterTextLabels
  onArgumentChange: (args: TFilterArgumentChangeArgs) => void
  customFieldStyles?: StyleProp<TextStyle>
  customInputStyles?: StyleProp<TextStyle>
}

export const TextFilterArgument = forwardRef<TNativeInputRef, TTextFilterArgumentProps>((props, ref) => {
  const labels = props.labels ?? DEFAULT_FILTER_TEXT_LABELS
  const request = useFilterRequest(props, false)
  return (
    <FormField label={labels.label} customStyles={props.customFieldStyles}>
      <Input
        ref={ref}
        value={typeof props.argument === "string" ? props.argument : ""}
        accessibilityLabel={props.filterArgumentAccessibleLabel || labels.label}
        placeholder={labels.placeholder}
        customStyles={[{ width: "100%" }, props.customInputStyles]}
        onChangeText={request((current, text: string) => current.onArgumentChange({ argument: text }))}
      />
    </FormField>
  )
})
TextFilterArgument.displayName = "TextFilterArgument"
