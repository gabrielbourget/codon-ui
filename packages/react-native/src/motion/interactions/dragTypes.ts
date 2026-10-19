import type { RefObject } from "react"
import type { View } from "react-native"

import type { TNativeMotionTransition } from "../animation"
import type { MotionValue } from "../kernel"

import type { TNativeDragBounds, TNativeDragDirection, TNativeDragElastic } from "./dragConstraints"
import type { NativeDragControls } from "./NativeDragControls"
import type { TNativeMotionPanEvent, TNativeMotionPanInfo } from "./types"

export type TNativeMotionDragProps = {
  drag?: boolean | TNativeDragDirection
  dragListener?: boolean
  dragDirectionLock?: boolean
  dragPropagation?: boolean
  dragConstraints?: false | TNativeDragBounds | RefObject<View | null>
  dragElastic?: TNativeDragElastic
  dragMomentum?: boolean
  dragSnapToOrigin?: boolean | TNativeDragDirection
  dragTransition?: TNativeMotionTransition
  dragControls?: NativeDragControls
  _dragX?: MotionValue<number>
  _dragY?: MotionValue<number>
  onDragStart?: (event: TNativeMotionPanEvent, info: TNativeMotionPanInfo) => void
  onDrag?: (event: TNativeMotionPanEvent, info: TNativeMotionPanInfo) => void
  onDragEnd?: (event: TNativeMotionPanEvent, info: TNativeMotionPanInfo) => void
  onDirectionLock?: (direction: TNativeDragDirection) => void
  onMeasureDragConstraints?: (constraints: TNativeDragBounds) => TNativeDragBounds | void
  onDragTransitionEnd?: () => void
}
