"use client"

import { forwardRef } from "react"
import { NumberField as AdobeNumberField, Group } from "react-aria-components"

import Button from "../Button/Button"
import Input from "../Input/Input"

import { type TStepperProps, useCalibrateComponent } from "./helpers"
import { resolveStepperLabels } from "./labels"

const Stepper = forwardRef<HTMLInputElement, TStepperProps>((props, forwardedRef) => {
  const {
    errorState,
    warningState,
    successState,
    textSize,
    type,
    isDisabled,
    isReadOnly,
    colorMode,
    order,
    geometry = "round",
    color,
    orientation,
    height,
    width,
    enableFocusStyle,
    offsetFocusRing,
    MinusIcon: MinusIcon__props,
    PlusIcon: PlusIcon__props,
    customStyles: customStyles__props,
    customGroupStyles: customGroupStyles__props,
    customInputStyles: customInputStyles__props,
    customButtonStyles: customButtonStyles__props,
    className,
    style,
    labels,
    "data-testid": dataTestID,
    ...rest
  } = props
  const resolvedLabels = resolveStepperLabels(labels)
  const resolvedProps = { ...props, geometry, order }

  const {
    stepperStyles,
    stepperGroupStyles,
    computedButtonColorMode,
    computedButtonTransparencyStatus,
    computedButtonRaisedStatus,
    stepperStyle,
    customGroupStyles,
    customInputStyles,
    customButtonStyles,
    MinusIcon,
    PlusIcon,
  } = useCalibrateComponent(resolvedProps)

  return (
    <AdobeNumberField
      {...rest}
      isDisabled={isDisabled}
      isReadOnly={isReadOnly}
      ref={forwardedRef}
      className={stepperStyles}
      style={stepperStyle}
      data-testid={dataTestID ?? "stepper"}
    >
      <Group
        className={stepperGroupStyles}
        style={{ ...customGroupStyles }}
        aria-label={resolvedLabels.inputButtonGroupAriaLabel}
        data-testid="stepper-group"
      >
        <Button
          slot="decrement"
          customStyles={customButtonStyles}
          geometry={geometry}
          color={color}
          order={order}
          colorMode={computedButtonColorMode}
          transparent={computedButtonTransparencyStatus}
          raised={computedButtonRaisedStatus}
          enableFocusStyle={false}
        >
          {MinusIcon}
        </Button>
        <Input
          textSize={textSize}
          customStyles={customInputStyles}
          enableFocusStyle={false}
          data-testid="stepper-input"
        />
        <Button
          slot="increment"
          customStyles={customButtonStyles}
          geometry={geometry}
          color={color}
          order={order}
          colorMode={computedButtonColorMode}
          transparent={computedButtonTransparencyStatus}
          raised={computedButtonRaisedStatus}
          enableFocusStyle={false}
        >
          {PlusIcon}
        </Button>
      </Group>
    </AdobeNumberField>
  )
})

Stepper.displayName = "Stepper"

export default Stepper
