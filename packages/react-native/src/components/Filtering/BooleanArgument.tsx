import { forwardRef } from "react"
import { View, type StyleProp, type TextStyle, type ViewStyle } from "react-native"

import { useNativeTheme } from "../../theme"
import { Checkbox } from "../Checkbox/Checkbox"
import type { TNativeCheckboxRef } from "../Checkbox/types"
import { FormField } from "../FormField/FormField"
import { Switch } from "../Switch/Switch"
import type { TAvailableBooleanArgumentComponents } from "../Table/filterMetadata"
import type { TTableFilterDraftArgumentValue } from "../Table/queryTypes"

import { DEFAULT_FILTER_EDITOR_LABELS } from "./editorLabels"
import type { TFilterArgumentChangeArgs } from "./OptionArguments"
import { useFilterRequest, type TFilterAvailability } from "./requests"

export type TBooleanFilterArgumentProps = TFilterAvailability & {
  argument?: TTableFilterDraftArgumentValue
  booleanArgumentComponent?: TAvailableBooleanArgumentComponents
  labels?: { booleanLabel: string }
  onArgumentChange: (args: TFilterArgumentChangeArgs) => void
  customFieldStyles?: StyleProp<TextStyle>
  customInputStyles?: StyleProp<ViewStyle>
  customRowStyles?: StyleProp<ViewStyle>
}
export const BooleanFilterArgument = forwardRef<TNativeCheckboxRef, TBooleanFilterArgumentProps>((props, ref) => {
  const labels = props.labels ?? DEFAULT_FILTER_EDITOR_LABELS
  const request = useFilterRequest(props, false)
  const theme = useNativeTheme()
  const isSelected = (props.argument ?? false) as boolean
  const onChange = request((current, argument: boolean) => current.onArgumentChange({ argument }))
  if (props.booleanArgumentComponent !== "Checkbox" && props.booleanArgumentComponent !== "Toggle") return null
  return (
    <View
      testID="filter-boolean"
      style={[{ flexDirection: "row", alignItems: "center", gap: theme.spacing.unit * 2 }, props.customRowStyles]}
    >
      <FormField
        label={labels.booleanLabel}
        customStyles={
          props.booleanArgumentComponent === "Toggle"
            ? [{ flexDirection: "row", alignItems: "center", gap: 5 }, props.customFieldStyles]
            : props.customFieldStyles
        }
      >
        {props.booleanArgumentComponent === "Checkbox" ? (
          <Checkbox
            ref={ref}
            accessibilityLabel={labels.booleanLabel}
            geometry="rounded"
            isSelected={isSelected}
            customStyles={props.customInputStyles}
            onChange={onChange}
          />
        ) : (
          <Switch
            ref={ref}
            accessibilityLabel={labels.booleanLabel}
            order="primary"
            geometry="round"
            isSelected={isSelected}
            customStyles={[{ padding: 5 }, props.customInputStyles]}
            onChange={onChange}
          />
        )}
      </FormField>
    </View>
  )
})
BooleanFilterArgument.displayName = "BooleanFilterArgument"
