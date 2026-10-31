import { forwardRef, useMemo } from "react"
import type { StyleProp, TextStyle } from "react-native"

import { resolveNativeStyle } from "../colors"
import { FormField } from "../FormField/FormField"
import { splitNativeTextStyle } from "../nativeTextStyle"
import { Select } from "../Select/Select"
import type { TNativeSelectRef } from "../Select/types"
import type { TAvailableListItem } from "../Table/filterMetadata"
import type { TTableFilterDraftArgumentValue } from "../Table/queryTypes"
import { TagComboBox } from "../TagComboBox/TagComboBox"
import type { TNativeTagComboBoxRef } from "../TagComboBox/types"

import { DEFAULT_FILTER_OPTION_LABELS, type TFilterOptionLabels } from "./labels"
import { useFilterRequest, type TFilterAvailability } from "./requests"

export type TFilterArgumentChangeArgs = {
  argument: TTableFilterDraftArgumentValue
  filterArgumentSelectedKey?: string | null
}
type TOptionArgumentProps = TFilterAvailability & {
  argument?: TTableFilterDraftArgumentValue
  availableFilterArguments?: TAvailableListItem[]
  filterArgumentSelectedKey?: string | null
  onArgumentChange: (args: TFilterArgumentChangeArgs) => void
  customFieldStyles?: StyleProp<TextStyle>
  customInputStyles?: StyleProp<TextStyle>
}
export type TSelectFilterArgumentProps = TOptionArgumentProps & {
  closeLabel: string
  labels?: Pick<TFilterOptionLabels, "selectLabel" | "selectPlaceholder">
}
export const SelectFilterArgument = forwardRef<TNativeSelectRef, TSelectFilterArgumentProps>((props, ref) => {
  const labels = props.labels ?? DEFAULT_FILTER_OPTION_LABELS
  const request = useFilterRequest(props)
  const styles = splitNativeTextStyle(
    resolveNativeStyle<TextStyle>(
      [{ width: "100%" }, props.customInputStyles],
      "SelectFilterArgument",
      "customInputStyles",
    ),
  )
  return (
    <FormField label={labels.selectLabel} customStyles={props.customFieldStyles}>
      <Select
        ref={ref}
        items={props.availableFilterArguments ?? []}
        getKey={(item) => item.id}
        getTextValue={(item) => item.name}
        value={props.filterArgumentSelectedKey}
        accessibilityLabel={labels.selectLabel}
        closeLabel={props.closeLabel}
        placeholder={labels.selectPlaceholder}
        customStyles={styles.view}
        customSelectedItemTextStyles={styles.text}
        onChange={request((current, key: string | number | null) => {
          const selected = current.availableFilterArguments?.find((item) => item.id === key)
          if (selected)
            current.onArgumentChange({
              argument: selected.argumentValue ?? selected.name,
              filterArgumentSelectedKey: selected.id,
            })
        })}
      />
    </FormField>
  )
})
SelectFilterArgument.displayName = "SelectFilterArgument"

export type TMultiSelectFilterArgumentProps = TOptionArgumentProps & {
  inputLabel: string
  closeLabel: string
  labels?: Pick<TFilterOptionLabels, "label" | "tagComboBox">
}
export const MultiSelectFilterArgument = forwardRef<TNativeTagComboBoxRef, TMultiSelectFilterArgumentProps>(
  (props, ref) => {
    const labels = props.labels ?? DEFAULT_FILTER_OPTION_LABELS
    const request = useFilterRequest(props)
    const selected = useMemo(
      () => (props.availableFilterArguments ?? []).filter((item) => (props.argument as string[]).includes(item.name)),
      [props.availableFilterArguments, props.argument],
    )
    return (
      <FormField label={labels.label} customStyles={props.customFieldStyles}>
        <TagComboBox
          ref={ref}
          items={props.availableFilterArguments ?? []}
          selectedItems={selected}
          getItemKey={(item) => item.id}
          getItemTextValue={(item) => item.name}
          order="primary"
          labels={labels.tagComboBox}
          inputLabel={props.inputLabel}
          closeLabel={props.closeLabel}
          customStyles={[{ width: "100%" }, props.customInputStyles]}
          onSelectedItemsChange={request((current, items: TAvailableListItem[]) =>
            current.onArgumentChange({
              argument: items.map((item) => item.name),
              filterArgumentSelectedKey: items.at(-1)?.id ?? null,
            }),
          )}
        />
      </FormField>
    )
  },
)
MultiSelectFilterArgument.displayName = "MultiSelectFilterArgument"
