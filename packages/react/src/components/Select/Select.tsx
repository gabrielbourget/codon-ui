"use client"

import { motion } from "motion/react"
import type { RefAttributes } from "react"
import { type ForwardedRef, forwardRef } from "react"
import type { ListBoxRenderProps } from "react-aria-components"
import { ListBox, Popover, Select as AdobeSelect, SelectValue } from "react-aria-components"

import Button from "../Button/Button"
import PlaceholderText from "../Text/variants/PlaceholderText/PlaceholderText"

import { type TSelectProps, calibrateComponent } from "./helpers"
import styles from "./SelectStyles.module.css"

const { select__emptyList } = styles

const Select = forwardRef(function SelectInner<T extends object = object>(
  props: TSelectProps<T>,
  forwardedRef: ForwardedRef<HTMLDivElement>,
) {
  const {
    "data-testid": dataTestID,
    className,
    ComponentIcon: ComponentIcon__props,
    customClassName,
    customOptionsListStyles,
    customSelectedItemStyles: customSelectedItemStyles__props,
    customSelectedItemTextStyles,
    customStyles: customStyles__props,
    emptyListMessage = "No items remaining to select",
    errorState,
    geometry,
    items,
    height,
    children: renderItem,
    isDisabled,
    isOpen,
    placement,
    placeholder = undefined,
    shouldFocusWrap = true,
    style,
    successState,
    textSize,
    warningState,
    width,
    ...rest
  } = props

  const {
    selectStyles,
    selectedItemTextStyles,
    popoverStyles,
    optionsListStyles,
    customSelectedItemStyles,
    selectStyle,
    ComponentIcon,
  } = calibrateComponent(props)

  return (
    <AdobeSelect
      {...rest}
      ref={forwardedRef}
      isDisabled={isDisabled}
      isOpen={isOpen}
      placeholder={placeholder}
      className={selectStyles}
      style={selectStyle}
      data-testid={dataTestID ?? "select"}
    >
      {({ isOpen: isOpenRenderProps }) => (
        <>
          <Button
            geometry={geometry}
            raised={false}
            customStyles={customSelectedItemStyles}
            offsetFocusRing={true}
            data-triggerbtn
            aria-haspopup="listbox"
            aria-label={typeof rest["aria-label"] === "string" ? rest["aria-label"] : undefined}
            aria-labelledby={typeof rest["aria-labelledby"] === "string" ? rest["aria-labelledby"] : undefined}
          >
            <SelectValue
              data-testid="select-value"
              className={selectedItemTextStyles}
              style={customSelectedItemTextStyles}
            />
            <motion.div
              animate={{ rotateX: isOpenRenderProps ? 180 : 0 }}
              transition={{ ease: "easeInOut", duration: 0.4 }}
              style={{ display: "grid", placeItems: "center" }}
            >
              {ComponentIcon}
            </motion.div>
          </Button>
          <Popover className={popoverStyles} style={customOptionsListStyles} offset={5} placement={placement}>
            <ListBox
              items={items}
              shouldFocusWrap={shouldFocusWrap}
              className={optionsListStyles}
              style={customOptionsListStyles}
              renderEmptyState={({ isEmpty }: ListBoxRenderProps) =>
                isEmpty ? (
                  <div className={select__emptyList}>
                    <PlaceholderText align="center">{emptyListMessage}</PlaceholderText>
                  </div>
                ) : null
              }
            >
              {renderItem}
            </ListBox>
          </Popover>
        </>
      )}
    </AdobeSelect>
  )
})

export type TSelectComponent = <T extends object = object>(
  props: TSelectProps<T> & RefAttributes<HTMLDivElement>,
) => React.ReactElement | null

export default Select as unknown as TSelectComponent
