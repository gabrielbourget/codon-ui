"use client"

import { type FC } from "react"
import { Separator } from "react-aria-components"

import { calibrateSeparator, type TMenuSeparatorProps } from "../helpers"

const MenuSeparator: FC<TMenuSeparatorProps> = (props) => {
  const {
    "data-testid": dataTestID,
    className,
    customClassName: _customClassName,
    customStyles: _customStyles,
    style,
    ...rest
  } = props
  const { separatorStyles, customStyles } = calibrateSeparator(props)

  return (
    <Separator
      {...rest}
      className={separatorStyles}
      style={customStyles}
      data-testid={dataTestID ?? "menu-separator"}
    />
  )
}

MenuSeparator.displayName = "MenuSeparator"

export default MenuSeparator
