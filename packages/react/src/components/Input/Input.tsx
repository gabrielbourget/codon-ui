"use client"

import { forwardRef } from "react"
import { Input as AdobeInput } from "react-aria-components"

import { calibrateComponent, type TInputProps } from "./helpers"

const Input = forwardRef<HTMLInputElement, TInputProps>((props, forwardedRef) => {
  const {
    textSize,
    enableFocusStyle,
    offsetFocusRing,
    errorState,
    warningState,
    successState,
    height,
    width,
    geometry,
    isDisabled,
    className,
    style,
    customStyles: customStyles__props,
    "data-testid": dataTestID,
    ...rest
  } = props

  const { inputStyles, inputStyle } = calibrateComponent(props)

  return (
    <AdobeInput
      {...rest}
      disabled={isDisabled}
      ref={forwardedRef}
      data-testid={dataTestID ?? "input"}
      className={inputStyles}
      style={inputStyle}
    />
  )
})

Input.displayName = "Input"

export default Input
