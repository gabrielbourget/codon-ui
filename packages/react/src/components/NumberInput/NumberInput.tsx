"use client"

import { forwardRef } from "react"
import { NumberField as AdobeNumberField, Group } from "react-aria-components"

import Button from "../Button/Button"
import Input from "../Input/Input"

import { type TNumberInputProps, calibrateComponent } from "./helpers"
import { resolveNumberInputLabels } from "./labels"

const NumberInput = forwardRef<HTMLInputElement, TNumberInputProps>((props, forwardedRef) => {
  const {
    errorState,
    warningState,
    successState,
    geometry,
    textSize,
    customGroupStyles,
    isDisabled,
    isReadOnly,
    placeholder,
    height,
    width,
    enableFocusStyle,
    offsetFocusRing,
    IncrementIcon: IncrementIcon__props,
    DecrementIcon: DecrementIcon__props,
    customStyles: customStyles__props,
    customInputStyles: customInputStyles__props,
    customButtonStyles: customButtonStyles__props,
    className,
    style,
    labels,
    "data-testid": dataTestID,
    ...rest
  } = props
  const resolvedLabels = resolveNumberInputLabels(labels)

  const {
    numberInputStyles,
    numberInputGroupStyles,
    buttonColumnStyles,
    numberInputStyle,
    customInputStyles,
    customButtonStyles,
    IncrementIcon,
    DecrementIcon,
  } = calibrateComponent(props)

  return (
    <AdobeNumberField
      {...rest}
      isDisabled={isDisabled}
      isReadOnly={isReadOnly}
      ref={forwardedRef}
      className={numberInputStyles}
      style={numberInputStyle}
      data-testid={dataTestID ?? "number-input"}
    >
      <Group
        className={numberInputGroupStyles}
        style={customGroupStyles}
        aria-label={resolvedLabels.inputButtonGroupAriaLabel}
      >
        <Input
          enableFocusStyle={false}
          textSize={textSize}
          geometry={geometry}
          placeholder={placeholder}
          customStyles={customInputStyles}
          data-testid="number-input-input"
        />
        <div className={buttonColumnStyles}>
          <Button slot="increment" customStyles={customButtonStyles} raised={false} enableFocusStyle={false}>
            {IncrementIcon}
          </Button>
          <Button slot="decrement" customStyles={customButtonStyles} raised={false} enableFocusStyle={false}>
            {DecrementIcon}
          </Button>
        </div>
      </Group>
    </AdobeNumberField>
  )
})

NumberInput.displayName = "NumberInput"

export default NumberInput
