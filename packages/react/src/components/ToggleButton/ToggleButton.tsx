"use client"

import { forwardRef, type ReactNode } from "react"
import { ToggleButton as AdobeToggleButton, type ToggleButtonRenderProps } from "react-aria-components"

import { calibrateComponent, type TToggleButtonProps } from "./helpers"

type TToggleButtonChildrenRenderProps = ToggleButtonRenderProps & {
  defaultChildren: ReactNode | undefined
}

const ToggleButton = forwardRef<HTMLButtonElement, TToggleButtonProps>((props, forwardedRef) => {
  const {
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
    raised,
    customStyles,
    "data-testid": dataTestID,
    ...rest
  } = props

  const { toggleButtonStyles, toggleButtonStyle } = calibrateComponent(props)

  return (
    <AdobeToggleButton
      {...rest}
      isDisabled={isDisabled}
      ref={forwardedRef}
      data-testid={dataTestID ?? "toggle-button"}
      className={toggleButtonStyles}
      style={toggleButtonStyle}
    >
      {(toggleButtonRenderProps) =>
        typeof children === "function"
          ? children({
              ...toggleButtonRenderProps,
              defaultChildren: undefined,
            } as TToggleButtonChildrenRenderProps)
          : children
      }
    </AdobeToggleButton>
  )
})

ToggleButton.displayName = "ToggleButton"

export default ToggleButton
