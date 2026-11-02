const failure = (message: string) => new Error(`Native motion keyframes: ${message}`)
const validField = (field: string) =>
  field.length <= 128 &&
  /^[A-Za-z][A-Za-z0-9]*$/.test(field) &&
  !["constructor", "prototype", "__proto__"].includes(field)
const numericString = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i
const angleString = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(deg|rad)$/i
const ANGLES = new Set([
  "rotate",
  "rotateX",
  "rotateY",
  "rotateZ",
  "rotation",
  "skew",
  "skewX",
  "skewY",
  "pathRotation",
])
// Native angle/origin normalization does not need Yoga. Preserve all other
// native types, topology and transform order; never guess a replacement metric.
export const normalizeNativeMotionKeyframeUnits = (name: string, frames: readonly unknown[]): unknown[] => {
  const visit = (value: unknown, field: string, transform: boolean, depth: number): unknown => {
    if (depth > 32) throw failure("native value nesting exceeded its limit")
    if (ANGLES.has(field)) {
      const match = typeof value === "string" ? angleString.exec(value) : null
      const degrees = match ? Number(match[1]) * (match[2].toLowerCase() === "rad" ? 180 / Math.PI : 1) : value
      if (typeof degrees !== "number" || !Number.isFinite(degrees)) throw failure(`${field} requires a native angle`)
      return transform ? `${degrees}deg` : degrees
    }
    if ((field === "originX" || field === "originY") && typeof value === "string" && value.endsWith("%")) {
      const percent = value.slice(0, -1)
      if (!numericString.test(percent) || !Number.isFinite(Number(percent))) throw failure("invalid native origin")
      return Number(percent) / 100
    }
    if (Array.isArray(value)) {
      const next = value.map((item) => visit(item, "", transform || field === "transform", depth + 1))
      return next.every((item, index) => item === value[index]) ? value : next
    }
    if (value && typeof value === "object") {
      if (![Object.prototype, null].includes(Object.getPrototypeOf(value)))
        throw failure("native value object required")
      const entries = Object.entries(value)
      if (entries.some(([key]) => !validField(key))) throw failure("invalid native value field")
      const next = entries
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, visit(item, key, transform, depth + 1)] as const)
      return next.length === entries.length &&
        next.every(([key, item]) => item === (value as Record<string, unknown>)[key])
        ? value
        : Object.fromEntries(next)
    }
    if (typeof value === "number" && !Number.isFinite(value)) throw failure("finite native values required")
    if (value === null || value === undefined || typeof value === "function" || typeof value === "symbol")
      throw failure("complete native values required")
    return value
  }
  return frames.map((value) => visit(value, name, name === "transform", 0))
}
