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
