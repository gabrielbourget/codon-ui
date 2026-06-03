"use client"

import { forwardRef, type ReactNode } from "react"
import { Radio as AdobeRadio, type RadioRenderProps } from "react-aria-components"

import { calibrateComponent, type TRadioProps } from "./helpers"

type TRadioChildrenRenderProps = RadioRenderProps & {
  defaultChildren: ReactNode | undefined
}

const Radio = forwardRef<HTMLLabelElement, TRadioProps>((props, forwardedRef) => {
  const {
    value,
    children,
    isDisabled,
    className,
    style,
    height,
    width,
    color,
    geometry,
    order,
    enableFocusStyle,
    offsetFocusRing,
    customStyles,
    customShapeStyles,
    "data-testid": dataTestID,
    ...rest
  } = props

  const { radioStyles, radioStyle, shapeStyles, shapeStyle } = calibrateComponent(props)

  return (
    <AdobeRadio
      {...rest}
      isDisabled={isDisabled}
      ref={forwardedRef}
      value={value}
      data-testid={dataTestID ?? "radio"}
      className={radioStyles}
      style={radioStyle}
    >
      {(radioRenderProps) => {
        const renderedChildren =
          typeof children === "function"
            ? children({ ...radioRenderProps, defaultChildren: undefined } as TRadioChildrenRenderProps)
            : children

        return (
          <>
            <div className={shapeStyles} style={shapeStyle} data-testid="radio-shape"></div>
            {renderedChildren}
          </>
        )
      }}
    </AdobeRadio>
  )
})

Radio.displayName = "Radio"

export default Radio
