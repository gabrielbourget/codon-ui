// Received from motion-dom 12.40.0. See UPSTREAM.json and LICENSE.motion-dom.md.
import type { StepId } from "./types"

export const stepsOrder: StepId[] = [
  "setup", // Compute
  "read", // Read
  "resolveKeyframes", // Write/Read/Write/Read
  "preUpdate", // Compute
  "update", // Compute
  "preRender", // Compute
  "render", // Write
  "postRender", // Compute
] as const

export type StepNames = (typeof stepsOrder)[number]
