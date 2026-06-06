"use client"

import Text from "../../Text"

import { calibrateComponent, type TPlaceholderTextProps } from "./helpers"

const PlaceholderText = (props: TPlaceholderTextProps) => {
  const { align: _align, children, customClassName: _customClassName, ...rest } = props
  const { placeholderTextStyles } = calibrateComponent(props)

  return (
    <Text
      variant="b11"
      fontStyle="italic"
      customClassName={placeholderTextStyles}
      data-testid={props["data-testid"] ?? "placeholder-text"}
      {...rest}
    >
      {children}
    </Text>
  )
}

export default PlaceholderText
