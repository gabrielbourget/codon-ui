"use client"

import { forwardRef } from "react"
import { CheckboxGroup as AdobeCheckboxGroup } from "react-aria-components"

import { calibrateComponent, type TCheckboxGroupProps } from "./helpers"

const CheckboxGroup = forwardRef<HTMLDivElement, TCheckboxGroupProps>((props, forwardedRef) => {
  const {
    "data-testid": dataTestID,
    children,
    className,
    customClassName,
    customStyles,
    isDisabled,
    isReadOnly,
    orientation: _orientation,
    style,
    ...rest
  } = props
  const { checkboxGroupStyles, checkboxGroupStyle } = calibrateComponent(props)

  return (
    <AdobeCheckboxGroup
      {...rest}
      isDisabled={isDisabled}
      isReadOnly={isReadOnly}
      ref={forwardedRef}
      data-testid={dataTestID ?? "checkbox-group"}
      className={checkboxGroupStyles}
      style={checkboxGroupStyle}
    >
      {children}
    </AdobeCheckboxGroup>
  )
})

CheckboxGroup.displayName = "CheckboxGroup"

export default CheckboxGroup
