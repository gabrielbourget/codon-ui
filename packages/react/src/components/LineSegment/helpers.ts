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

type TLineSegmentCalibration = {
  root: {
    className: string
    props: TLineSegmentNativeProps
    style: CSSProperties
  }
}

/** Prepares the native root props and deterministic segment presentation for the renderer. */
export const calibrateComponent = (props: TLineSegmentProps): TLineSegmentCalibration => {
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

  return {
    root: {
      className: classNames(customClassName, className),
      props: rootProps,
      style: { ...segmentStyle, ...customStyles, ...style },
    },
  }
}
