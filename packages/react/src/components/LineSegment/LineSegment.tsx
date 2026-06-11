"use client"

import classNames from "classnames"
import type { ComponentPropsWithoutRef, CSSProperties } from "react"

export const LINE_SEGMENT_DIRECTION__HORIZONTAL = "horizontal"
export const LINE_SEGMENT_DIRECTION__VERTICAL = "vertical"

export const AVAILABLE_LINE_SEGMENT_DIRECTIONS = [
  LINE_SEGMENT_DIRECTION__HORIZONTAL,
  LINE_SEGMENT_DIRECTION__VERTICAL,
] as const
export type TAvailableLineSegmentDirections = (typeof AVAILABLE_LINE_SEGMENT_DIRECTIONS)[number]

type TLineSegmentNativeProps = Omit<ComponentPropsWithoutRef<"div">, "children" | "className" | "color" | "style">

export type TLineSegmentProps = TLineSegmentNativeProps & {
  height?: string | number
  width?: string | number
  size?: string | number
  direction?: TAvailableLineSegmentDirections
  color?: string
  className?: string
  style?: CSSProperties
  customStyles?: CSSProperties
  customClassName?: string
}

const styleGen = (props: TLineSegmentProps): CSSProperties => {
  const {
    height = 50,
    width = 50,
    size = 2.5,
    color = "var(--cui-border)",
    direction = LINE_SEGMENT_DIRECTION__HORIZONTAL,
  } = props

  if (direction === LINE_SEGMENT_DIRECTION__HORIZONTAL) {
    return {
      backgroundColor: color,
      height,
      width: size,
    }
  } else if (direction === LINE_SEGMENT_DIRECTION__VERTICAL) {
    return {
      backgroundColor: color,
      width,
      height: size,
    }
  }

  return {}
}

export const LineSegment = (props: TLineSegmentProps) => {
  const {
    className,
    color: _color,
    customClassName,
    customStyles,
    direction: _direction,
    height: _height,
    size: _size,
    style,
    width: _width,
    ...rest
  } = props
  const styles = styleGen(props)

  return (
    <div
      {...rest}
      style={{ ...styles, ...customStyles, ...style }}
      className={classNames(customClassName, className)}
    />
  )
}

export default LineSegment
