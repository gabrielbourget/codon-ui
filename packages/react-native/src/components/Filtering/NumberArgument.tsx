import { forwardRef } from "react"
import type { StyleProp, TextStyle } from "react-native"

import { resolveNativeStyle } from "../colors"
import { FormField } from "../FormField/FormField"
import { splitNativeTextStyle } from "../nativeTextStyle"
import { NumberInput } from "../NumberInput/NumberInput"
import type { TNativeNumberInputRef } from "../NumberInput/types"
import type { TTableFilterDraftArgumentValue } from "../Table/queryTypes"

import { getControlledFilterNumberArgument } from "./argumentValues"
import { DEFAULT_FILTER_EDITOR_LABELS } from "./editorLabels"
import type { TFilterArgumentChangeArgs } from "./OptionArguments"
import { useFilterRequest, type TFilterAvailability } from "./requests"
import type { TFilterTextLabels } from "./TextArgument"

export type TNumberFilterArgumentProps = TFilterAvailability & {
  argument?: TTableFilterDraftArgumentValue
  labels?: TFilterTextLabels
  incrementLabel: string
  decrementLabel: string
  onArgumentChange: (args: TFilterArgumentChangeArgs) => void
  customFieldStyles?: StyleProp<TextStyle>
  customInputStyles?: StyleProp<TextStyle>
}
export const NumberFilterArgument = forwardRef<TNativeNumberInputRef, TNumberFilterArgumentProps>((props, ref) => {
  const labels = props.labels ?? DEFAULT_FILTER_EDITOR_LABELS
  const request = useFilterRequest(props, false)
  const style = splitNativeTextStyle(
    resolveNativeStyle<TextStyle>(
      [{ width: "100%" }, props.customInputStyles],
      "NumberFilterArgument",
      "customInputStyles",
    ),
  )
  return (
    <FormField label={labels.label} customStyles={props.customFieldStyles}>
      <NumberInput
        ref={ref}
        value={getControlledFilterNumberArgument(props.argument)}
        accessibilityLabel={labels.label}
        placeholder={labels.placeholder}
        incrementLabel={props.incrementLabel}
        decrementLabel={props.decrementLabel}
        customStyles={style.view}
        customInputStyles={style.text}
        onChange={request((current, value: number | null) =>
          current.onArgumentChange({ argument: value == null || Number.isNaN(value) ? null : value }),
        )}
      />
    </FormField>
  )
})
NumberFilterArgument.displayName = "NumberFilterArgument"
