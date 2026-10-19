import type { ViewProps } from "react-native"

import type { TNativePressEvent } from "../../input/types"
import type { TNativeMotionPoint } from "../config"

export type TNativeMotionTapEvent = TNativePressEvent
export type TNativeMotionHoverEvent = Parameters<NonNullable<ViewProps["onPointerEnter"]>>[0]
export type TNativeMotionPointInfo = { point: TNativeMotionPoint }
export type TNativeMotionInteractionProps = {
  onTapStart?: (event: TNativeMotionTapEvent, info: TNativeMotionPointInfo) => void
  onTap?: (event: TNativeMotionTapEvent, info: TNativeMotionPointInfo) => void
  onTapCancel?: (event: TNativeMotionTapEvent, info: TNativeMotionPointInfo) => void
  onHoverStart?: (event: TNativeMotionHoverEvent, info: TNativeMotionPointInfo) => void
  onHoverEnd?: (event: TNativeMotionHoverEvent, info: TNativeMotionPointInfo) => void
}
