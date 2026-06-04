import classNames from "classnames"
import type { FC } from "react"

import type { TCornerGeometry } from "../../../../tokens/geometry"
import FormField from "../../../FormField/FormField"
import type { TFormFieldProps } from "../../../FormField/helpers"
import ListBoxItem from "../../../ListBoxItem/ListBoxItem"
import type { TSelectProps } from "../../../Select/helpers"
import Select from "../../../Select/Select"
import {
  DEFAULT_PAGINATION_LABELS,
  PAGINATION_SUBCOMPONENT__ITEMS_PER_PAGE,
  type TPaginationItemsPerPageLabels,
} from "../../helpers"

type TItemsPerPageOption = {
  id: string
  name: string
}

export type TItemsPerPageProps = {
  itemsPerPageOptionsList: TItemsPerPageOption[]
  disabled?: boolean
  geometry?: TCornerGeometry
  itemsPerPage: string | number
  itemsPerPageLabel?: string
  itemsPerPageSelectPlaceholder?: string
  labels?: TPaginationItemsPerPageLabels
  onItemsPerPageSelectionChange: (value: string | number) => void
  customItemsPerPageFormFieldClassName?: string
  customItemsPerPageFormFieldStyles?: React.CSSProperties
  customItemsPerPageFormFieldProps?: Partial<TFormFieldProps>
  customItemsPerPageSelectClassName?: string
  customItemsPerPageSelectStyles?: React.CSSProperties
  customItemsPerPageSelectProps?: Partial<TSelectProps<{ id: string; name: string }>>
}

const ItemsPerPage: FC<TItemsPerPageProps> = (props) => {
  const {
    disabled,
    itemsPerPageOptionsList,
    itemsPerPage,
    itemsPerPageLabel,
    itemsPerPageSelectPlaceholder,
    labels,
    onItemsPerPageSelectionChange,
    geometry,
    customItemsPerPageFormFieldClassName,
    customItemsPerPageFormFieldStyles,
    customItemsPerPageFormFieldProps = {},
    customItemsPerPageSelectClassName,
    customItemsPerPageSelectStyles = {},
    customItemsPerPageSelectProps = {},
  } = props
  const {
    customClassName: customItemsPerPageFormFieldPropsClassName,
    customStyles: customItemsPerPageFormFieldPropsStyles,
    ...restCustomItemsPerPageFormFieldProps
  } = customItemsPerPageFormFieldProps
  const {
    customClassName: customItemsPerPageSelectPropsClassName,
    customStyles: customItemsPerPageSelectPropsStyles,
    ...restCustomItemsPerPageSelectProps
  } = customItemsPerPageSelectProps
  const resolvedLabels = {
    ...DEFAULT_PAGINATION_LABELS.itemsPerPage,
    label: itemsPerPageLabel ?? DEFAULT_PAGINATION_LABELS.itemsPerPage.label,
    placeholder: itemsPerPageSelectPlaceholder ?? DEFAULT_PAGINATION_LABELS.itemsPerPage.placeholder,
    ...labels,
  }

  return (
    <div data-testid={PAGINATION_SUBCOMPONENT__ITEMS_PER_PAGE}>
      <FormField
        {...restCustomItemsPerPageFormFieldProps}
        label={resolvedLabels.label}
        labelID="items-per-page-label-id"
        customClassName={classNames(customItemsPerPageFormFieldPropsClassName, customItemsPerPageFormFieldClassName)}
        customStyles={{ ...customItemsPerPageFormFieldPropsStyles, ...customItemsPerPageFormFieldStyles }}
      >
        <Select
          {...restCustomItemsPerPageSelectProps}
          value={String(itemsPerPage)}
          onChange={(ID: string | number | null) => {
            if (ID === null) return

            onItemsPerPageSelectionChange(String(ID))
          }}
          placeholder={resolvedLabels.placeholder}
          placement="bottom right"
          items={itemsPerPageOptionsList}
          width={82}
          height={30}
          isDisabled={disabled}
          geometry={geometry}
          aria-labelledby="items-per-page-label-id"
          customClassName={classNames(customItemsPerPageSelectPropsClassName, customItemsPerPageSelectClassName)}
          customStyles={{ ...customItemsPerPageSelectPropsStyles, ...customItemsPerPageSelectStyles }}
        >
          {(item: TItemsPerPageOption) => <ListBoxItem id={item.id}>{item.name}</ListBoxItem>}
        </Select>
      </FormField>
    </div>
  )
}

export default ItemsPerPage
