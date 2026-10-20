import { View, type StyleProp, type TextStyle, type ViewStyle } from "react-native"
import Svg, { Path } from "react-native-svg"

import { useNativeTheme } from "../../theme"
import { Button } from "../Button/Button"
import { FormField } from "../FormField/FormField"
import { Input } from "../Input/Input"
import type { TTableFilterDraftArgumentValue } from "../Table/queryTypes"

import { getFilterArrayArgument } from "./argumentValues"
import { DEFAULT_FILTER_EDITOR_LABELS, type TFilterEditorLabels } from "./editorLabels"
import { FilterDeleteGlyph } from "./FilterDeleteGlyph"
import type { TFilterArgumentChangeArgs } from "./OptionArguments"
import { useFilterRequest, type TFilterAvailability } from "./requests"

export type TListFilterArgumentProps = TFilterAvailability & {
  argument?: TTableFilterDraftArgumentValue
  labels?: Pick<
    TFilterEditorLabels,
    | "label"
    | "addMultiInputItemButtonAriaLabel"
    | "deleteMultiInputItemButtonAriaLabel"
    | "multiInputItemAriaLabel"
    | "multiInputItemPlaceholder"
  >
  onArgumentChange: (args: TFilterArgumentChangeArgs) => void
  customFieldStyles?: StyleProp<TextStyle>
  customInputStyles?: StyleProp<TextStyle>
  customRowStyles?: StyleProp<ViewStyle>
  customActionButtonStyles?: StyleProp<TextStyle>
}
export const ListFilterArgument = (props: TListFilterArgumentProps) => {
  const labels = props.labels ?? DEFAULT_FILTER_EDITOR_LABELS
  const theme = useNativeTheme()
  const request = useFilterRequest(props, false)
  const argument = getFilterArrayArgument(props.argument)
  return (
    <FormField
      label={labels.label}
      customStyles={props.customFieldStyles}
      topRightContent={
        <Button
          accessibilityLabel={labels.addMultiInputItemButtonAriaLabel}
          geometry="round"
          order="primary"
          raised={false}
          customStyles={[{ padding: 3 }, props.customActionButtonStyles]}
          onPress={request((current) =>
            current.onArgumentChange({ argument: [...getFilterArrayArgument(current.argument), ""] }),
          )}
        >
          <Svg
            width={15}
            height={15}
            viewBox="0 0 24 24"
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6z" fill={theme.colors.controlForeground} />
          </Svg>
        </Button>
      }
    >
      {argument.map((item, index) => (
        <View
          key={index}
          style={[{ flexDirection: "row", alignItems: "center", gap: theme.spacing.unit }, props.customRowStyles]}
        >
          <Input
            accessibilityLabel={labels.multiInputItemAriaLabel({ index })}
            value={item == null ? "" : String(item)}
            placeholder={labels.multiInputItemPlaceholder({ position: index + 1 })}
            customStyles={[{ width: "100%" }, props.customInputStyles]}
            onChangeText={request((current, value: string) => {
              const previous = getFilterArrayArgument(current.argument)
              if (index >= previous.length) return
              current.onArgumentChange({ argument: [...previous.slice(0, index), value, ...previous.slice(index + 1)] })
            })}
          />
          <Button
            accessibilityLabel={labels.deleteMultiInputItemButtonAriaLabel}
            geometry="round"
            order="primary"
            raised={false}
            transparent
            isDisabled={index === 0}
            customStyles={[{ paddingRight: 0 }, props.customActionButtonStyles]}
            onPress={request((current) => {
              const previous = getFilterArrayArgument(current.argument)
              if (index === 0 || index >= previous.length) return
              current.onArgumentChange({ argument: [...previous.slice(0, index), ...previous.slice(index + 1)] })
            })}
          >
            <FilterDeleteGlyph color={theme.colors.controlForeground} />
          </Button>
        </View>
      ))}
    </FormField>
  )
}
