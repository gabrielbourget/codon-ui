import { useMemo, type FC } from "react"

import { THEME_ORDER_CODE__PRIMARY } from "../../../../../tokens/theme-order"
import FormField from "../../../../FormField/FormField"
import ListBoxItem from "../../../../ListBoxItem/ListBoxItem"
import TagComboBox from "../../../../TagComboBox/TagComboBox"
import { DEFAULT_TABLE_FILTERING_LABELS } from "../../../labels"
import type { TFilterArgumentInputContext } from "../../helpers"

export type TMultiSelectTypeFilterArgumentProps = TFilterArgumentInputContext

const MultiSelectTypeFilterArgument: FC<TMultiSelectTypeFilterArgumentProps> = (props) => {
  const {
    argument,
    availableFilterArguments,
    customFieldClassName,
    customFieldStyles,
    customInputClassName,
    customInputStyles,
    labels,
    onArgumentChange,
  } = props
  const resolvedLabels = labels ?? DEFAULT_TABLE_FILTERING_LABELS.argumentInput

  const selectedItems = useMemo(() => {
    const selectedArgument = argument as string[]

    return (availableFilterArguments ?? []).filter((item) => selectedArgument.includes(item.name))
  }, [argument, availableFilterArguments])

  return (
    <FormField
      label={resolvedLabels.label}
      labelID="multi-select-type-filter-argument"
      customClassName={customFieldClassName}
      customStyles={customFieldStyles}
    >
      <TagComboBox
        aria-labelledby="multi-select-type-filter-argument"
        className={customInputClassName}
        items={availableFilterArguments ?? []}
        selectedItems={selectedItems}
        customStyles={{ width: "100%", ...customInputStyles }}
        order={THEME_ORDER_CODE__PRIMARY}
        labels={resolvedLabels.tagComboBox}
        getItemKey={(item) => item.id}
        getItemTextValue={(item) => item.name}
        onSelectedItemsChange={(nextSelectedItems) => {
          onArgumentChange({
            filterArgumentSelectedKey: nextSelectedItems.at(-1)?.id ?? null,
            argument: nextSelectedItems.map((item) => item.name),
          })
        }}
      >
        {(item) => <ListBoxItem id={item.id}>{item.name}</ListBoxItem>}
      </TagComboBox>
    </FormField>
  )
}

export default MultiSelectTypeFilterArgument
