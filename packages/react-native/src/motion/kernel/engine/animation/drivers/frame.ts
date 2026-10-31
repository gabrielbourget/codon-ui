// Received from motion-dom 12.40.0. See UPSTREAM.json and LICENSE.motion-dom.md.
import { cancelFrame, frame, frameData } from "../../frameloop/frame"
import { time } from "../../frameloop/sync-time"
import type { FrameData } from "../../frameloop/types"

import type { Driver } from "./types"

export const frameloopDriver: Driver = (update) => {
  let current: ((data: FrameData) => void) | undefined

  const stop = () => {
    const previous = current
    current = undefined
    if (previous) cancelFrame(previous)
  }

  return {
    start: (keepAlive = true) => {
      stop()
      // A selected callback can survive queue cancellation within its frame.
      // Each start owns its callback so a retired run cannot update a new run.
      const passTimestamp = ({ timestamp }: FrameData) => {
        if (current === passTimestamp) update(timestamp)
      }
      current = passTimestamp
      frame.update(passTimestamp, keepAlive)
    },
    stop,
    /**
     * If we're processing this frame we can use the
     * framelocked timestamp to keep things in sync.
     */
    now: () => (frameData.isProcessing ? frameData.timestamp : time.now()),
  }
}
