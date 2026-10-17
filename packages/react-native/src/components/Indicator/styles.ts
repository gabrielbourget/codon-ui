import type { ColorValue, ViewStyle } from "react-native"

import type { TNativeTheme } from "../../theme/types"
import { resolveNativeStyle, validateNativeColor } from "../colors"
import { validateNativeDisplayDimension } from "../displayDimensions"

import { AVAILABLE_INDICATOR_SHAPES, type TNativeIndicatorProps } from "./types"

export const getNativeIndicatorStyle = (theme: TNativeTheme, props: TNativeIndicatorProps, foreground: ColorValue) => {
  const {
    isActive = true,
    size = 10,
    color = foreground,
    inactiveColor = "transparent",
    borderColor = color,
    borderWidth = 0,
    shape = "circle",
    customStyles,
    style,
  } = props
  validateNativeDisplayDimension(size, "Indicator", "size")
  if (!Number.isFinite(borderWidth) || borderWidth < 0)
    throw new TypeError("Indicator: borderWidth must be a finite nonnegative number")
  if (!AVAILABLE_INDICATOR_SHAPES.includes(shape)) throw new TypeError("Indicator: unsupported shape")
  validateNativeColor(color, "Indicator", "color")
  validateNativeColor(inactiveColor, "Indicator", "inactiveColor")
  validateNativeColor(borderColor, "Indicator", "borderColor")
  const baseline: ViewStyle = {
    flexShrink: 0,
    width: size,
    height: size,
    backgroundColor: isActive ? color : inactiveColor,
    borderColor,
    borderWidth,
    borderRadius: shape === "circle" ? theme.radius.round : shape === "rounded" ? theme.radius.rounded : 0,
    ...resolveNativeStyle(customStyles, "Indicator", "customStyles"),
  }
  return resolveNativeStyle(
    [baseline, typeof style === "function" ? style({ isActive, defaultStyle: baseline }) : style],
    "Indicator",
    "style",
  )
}
