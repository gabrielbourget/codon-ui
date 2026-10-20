import { nativeMotionRuntime } from "../../nativeRuntime"
// Received from motion-dom 12.40.0. See UPSTREAM.json and LICENSE.motion-dom.md.
import { MotionGlobalConfig } from "../../utils/index"

import { frameData } from "./frame"

let now: number | undefined

function clearTime() {
  now = undefined
}

/**
 * An eventloop-synchronous alternative to nativeMotionRuntime.performance.now().
 *
 * Ensures that time measurements remain consistent within a synchronous context.
 * Usually calling nativeMotionRuntime.performance.now() twice within the same synchronous context
 * will return different values which isn't useful for animations when we're usually
 * trying to sync animations to the same frame.
 */
export const time = {
  now: (): number => {
    if (now === undefined) {
      time.set(
        frameData.isProcessing || MotionGlobalConfig.useManualTiming
          ? frameData.timestamp
          : nativeMotionRuntime.performance.now(),
      )
    }

    return now!
  },
  set: (newTime: number) => {
    now = newTime
    nativeMotionRuntime.queueMicrotask(clearTime)
  },
}
