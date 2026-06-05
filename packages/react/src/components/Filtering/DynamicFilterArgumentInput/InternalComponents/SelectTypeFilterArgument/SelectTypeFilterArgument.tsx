import type { FC } from "react"

import FormField from "../../../../FormField/FormField"
import ListBoxItem from "../../../../ListBoxItem/ListBoxItem"
import Select from "../../../../Select/Select"
import type { TAvailableListItem } from "../../../../Table/filterMetadata"
import { DEFAULT_TABLE_FILTERING_LABELS } from "../../../labels"
import type { TFilterArgumentInputContext } from "../../helpers"

export type TSelectTypeFilterArgumentProps = TFilterArgumentInputContext

const SelectTypeFilterArgument: FC<TSelectTypeFilterArgumentProps> = (props) => {
  const {
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
      label={resolvedLabels.selectLabel}
      labelID="select-type-filter-argument"
      customClassName={customFieldClassName}
      customStyles={customFieldStyles}
    >
      <Select
        aria-labelledby="select-type-filter-argument"
        className={customInputClassName}
        items={availableFilterArguments}
        placeholder={resolvedLabels.selectPlaceholder}
        customStyles={{ width: "100%", ...customInputStyles }}
        value={filterArgumentSelectedKey}
        onChange={(id) => {
          const selectedFilterArgument = availableFilterArguments!.find((item) => item.id === id)
          onArgumentChange({
            argument: selectedFilterArgument!.argumentValue ?? selectedFilterArgument!.name,
            filterArgumentSelectedKey: selectedFilterArgument!.id,
          })
        }}
      >
        {(item: object) => {
          const processedItem = item as unknown as TAvailableListItem

          return <ListBoxItem id={processedItem.id}>{processedItem.name}</ListBoxItem>
        }}
      </Select>
    </FormField>
  )
}

export default SelectTypeFilterArgument
