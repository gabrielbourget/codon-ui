"use client"

import { forwardRef } from "react"

import { type TTextProps, calibrateComponent } from "./helpers"

const Text = forwardRef<HTMLElement, TTextProps>((props, forwardedRef) => {
  const {
    children,
    color,
    customStyles,
    style,
    className,
    variant,
    fontWeight,
    fontStyle,
    elementType,
    composedInLink,
    customClassName,
    "data-testid": dataTestID,
    ...rest
  } = props

  const { textStyles, ElementType, textStyle } = calibrateComponent(props)

  return (
    <ElementType
      {...rest}
      className={textStyles}
      style={textStyle}
      ref={forwardedRef}
      data-testid={dataTestID ?? "text"}
    >
      {children}
    </ElementType>
  )
})

Text.displayName = "Text"

export default Text
