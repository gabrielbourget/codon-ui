"use client"

import { forwardRef, type ForwardRefExoticComponent, type RefAttributes } from "react"
import { Button as AriaButton } from "react-aria-components"

import { calibrateComponent, type TButtonProps } from "./helpers"

const Button: ForwardRefExoticComponent<TButtonProps & RefAttributes<HTMLButtonElement>> = forwardRef<
  HTMLButtonElement,
  TButtonProps
>((props, ref) => {
  const {
    "data-testid": dataTestID,
    children,
    hoverColor,
    isDisabled,
    className,
    customClassName,
    raised,
    raisedOnHover,
    order,
    geometry,
    colorMode,
    color,
    enableFocusStyle,
    offsetFocusRing,
    height,
    width,
    customStyles: customStylesProp,
    transparent,
    style,
    ...rest
  } = props

  const { buttonStyles, buttonStyle } = calibrateComponent(props)

  return (
    <AriaButton
      {...rest}
      isDisabled={isDisabled}
      ref={ref}
      data-testid={dataTestID ?? "button"}
      className={buttonStyles}
      style={buttonStyle}
    >
      {children}
    </AriaButton>
  )
})

Button.displayName = "Button"

export default Button
