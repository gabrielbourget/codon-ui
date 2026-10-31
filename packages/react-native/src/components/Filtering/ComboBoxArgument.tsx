import { forwardRef } from "react"
import type { StyleProp, TextStyle } from "react-native"

import { resolveNativeStyle } from "../colors"
import { ComboBox } from "../ComboBox/ComboBox"
import type { TNativeComboBoxRef } from "../ComboBox/types"
import { FormField } from "../FormField/FormField"
import { splitNativeTextStyle } from "../nativeTextStyle"
import type { TAvailableListItem } from "../Table/filterMetadata"
import type { TTableFilterDraftArgumentValue } from "../Table/queryTypes"

import { DEFAULT_FILTER_EDITOR_LABELS } from "./editorLabels"
import type { TFilterArgumentChangeArgs } from "./OptionArguments"
import { useFilterRequest, type TFilterAvailability } from "./requests"

export type TComboBoxFilterArgumentProps = TFilterAvailability & {
  argument?: TTableFilterDraftArgumentValue
  availableFilterArguments?: TAvailableListItem[]
  filterArgumentSelectedKey?: string | null
  inputLabel: string
  closeLabel: string
  labels?: { label: string; triggerButtonAriaLabel: string; emptyListMessage: string }
  onArgumentChange: (args: TFilterArgumentChangeArgs) => void
  customFieldStyles?: StyleProp<TextStyle>
  customInputStyles?: StyleProp<TextStyle>
}
export const ComboBoxFilterArgument = forwardRef<TNativeComboBoxRef, TComboBoxFilterArgumentProps>((props, ref) => {
  const labels = props.labels ?? {
    label: DEFAULT_FILTER_EDITOR_LABELS.label,
    triggerButtonAriaLabel: "Show filter argument suggestions",
    emptyListMessage: "No filter arguments remaining to select",
  }
  const request = useFilterRequest(props)
  const styles = splitNativeTextStyle(
    resolveNativeStyle<TextStyle>(
      [{ width: "100%" }, props.customInputStyles],
      "ComboBoxFilterArgument",
      "customInputStyles",
    ),
  )
  return (
    <FormField label={labels.label} customStyles={props.customFieldStyles}>
      <ComboBox
        ref={ref}
        items={props.availableFilterArguments ?? []}
        getKey={(item) => item.id}
        getTextValue={(item) => item.name}
        value={props.filterArgumentSelectedKey}
        inputValue={(props.argument ?? "") as string}
        accessibilityLabel={labels.triggerButtonAriaLabel}
        inputLabel={props.inputLabel}
        closeLabel={props.closeLabel}
        emptyListMessage={labels.emptyListMessage}
        customStyles={[styles.view, { color: styles.text.color }]}
        customInputStyles={styles.text}
        onInputChange={request((current, argument: string) => current.onArgumentChange({ argument }))}
        onChange={request((current, key: string | number | null) => {
          const selected = current.availableFilterArguments?.find((item) => item.id === key)
          if (selected) current.onArgumentChange({ argument: selected.name, filterArgumentSelectedKey: selected.id })
        })}
      />
    </FormField>
  )
})
ComboBoxFilterArgument.displayName = "ComboBoxFilterArgument"
