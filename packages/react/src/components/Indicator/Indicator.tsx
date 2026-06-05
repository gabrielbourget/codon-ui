"use client"

import { calibrateComponent, type TIndicatorProps } from "./helpers"

const Indicator = (props: TIndicatorProps) => {
  const {
    borderColor: _borderColor,
    borderWidth: _borderWidth,
    className: _className,
    color: _color,
    customClassName: _customClassName,
    customStyles: _customStyles,
    inactiveColor: _inactiveColor,
    isActive: _isActive,
    shape: _shape,
    size: _size,
    style: _style,
    ...rest
  } = props
  const { indicatorClassName, indicatorStyle } = calibrateComponent(props)

  return <div {...rest} className={indicatorClassName} style={indicatorStyle} />
}

export default Indicator
