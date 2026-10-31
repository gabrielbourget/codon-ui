import { complex } from "../kernel/engine/value/types/complex"
import { normalizeNativeMotionKeyframeUnits } from "../measurement/isolatedGeometry"

import type { TNativeMotionResolutionToken, TNativeMotionValueOptions, TNativeResolvedKeyframes } from "./types"

export { nativeTargetKeyframes } from "./targetKeyframes"

const COLOR_FIELDS = new Set([
  "color",
  "backgroundColor",
  "borderColor",
  "borderTopColor",
  "borderRightColor",
  "borderBottomColor",
  "borderLeftColor",
  "borderStartColor",
  "borderEndColor",
  "borderBlockColor",
  "borderBlockStartColor",
  "borderBlockEndColor",
  "outlineColor",
  "shadowColor",
  "textDecorationColor",
  "textShadowColor",
])
const percentageString = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?%$/i
const PERCENTAGE_FIELDS = new Set([
  "width",
  "height",
  "minWidth",
  "minHeight",
  "maxWidth",
  "maxHeight",
  "flexBasis",
  "top",
  "right",
  "bottom",
  "left",
  "start",
  "end",
  "inset",
  "insetBlock",
  "insetBlockEnd",
  "insetBlockStart",
  "insetInline",
  "insetInlineEnd",
  "insetInlineStart",
  "gap",
  "rowGap",
  "columnGap",
  "x",
  "y",
  "translateX",
  "translateY",
  "borderRadius",
  ...["margin", "padding"].flatMap((prefix) =>
    [
      "",
      "Top",
      "Right",
      "Bottom",
      "Left",
      "Start",
      "End",
      "Horizontal",
      "Vertical",
      "Block",
      "BlockStart",
      "BlockEnd",
      "Inline",
      "InlineStart",
      "InlineEnd",
    ].map((suffix) => `${prefix}${suffix}`),
  ),
  ...[
    "TopLeft",
    "TopRight",
    "BottomLeft",
    "BottomRight",
    "TopStart",
    "TopEnd",
    "BottomStart",
    "BottomEnd",
    "StartStart",
    "StartEnd",
    "EndStart",
    "EndEnd",
  ].map((corner) => `border${corner}Radius`),
])
// Pinned none-template normalization precedes geometry. Native numeric zero may use a valid
// percentage template; native-invalid strings, colors and unrelated structured fields stay intact.
const normalizeZeroPercentages = (name: string, frames: unknown[]): unknown[] => {
  const scalar = (field: string, values: unknown[]) => {
    if (!PERCENTAGE_FIELDS.has(field) || !values.some((value) => value === 0)) return values
    const template = values.find(
      (value) =>
        typeof value === "string" && percentageString.test(value) && Number.isFinite(Number(value.slice(0, -1))),
    )
    if (typeof template !== "string") return values
    const zero = complex.getAnimatableNone(template)
    return values.map((value) => (value === 0 ? zero : value))
  }
  if (PERCENTAGE_FIELDS.has(name)) return scalar(name, frames)
  if ((name !== "transform" && name !== "transformOrigin") || !frames.every(Array.isArray)) return frames
  const arrays = frames as unknown[][]
  const length = arrays[0]?.length ?? 0
  if (!arrays.every((frame) => frame.length === length)) return frames
  let changed = false
  const result = [...arrays]
  const replace = (frame: number, index: number, value: unknown) => {
    if (result[frame] === arrays[frame]) result[frame] = [...arrays[frame]]
    result[frame]![index] = value
    changed = true
  }
  for (let index = 0; index < length; index++) {
    if (name === "transformOrigin") {
      if (index > 1 || length > 3) continue
      const values = arrays.map((frame) => frame[index])
      scalar("translateX", values).forEach((value, frame) => {
        if (value !== values[frame]) replace(frame, index, value)
      })
      continue
    }
    const descriptors = arrays.map((frame) => frame[index])
    if (
      !descriptors.every(
        (value) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 1,
      )
    )
      continue
    const key = Object.keys(descriptors[0] as object)[0]!
    if (
      (key !== "translateX" && key !== "translateY") ||
      !descriptors.every((value) => Object.hasOwn(value as object, key))
    )
      continue
    const values = descriptors.map((value) => (value as Record<string, unknown>)[key])
    scalar(key, values).forEach((value, frame) => {
      if (value !== values[frame]) replace(frame, index, { [key]: value })
    })
  }
  return changed ? result : frames
}
const current = (token: TNativeMotionResolutionToken) => {
  if (!token.isCurrent()) throw new Error("Native motion: keyframe resolution retired")
}
const isThenable = (value: unknown): value is PromiseLike<unknown> =>
  value !== null &&
  (typeof value === "object" || typeof value === "function") &&
  "then" in value &&
  typeof value.then === "function"
