"use client"

import { motion } from "motion/react"
import { type ForwardedRef, forwardRef } from "react"
import type { ListBoxRenderProps } from "react-aria-components"
import { ListBox, Popover, ComboBox as AdobeComboBox, Group } from "react-aria-components"

import Button from "../Button/Button"
import Input from "../Input/Input"
import PlaceholderText from "../Text/variants/PlaceholderText/PlaceholderText"

import styles from "./ComboBoxStyles.module.css"
import { type TComboBoxProps, calibrateComponent } from "./helpers"
import { resolveComboBoxLabels } from "./labels"

const { comboBox__emptyList } = styles

const ComboBox = forwardRef(
  <T extends object = object>(props: TComboBoxProps<T>, forwardedRef: ForwardedRef<HTMLDivElement>) => {
    const {
      "data-testid": dataTestID,
      className,
      color,
      ComponentIcon: ComponentIcon__props,
      children,
      customButtonStyles: customButtonStyles__props,
      customInputButtonGroupStyles: customInputButtonGroupStyles__props,
      customInputStyles: customInputStyles__props,
      customOptionsListStyles,
      customStyles: customStyles__props,
      emptyListMessage,
      enableFocusStyle,
      errorState,
      geometry,
      height,
      isDisabled,
      isOpen,
      items,
      labels,
      offsetFocusRing,
      onOpenChange,
      placement,
      shouldFocusWrap = true,
      style,
      successState,
      textSize,
      warningState,
      width,
      ...rest
    } = props
    const resolvedLabels = resolveComboBoxLabels({ labels, emptyListMessage })
    const resolvedIsOpen = isOpen

    const {
      comboBoxStyles,
      comboBoxStyle,
      inputButtonGroupStyles,
      optionsListStyles,
      popoverStyles,
      customInputButtonGroupStyles,
      customTriggerButtonStyles,
      customInputStyles,
      ComponentIcon,
    } = calibrateComponent(props)

    return (
      <AdobeComboBox
        {...rest}
        ref={forwardedRef}
        isDisabled={isDisabled}
        onOpenChange={onOpenChange}
        className={comboBoxStyles}
        style={comboBoxStyle}
        data-testid={dataTestID ?? "combo-box"}
      >
        {({ isOpen: isOpenRenderProps }) => (
          <>
            <Group
              className={inputButtonGroupStyles}
              style={{ ...customInputButtonGroupStyles }}
              aria-label={resolvedLabels.inputButtonGroupAriaLabel}
            >
              <Input textSize={textSize} customStyles={{ ...customInputStyles }} enableFocusStyle={false} />
              <Button
                aria-label={resolvedLabels.triggerButtonAriaLabel}
                aria-haspopup="listbox"
                geometry="rounded"
                raised={false}
                customStyles={{ ...customTriggerButtonStyles }}
              >
                <motion.div
                  animate={{ rotateX: isOpenRenderProps ? 180 : 0 }}
                  transition={{ ease: "easeInOut", duration: 0.4 }}
                  style={{ display: "grid", placeItems: "center" }}
                >
                  {ComponentIcon}
                </motion.div>
              </Button>
            </Group>
            <Popover
              className={popoverStyles}
              style={{ ...customOptionsListStyles }}
              offset={5}
              isOpen={resolvedIsOpen}
              placement={placement}
            >
              <ListBox
                shouldFocusWrap={shouldFocusWrap}
                items={items}
                className={optionsListStyles}
                style={{ ...customOptionsListStyles }}
                renderEmptyState={({ isEmpty }: ListBoxRenderProps) =>
                  isEmpty ? (
                    <div className={comboBox__emptyList}>
                      <PlaceholderText align="center">{resolvedLabels.emptyListMessage}</PlaceholderText>
                    </div>
                  ) : null
                }
              >
                {children}
              </ListBox>
            </Popover>
          </>
        )}
      </AdobeComboBox>
    )
  },
)

export default ComboBox
