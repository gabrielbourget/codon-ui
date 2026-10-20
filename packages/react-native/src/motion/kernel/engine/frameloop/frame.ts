// Received from motion-dom 12.40.0. See UPSTREAM.json and LICENSE.motion-dom.md.
import { createRenderBatcher } from "./batcher"

export const {
  schedule: frame,
  cancel: cancelFrame,
  state: frameData,
  steps: frameSteps,
} = /* @__PURE__ */ createRenderBatcher((callback) => requestAnimationFrame(callback), true)
