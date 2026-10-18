import { View, type StyleProp, type TextStyle, type ViewStyle } from "react-native"

import { useNativeTheme } from "../../theme"
import { resolveNativeStyle } from "../colors"
import { FormField } from "../FormField/FormField"
import { Input } from "../Input/Input"
import { splitNativeTextStyle } from "../nativeTextStyle"
import { NumberInput } from "../NumberInput/NumberInput"
import type { TTableFilterDraftArgumentValue } from "../Table/queryTypes"

import { getFilterArrayArgument } from "./argumentValues"
import { DEFAULT_FILTER_EDITOR_LABELS, type TFilterEditorLabels } from "./editorLabels"
import type { TFilterArgumentChangeArgs } from "./OptionArguments"
import { useFilterRequest, type TFilterAvailability } from "./requests"

export type TRangeFilterArgumentProps = TFilterAvailability & {
  dataType: "text" | "number"
  argument?: TTableFilterDraftArgumentValue
  labels?: Pick<TFilterEditorLabels, "minValueLabel" | "minValuePlaceholder" | "maxValueLabel" | "maxValuePlaceholder">
  numberLabels: {
    minimumIncrement: string
    minimumDecrement: string
    maximumIncrement: string
    maximumDecrement: string
  }
  onArgumentChange: (args: TFilterArgumentChangeArgs) => void
  customFieldStyles?: StyleProp<TextStyle>
  customInputStyles?: StyleProp<TextStyle>
  customRowStyles?: StyleProp<ViewStyle>
}
export const RangeFilterArgument = (props: TRangeFilterArgumentProps) => {
  const labels = props.labels ?? DEFAULT_FILTER_EDITOR_LABELS
  const theme = useNativeTheme()
  const request = useFilterRequest(props, false)
  const argument = getFilterArrayArgument(props.argument)
  const style = resolveNativeStyle<TextStyle>(
    [{ flex: 1 }, props.customInputStyles],
    "RangeFilterArgument",
    "customInputStyles",
  )
  const split = splitNativeTextStyle(style)
  return (
    <View
      testID="filter-range"
      style={[{ flexDirection: "row", alignItems: "center", gap: theme.spacing.unit }, props.customRowStyles]}
    >
      {([0, 1] as const).map((index) => {
        const label = index === 0 ? labels.minValueLabel : labels.maxValueLabel
        const placeholder = index === 0 ? labels.minValuePlaceholder : labels.maxValuePlaceholder
        const change = request((current, value: string | number | null) => {
          const previous = getFilterArrayArgument(current.argument)
          current.onArgumentChange({ argument: index === 0 ? [value, previous[1]] : [previous[0], value] })
        })
        return (
          <FormField key={index} label={label} customStyles={props.customFieldStyles}>
            {props.dataType === "text" ? (
              <Input
                accessibilityLabel={label}
                value={argument[index] == null ? "" : String(argument[index])}
                placeholder={placeholder}
                customStyles={style}
                onChangeText={change}
              />
            ) : (
              <NumberInput
                accessibilityLabel={label}
                value={(argument[index] ?? null) as number | null}
                placeholder={placeholder}
                incrementLabel={index === 0 ? props.numberLabels.minimumIncrement : props.numberLabels.maximumIncrement}
                decrementLabel={index === 0 ? props.numberLabels.minimumDecrement : props.numberLabels.maximumDecrement}
                customStyles={split.view}
                customInputStyles={split.text}
                onChange={(value) => change(value == null || Number.isNaN(value) ? null : value)}
              />
            )}
          </FormField>
        )
      })}
    </View>
  )
}
