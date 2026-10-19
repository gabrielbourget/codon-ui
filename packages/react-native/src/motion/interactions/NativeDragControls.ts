import { useState } from "react"

import type { TNativeMotionPanEvent, TNativeMotionPanInfo } from "./types"

export type TNativeDragStartOptions = { snapToCursor?: boolean; distanceThreshold?: number }
export type TNativeDragSubscriber = {
  start: (event: TNativeMotionPanEvent, options?: TNativeDragStartOptions) => void
  stop: (event?: TNativeMotionPanEvent, info?: TNativeMotionPanInfo) => void
  cancel: () => void
}
// Unlike DOM React wrappers, a native synthetic event's nativeEvent is its data, not a dispatchable event.
export class NativeDragControls {
  private readonly subscribers = new Set<TNativeDragSubscriber>()
  subscribe = (controls: TNativeDragSubscriber) => {
    this.subscribers.add(controls)
    return () => {
      this.subscribers.delete(controls)
    }
  }
  start = (event: TNativeMotionPanEvent, options?: TNativeDragStartOptions) => {
    event.persist?.()
    this.subscribers.forEach((controls) => controls.start(event, options))
  }
  cancel = () => {
    this.subscribers.forEach((controls) => controls.cancel())
  }
  stop = () => {
    this.subscribers.forEach((controls) => controls.stop())
  }
}
export const useNativeDragControls = () => useState(() => new NativeDragControls())[0]
