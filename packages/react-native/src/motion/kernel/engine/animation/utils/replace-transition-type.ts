// Received from motion-dom 12.40.0. See UPSTREAM.json and LICENSE.motion-dom.md.
import { inertia } from "../generators/inertia"
import { keyframes } from "../generators/keyframes"
import { spring } from "../generators/spring"
import type { GeneratorFactory, ValueAnimationTransition } from "../types"

const transitionTypeMap: { [key: string]: GeneratorFactory } = {
  decay: inertia,
  inertia,
  tween: keyframes,
  keyframes: keyframes,
  spring,
}

export function replaceTransitionType(transition: Pick<ValueAnimationTransition, "type">) {
  if (typeof transition.type === "string") {
    transition.type = transitionTypeMap[transition.type]
  }
}
