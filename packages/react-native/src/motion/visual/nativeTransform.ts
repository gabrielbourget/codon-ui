// Native mapping of Motion 12.40.0; see UPSTREAM.json and ../kernel/LICENSE.motion-dom.md.
import { NATIVE_MOTION_TRANSFORM_ORDER } from "./types"
import type {
  TNativeMotionAngle,
  TNativeMotionOriginValues,
  TNativeMotionTransform,
  TNativeMotionTransformKey,
  TNativeMotionTransformTemplate,
  TNativeMotionTransformValues,
} from "./types"

const numeric = (value: unknown, key: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new TypeError(`Native motion: ${key} must be a finite native number`)
  return value
}
const angle = (value: unknown, key: string): Exclude<TNativeMotionAngle, number> => {
  if (typeof value === "number") return `${numeric(value, key)}deg` as const
  if (
    typeof value !== "string" ||
    !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?(?:deg|rad)$/.test(value) ||
    !Number.isFinite(parseFloat(value))
  )
    throw new TypeError(`Native motion: ${key} must use native degrees or radians`)
  return value as Exclude<TNativeMotionAngle, number>
}
const translation = (value: unknown, key: string) => {
  if (typeof value === "number") return numeric(value, key)
  if (
    typeof value === "string" &&
    /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?%$/i.test(value) &&
    Number.isFinite(parseFloat(value))
  )
    return value as `${number}%`
  throw new TypeError(`Native motion: ${key} must be a finite native number or percentage`)
}
const translateZ = (value: number): TNativeMotionTransform[number] => ({
  matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, value, 1],
})
const nativeTransform = (
  key: TNativeMotionTransformKey,
  value: NonNullable<TNativeMotionTransformValues[TNativeMotionTransformKey]>,
): TNativeMotionTransform[number] => {
  switch (key) {
    case "transformPerspective":
      return { perspective: numeric(value, key) }
    case "x":
    case "translateX":
      return { translateX: translation(value, key) }
    case "y":
    case "translateY":
      return { translateY: translation(value, key) }
    case "z":
    case "translateZ":
      return translateZ(numeric(value, key))
    case "scale":
      return { scale: numeric(value, key) }
    case "scaleX":
      return { scaleX: numeric(value, key) }
    case "scaleY":
      return { scaleY: numeric(value, key) }
    case "rotate":
      return { rotate: angle(value, key) }
    case "rotateX":
      return { rotateX: angle(value, key) }
    case "rotateY":
      return { rotateY: angle(value, key) }
    case "rotateZ":
      return { rotateZ: angle(value, key) }
    case "skew":
    case "skewX":
      return { skewX: angle(value, key) }
    case "skewY":
      return { skewY: angle(value, key) }
  }
}

export const buildNativeMotionTransform = (
  latest: TNativeMotionTransformValues,
  template?: TNativeMotionTransformTemplate,
): TNativeMotionTransform => {
  const generated: TNativeMotionTransform[number][] = []
  const values: TNativeMotionTransformValues = {}
  for (const key of NATIVE_MOTION_TRANSFORM_ORDER) {
    const value = latest[key]
    if (value === undefined) continue
    const transformed = nativeTransform(key, value)
    const isDefault = parseFloat(String(value)) === (key.startsWith("scale") ? 1 : 0)
    if (!isDefault) generated.push(transformed)
    if (template)
      Object.assign(values, { [key]: key.startsWith("rotate") || key.startsWith("skew") ? angle(value, key) : value })
  }
  if (latest.pathRotation !== undefined && parseFloat(String(latest.pathRotation)) !== 0)
    generated.push({ rotate: angle(latest.pathRotation, "pathRotation") })
  const result = template ? template(values, generated) : generated
  if (!Array.isArray(result))
    throw new TypeError("Native motion: transformTemplate must return a native transform array")
  return result
}

// Motion origins own all three coordinates once any origin is supplied.
export const buildNativeMotionOrigin = ({ originX = 0.5, originY = 0.5, originZ = 0 }: TNativeMotionOriginValues) => [
  typeof originX === "number" ? `${numeric(originX, "originX") * 100}%` : translation(originX, "originX"),
  typeof originY === "number" ? `${numeric(originY, "originY") * 100}%` : translation(originY, "originY"),
  numeric(originZ, "originZ"),
]
