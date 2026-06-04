"use client"

import type { ReactElement, ReactNode, RefAttributes } from "react"
import { type ForwardedRef, forwardRef, useMemo, useState } from "react"
import type { Key } from "react-aria-components"
import { Group } from "react-aria-components"

import ComboBox from "../ComboBox/ComboBox"
import Tag from "../TagGroup/AdobeTag/AdobeTag"
import TagGroup from "../TagGroup/TagGroup"
import Text from "../Text/Text"

import { calibrateComponent, SELECTION_MODE__NONE, type TTagComboBoxProps } from "./helpers"
import { resolveTagComboBoxLabels } from "./labels"

const keyToString = (key: Key) => String(key)

const TagComboBox = forwardRef(
  <T extends object = object>(props: TTagComboBoxProps<T>, forwardedRef: ForwardedRef<HTMLDivElement>) => {
    const {
      "data-testid": dataTestID,
      className,
      children,
      color,
      customComboBoxProps,
      customComboBoxStyles,
      customStyles: customStyles__props,
      customTagGroupProps,
      customTagGroupStyles,
      customTagProps,
      customTagStyles,
      defaultInputValue,
      enableFocusStyle,
      errorState,
      geometry,
      getItemKey,
      getItemTextValue,
      height,
      inputValue,
      isDisabled,
      isOpen,
      items,
      labels,
      maxWidth = 280,
      minWidth,
      offsetFocusRing,
      onInputChange,
      onSelectedItemsChange,
      order,
      placement,
      renderTagContent,
      selectedItems,
      shouldFocusWrap,
      style,
      successState,
      textSize,
      warningState,
      width,
      ...comboBoxProps
    } = props

    const [internalInputValue, setInternalInputValue] = useState(defaultInputValue ?? "")

    const {
      customStyles: customComboBoxCustomStyles,
      customInputButtonGroupStyles: customComboBoxInputButtonGroupStyles,
      labels: customComboBoxLabels,
      onInputChange: customComboBoxOnInputChange,
      ...restCustomComboBoxProps
    } = customComboBoxProps ?? {}

    const { customStyles: customTagGroupPropsStyles, ...restCustomTagGroupProps } = customTagGroupProps ?? {}

    const { customStyles: customTagPropsStyles, ...restCustomTagProps } = customTagProps ?? {}
    const resolvedLabels = resolveTagComboBoxLabels({
      ...(labels ?? {}),
      comboBox: {
        ...labels?.comboBox,
        ...customComboBoxLabels,
      },
    })

    const resolvedInputValue = inputValue !== undefined ? inputValue : internalInputValue
    const { tagComboBoxStyles, computedTextSizeVariant, tagComboBoxStyle } = calibrateComponent({
      ...props,
      customStyles: customStyles__props,
      height,
      maxWidth,
      minWidth,
      width,
    })

    const renderComboBoxItems =
      typeof children === "function" ? (item: object) => (children as (item: T) => ReactNode)(item as T) : children

    const allItems = useMemo(() => Array.from(items ?? []), [items])
    const selectedKeySet = useMemo(
      () => new Set(selectedItems.map((item) => keyToString(getItemKey(item)))),
      [getItemKey, selectedItems],
    )
    const availableItems = useMemo(
      () => allItems.filter((item) => !selectedKeySet.has(keyToString(getItemKey(item)))),
      [allItems, getItemKey, selectedKeySet],
    )
    const resolvedIsDisabled = isDisabled
    const resolvedIsOpen = isOpen

    const handleInputChange = (value: string) => {
      if (inputValue === undefined) setInternalInputValue(value)
      onInputChange?.(value)
      customComboBoxOnInputChange?.(value)
    }

    const clearInputValue = () => {
      handleInputChange("")
    }

    const handleSelectionChange = (key: Key | null) => {
      if (key === null) return

      const keyAsString = keyToString(key)
      const selectedItem = allItems.find((item) => keyToString(getItemKey(item)) === keyAsString)

      if (!selectedItem || selectedKeySet.has(keyAsString)) return

      const nextSelectedItems = [...selectedItems, selectedItem]
      onSelectedItemsChange(nextSelectedItems, {
        action: "add",
        changedItems: [selectedItem],
        changedKeys: [getItemKey(selectedItem)],
      })
      clearInputValue()
    }

    const handleRemove = (keys: Set<Key>) => {
      const keysToRemove = new Set(Array.from(keys).map((key) => keyToString(key)))
      const removedItems = selectedItems.filter((item) => keysToRemove.has(keyToString(getItemKey(item))))

      if (removedItems.length === 0) return

      const nextSelectedItems = selectedItems.filter((item) => !keysToRemove.has(keyToString(getItemKey(item))))

      onSelectedItemsChange(nextSelectedItems, {
        action: "remove",
        changedItems: removedItems,
        changedKeys: removedItems.map((item) => getItemKey(item)),
      })
    }

    return (
      <Group
        ref={forwardedRef}
        aria-disabled={resolvedIsDisabled || undefined}
        data-testid={dataTestID ?? "tag-combobox"}
        aria-label={resolvedLabels.groupAriaLabel}
        className={tagComboBoxStyles}
        style={tagComboBoxStyle}
      >
        <TagGroup
          aria-label={resolvedLabels.tagGroupAriaLabel}
          items={selectedItems}
          onRemove={handleRemove}
          selectionMode={SELECTION_MODE__NONE}
          customStyles={Object.assign({}, customTagGroupStyles, customTagGroupPropsStyles)}
          {...restCustomTagGroupProps}
        >
          {(item: object) => {
            const parsedItem = item as T
            const itemKey = getItemKey(parsedItem)

            return (
              <Tag
                id={itemKey}
                key={keyToString(itemKey)}
                color={color}
                geometry={geometry}
                order={order}
                raised
                textValue={getItemTextValue(parsedItem)}
                customStyles={Object.assign({}, customTagStyles, customTagPropsStyles)}
                {...restCustomTagProps}
              >
                {renderTagContent?.(parsedItem) ?? (
                  <Text elementType="span" variant={computedTextSizeVariant}>
                    {getItemTextValue(parsedItem)}
                  </Text>
                )}
              </Tag>
            )
          }}
        </TagGroup>

        <ComboBox
          {...restCustomComboBoxProps}
          {...comboBoxProps}
          value={null}
          onChange={handleSelectionChange}
          onInputChange={handleInputChange}
          inputValue={resolvedInputValue}
          items={availableItems}
          color={color}
          isDisabled={resolvedIsDisabled}
          enableFocusStyle={false}
          errorState={errorState}
          geometry={geometry}
          isOpen={resolvedIsOpen}
          placement={placement}
          shouldFocusWrap={shouldFocusWrap}
          successState={successState}
          labels={resolvedLabels.comboBox}
          textSize={textSize}
          warningState={warningState}
          width="100%"
          customStyles={Object.assign({ height: "100%" }, customComboBoxCustomStyles, customComboBoxStyles)}
          customInputButtonGroupStyles={Object.assign({}, customComboBoxInputButtonGroupStyles, { border: "none" })}
        >
          {renderComboBoxItems}
        </ComboBox>
      </Group>
    )
  },
)

export type TTagComboBoxComponent = <T extends object = object>(
  props: TTagComboBoxProps<T> & RefAttributes<HTMLDivElement>,
) => ReactElement | null

export default TagComboBox as unknown as TTagComboBoxComponent
