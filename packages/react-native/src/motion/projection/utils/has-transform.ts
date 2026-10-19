// Received from Motion 12.40.0 with native host adaptations. See ../UPSTREAM.json and ../../kernel/LICENSE.motion-dom.md.
import { type AnyResolvedKeyframe } from "../types"
import type { ResolvedValues } from "../types"

function isIdentityScale(scale: AnyResolvedKeyframe | undefined) {
  return scale === undefined || scale === 1
}

export function hasScale({ scale, scaleX, scaleY }: ResolvedValues) {
  return !isIdentityScale(scale) || !isIdentityScale(scaleX) || !isIdentityScale(scaleY)
}

export function hasTransform(values: ResolvedValues) {
  return (
    hasScale(values) ||
    has2DTranslate(values) ||
    values.z ||
    values.rotate ||
    values.rotateX ||
    values.rotateY ||
    values.skewX ||
    values.skewY
  )
}

export function has2DTranslate(values: ResolvedValues) {
  return is2DTranslate(values.x) || is2DTranslate(values.y)
}

function is2DTranslate(value: AnyResolvedKeyframe | undefined) {
  return value && value !== "0%"
}
