"use client"

import classNames from "classnames"
import type { CSSProperties } from "react"

import { LINE_SEGMENT_DIRECTION__HORIZONTAL, LINE_SEGMENT_DIRECTION__VERTICAL, type TLineSegmentProps } from "./helpers"

export const LineSegment = (props: TLineSegmentProps) => {
  const {
    className,
    color = "var(--cui-border)",
    customClassName,
    customStyles,
    direction = LINE_SEGMENT_DIRECTION__HORIZONTAL,
    height = 50,
    size = 2.5,
    style,
    width = 50,
    ...rootProps
  } = props
  const segmentStyle: CSSProperties =
    direction === LINE_SEGMENT_DIRECTION__HORIZONTAL
      ? {
          backgroundColor: color,
          height,
          width: size,
        }
      : direction === LINE_SEGMENT_DIRECTION__VERTICAL
        ? {
            backgroundColor: color,
            width,
            height: size,
          }
        : {}

  return (
    <div
      {...rootProps}
      style={{ ...segmentStyle, ...customStyles, ...style }}
      className={classNames(customClassName, className)}
    />
  )
}

export {
  AVAILABLE_LINE_SEGMENT_DIRECTIONS,
  LINE_SEGMENT_DIRECTION__HORIZONTAL,
  LINE_SEGMENT_DIRECTION__VERTICAL,
  type TAvailableLineSegmentDirections,
  type TLineSegmentProps,
} from "./helpers"

export default LineSegment
