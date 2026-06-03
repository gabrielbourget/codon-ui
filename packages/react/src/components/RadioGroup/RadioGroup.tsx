"use client"

import { forwardRef } from "react"
import { RadioGroup as AdobeRadioGroup } from "react-aria-components"

import { calibrateComponent, ORIENTATION__VERTICAL, type TRadioGroupProps } from "./helpers"

const RadioGroup = forwardRef<HTMLDivElement, TRadioGroupProps>((props, forwardedRef) => {
  const {
    "data-testid": dataTestID,
    children,
    className,
    customClassName,
    customStyles,
    isDisabled,
    isReadOnly,
    orientation = ORIENTATION__VERTICAL,
    style,
    ...rest
  } = props
  const { radioGroupStyles, radioGroupStyle } = calibrateComponent(props)

  return (
    <AdobeRadioGroup
      {...rest}
      isDisabled={isDisabled}
      isReadOnly={isReadOnly}
      orientation={orientation}
      ref={forwardedRef}
      data-testid={dataTestID ?? "radio-group"}
      className={radioGroupStyles}
      style={radioGroupStyle}
    >
      {children}
    </AdobeRadioGroup>
  )
})

RadioGroup.displayName = "RadioGroup"

export default RadioGroup
