import type { TNativeMotionTransition } from "../animation"
import type { MotionValue } from "../kernel"

export interface TNativeMotionResolutionToken {
  isCurrent: () => boolean
  onCancel: (listener: () => void) => () => void
}
export type TNativeResolvedKeyframes = {
  keyframes: unknown[]
  finalKeyframe?: unknown
}
export type TNativeMotionValueContext = {
  isCurrent: () => boolean
  readValue: (name: string, target: unknown, token: TNativeMotionResolutionToken) => unknown | Promise<unknown>
  resolveGeometry?: (
    name: string,
    frames: readonly unknown[],
    token: TNativeMotionResolutionToken,
  ) => TNativeResolvedKeyframes | Promise<TNativeResolvedKeyframes>
  resolveColors?: (
    colors: readonly unknown[],
    token: TNativeMotionResolutionToken,
  ) => readonly string[] | Promise<readonly string[]>
  shouldSkipAnimations?: boolean
}
export type TNativeMotionValueOptions = TNativeMotionTransition & {
  keyframes: unknown[]
  name: string
  motionValue: MotionValue<unknown>
  context: TNativeMotionValueContext
  onUpdate?: (value: unknown) => void
}
