import type { ViewStyle } from "react-native"

import type { TNativeTheme } from "../../theme/types"
import { resolveNativeStyle, validateNativeColor } from "../colors"
import { validateNativeDisplayDimension } from "../displayDimensions"

import { AVAILABLE_LINE_SEGMENT_DIRECTIONS, type TNativeLineSegmentProps } from "./types"

export const getNativeLineSegmentStyle = (theme: TNativeTheme, props: TNativeLineSegmentProps) => {
  const {
    height = 50,
    width = 50,
    size = 2.5,
    color = theme.colors.controlBorder,
    direction = "horizontal",
    customStyles,
    style,
  } = props
  validateNativeDisplayDimension(height, "LineSegment", "height")
  validateNativeDisplayDimension(width, "LineSegment", "width")
  validateNativeDisplayDimension(size, "LineSegment", "size")
  validateNativeColor(color, "LineSegment", "color")
  if (!AVAILABLE_LINE_SEGMENT_DIRECTIONS.includes(direction)) throw new TypeError("LineSegment: unsupported direction")
  // The canonical direction tokens historically name the opposite visual axis.
  const baseline: ViewStyle = {
    backgroundColor: color,
    ...(direction === "horizontal" ? { height, width: size } : { width, height: size }),
    ...resolveNativeStyle(customStyles, "LineSegment", "customStyles"),
  }
  return resolveNativeStyle(
    [baseline, typeof style === "function" ? style({ direction, defaultStyle: baseline }) : style],
    "LineSegment",
    "style",
  )
}