const unit = (value: unknown) =>
  typeof value === "number"
    ? "number"
    : typeof value === "string" && percentageString.test(value)
      ? "percent"
      : value === "auto"
        ? "auto"
        : typeof value === "string" && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:deg|rad)$/.test(value)
          ? value.endsWith("deg")
            ? "deg"
            : "rad"
          : typeof value === "string" && /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?$/.test(value)
            ? "numeric-string"
            : "other"
const needsGeometry = (frames: readonly unknown[]): boolean => {
  if (frames.some((value) => value === "auto")) return true
  const units = new Set(frames.map(unit).filter((value) => value !== "other"))
  if (units.size > 1 || (units.size && frames.some((value) => unit(value) === "other"))) return true
  const objects = frames.filter((value) => value !== null && typeof value === "object")
  if (!objects.length) return false
  if (objects.length !== frames.length) return true
  const first = objects[0] as Record<string, unknown>
  const keys = Object.keys(first).sort()
  if (
    !objects.every(
      (value) =>
        Array.isArray(value) === Array.isArray(first) &&
        Object.keys(value as object)
          .sort()
          .join("\0") === keys.join("\0"),
    )
  )
    return true
  return keys.some((key) => needsGeometry(objects.map((value) => (value as Record<string, unknown>)[key])))
}
const requireFinite = (value: unknown): void => {
  if (typeof value === "number" && !Number.isFinite(value))
    throw new TypeError("Native motion: keyframes require finite native numbers")
  if (value !== null && typeof value === "object") Object.values(value).forEach(requireFinite)
}
const resolveLeaves = (
  frames: unknown[],
  options: TNativeMotionValueOptions,
  token: TNativeMotionResolutionToken,
): TNativeResolvedKeyframes | Promise<TNativeResolvedKeyframes> => {
  current(token)
  frames.forEach(requireFinite)
  const colors: unknown[] = []
  const replacements: Array<(color: string) => void> = []
  let transformed = false
  const visit = (value: unknown, field: string, replace: (value: unknown) => void): unknown => {
    if (COLOR_FIELDS.has(field) && value !== null && value !== undefined) {
      colors.push(value)
      replacements.push(replace)
      transformed = true
      return value
    }
    if (Array.isArray(value)) {
      const result: unknown[] = []
      value.forEach((item, index) => {
        result[index] = visit(item, "", (next) => {
          result[index] = next
        })
      })
      return result
    }
    if (value !== null && typeof value === "object") {
      const result: Record<string, unknown> = {}
      for (const [key, item] of Object.entries(value))
        result[key] = visit(item, key, (next) => {
          result[key] = next
        })
      return result
    }
    if (typeof value === "number" && !Number.isFinite(value))
      throw new TypeError("Native motion: keyframes require finite native numbers")
    return value
  }
  let resolved: unknown[] = []
  frames.forEach((value, index) => {
    resolved[index] = visit(value, options.name, (next) => {
      resolved[index] = next
    })
  })
  const afterColors = (): TNativeResolvedKeyframes | Promise<TNativeResolvedKeyframes> => {
    current(token)
    const normalized = normalizeNativeMotionKeyframeUnits(options.name, resolved)
    transformed ||= normalized.some((value, index) => value !== resolved[index])
    resolved = normalizeZeroPercentages(options.name, normalized)
    options.context.resolutionTicket?.normalized(resolved)
    if (needsGeometry(resolved)) {
      if (!options.context.resolveGeometry)
        throw new Error(`Native motion: ${options.name} requires actual native keyframe geometry`)
      const measured = options.context.resolutionTicket
        ? options.context.resolveGeometry(options.name, resolved, token, options.context.resolutionTicket)
        : options.context.resolveGeometry(options.name, resolved, token)
      const accept = (result: TNativeResolvedKeyframes) => {
        current(token)
        result.keyframes.forEach(requireFinite)
        if (result.keyframes.length !== resolved.length || needsGeometry(result.keyframes))
          throw new Error("Native motion: incomplete native geometry resolution")
        return { keyframes: result.keyframes, finalKeyframe: result.finalKeyframe ?? frames[frames.length - 1] }
      }
      return isThenable(measured) ? Promise.resolve(measured).then(accept) : accept(measured)
    }
    return { keyframes: resolved, ...(transformed ? { finalKeyframe: frames[frames.length - 1] } : {}) }
  }
  if (!colors.length) {
    resolved = frames
    return afterColors()
  }
  if (!options.context.resolveColors)
    throw new Error("Native motion: color keyframes require actual native color resolution")
  const sampled = options.context.resolveColors(colors, token)
  const accept = (values: readonly string[]) => {
    current(token)
    if (values.length !== colors.length) throw new Error("Native motion: incomplete native color resolution")
    values.forEach((value, index) => replacements[index](value))
    return afterColors()
  }
  return isThenable(sampled) ? Promise.resolve(sampled).then(accept) : accept(sampled)
}
export const resolveNativeMotionKeyframes = (
  options: TNativeMotionValueOptions,
  token: TNativeMotionResolutionToken,
): TNativeResolvedKeyframes | Promise<TNativeResolvedKeyframes> => {
  current(token)
  const frames = [...options.keyframes]
  if (!frames.length) throw new Error("Native motion: keyframes cannot be empty")
  const finish = () => {
    current(token)
    for (let index = 1; index < frames.length; index++)
      if (frames[index] === null || frames[index] === undefined) frames[index] = frames[index - 1]
    if (frames.some((value) => value === null || value === undefined))
      throw new Error("Native motion: missing actual native initial value")
    const hasVelocity = (options.type === "spring" || typeof options.type === "function") && options.velocity
    if (
      options.duration === 0 ||
      frames.length === 1 ||
      (!hasVelocity && frames.every((value) => value === frames[0]))
    ) {
      frames.forEach(requireFinite)
      options.context.resolutionTicket?.normalized(frames)
      return { keyframes: frames }
    }
    return resolveLeaves(frames, options, token)
  }
  if (frames[0] !== null) return finish()
  const initial = options.motionValue.get()
  if (initial !== null && initial !== undefined) {
    frames[0] = initial
    return finish()
  }
  const read = options.context.readValue(options.name, frames[frames.length - 1], token)
  const accept = (value: unknown) => {
    current(token)
    if (value === undefined || value === null) throw new Error("Native motion: actual native initial value unavailable")
    frames[0] = value
    options.motionValue.set(value)
    return finish()
  }
  return isThenable(read) ? Promise.resolve(read).then(accept) : accept(read)
}
const animatedLeaf = (value: unknown): boolean => {
  if (typeof value === "number") return true
  if (typeof value === "string") return (complex.test(value) || value === "0") && !value.startsWith("url(")
  if (Array.isArray(value)) return value.some(animatedLeaf)
  return value !== null && typeof value === "object" && Object.values(value).some(animatedLeaf)
}
export const canAnimateNativeKeyframes = (frames: unknown[], name: string, type: unknown, velocity?: number) => {
  if (name === "display" || name === "visibility") return true
  if (name === "zIndex" || !animatedLeaf(frames[0]) || !animatedLeaf(frames[frames.length - 1])) return false
  return (
    frames.length === 1 ||
    frames.some((value) => value !== frames[0]) ||
    Boolean((type === "spring" || typeof type === "function") && velocity)
  )
}
