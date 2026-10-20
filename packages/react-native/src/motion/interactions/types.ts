import type { GestureResponderEvent, ViewProps } from "react-native"

import type { TNativePressEvent } from "../../input/types"
import type { TNativeMotionPoint } from "../config"

export type TNativeMotionTapEvent = TNativePressEvent
export type TNativeMotionHoverEvent = Parameters<NonNullable<ViewProps["onPointerEnter"]>>[0]
export type TNativeMotionPointerEvent = Parameters<NonNullable<ViewProps["onPointerDown"]>>[0]
// Pinned RN emits numeric IDs but its published declaration says string. Original events remain untouched.
export type TNativeMotionTouchData = Omit<
  GestureResponderEvent["nativeEvent"],
  "identifier" | "touches" | "changedTouches"
> & {
  identifier: number | string
  touches: TNativeMotionTouchData[]
  changedTouches: TNativeMotionTouchData[]
}
export type TNativeMotionTouchEvent = Omit<GestureResponderEvent, "nativeEvent"> & {
  readonly nativeEvent: TNativeMotionTouchData
}
export type TNativeMotionPanEvent = TNativeMotionPointerEvent | TNativeMotionTouchEvent
export type TNativeMotionPointInfo = { point: TNativeMotionPoint }
export type TNativeMotionPanInfo = TNativeMotionPointInfo & {
  delta: TNativeMotionPoint
  offset: TNativeMotionPoint
  velocity: TNativeMotionPoint
}
export type TNativeMotionInteractionProps = {
  onPanSessionStart?: (event: TNativeMotionPanEvent, info: TNativeMotionPanInfo) => void
  onPanStart?: (event: TNativeMotionPanEvent, info: TNativeMotionPanInfo) => void
  onPan?: (event: TNativeMotionPanEvent, info: TNativeMotionPanInfo) => void
  onPanEnd?: (event: TNativeMotionPanEvent, info: TNativeMotionPanInfo) => void
  onTapStart?: (event: TNativeMotionTapEvent, info: TNativeMotionPointInfo) => void
  onTap?: (event: TNativeMotionTapEvent, info: TNativeMotionPointInfo) => void
  onTapCancel?: (event: TNativeMotionTapEvent, info: TNativeMotionPointInfo) => void
  onHoverStart?: (event: TNativeMotionHoverEvent, info: TNativeMotionPointInfo) => void
  onHoverEnd?: (event: TNativeMotionHoverEvent, info: TNativeMotionPointInfo) => void
}
