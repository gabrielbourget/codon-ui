import { type FC } from "react"

import ComboBox from "../../../../ComboBox/ComboBox"
import FormField from "../../../../FormField/FormField"
import ListBoxItem from "../../../../ListBoxItem/ListBoxItem"
import type { TAvailableListItem } from "../../../../Table/filterMetadata"
import { DEFAULT_TABLE_FILTERING_LABELS } from "../../../labels"
import type { TFilterArgumentInputContext } from "../../helpers"

export type TComboBoxTypeFilterArgumentProps = TFilterArgumentInputContext

const ComboBoxTypeFilterArgument: FC<TComboBoxTypeFilterArgumentProps> = (props) => {
  const {
    argument,
    availableFilterArguments,
    customFieldClassName,
    customFieldStyles,
    customInputClassName,
    customInputStyles,
    filterArgumentSelectedKey,
    labels,
    onArgumentChange,
  } = props
  const resolvedLabels = labels ?? DEFAULT_TABLE_FILTERING_LABELS.argumentInput

  return (
    <FormField
      label={resolvedLabels.label}
      labelID="select-type-filter-argument"
      customClassName={customFieldClassName}
      customStyles={customFieldStyles}
    >
      <ComboBox
        aria-labelledby="select-type-filter-argument"
        className={customInputClassName}
        items={availableFilterArguments}
        inputValue={argument as string}
        // placeholder="Select Filter Argument"
        customStyles={{ width: "100%", ...customInputStyles }}
        value={filterArgumentSelectedKey}
        labels={resolvedLabels.comboBox}
        allowsEmptyCollection
        onChange={(id) => {
          const selectedFilterArgument = availableFilterArguments!.find((item) => item.id === id)
          onArgumentChange({
            argument: selectedFilterArgument!.name,
            filterArgumentSelectedKey: selectedFilterArgument!.id,
          })
        }}
        onInputChange={(value) => {
          onArgumentChange({ argument: value })
        }}
      >
        {(item: object) => {
          const processedItem = item as unknown as TAvailableListItem

          return <ListBoxItem id={processedItem.id}>{processedItem.name}</ListBoxItem>
        }}
      </ComboBox>
    </FormField>
  )
}

export default ComboBoxTypeFilterArgument
