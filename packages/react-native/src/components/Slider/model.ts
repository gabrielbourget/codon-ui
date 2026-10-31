import type { TNativeSliderValue } from "./types"

export const sliderArray = (value: TNativeSliderValue | undefined, fallback: readonly number[]) => {
  if (value === undefined) return [...fallback]
  if (typeof value === "number" && Number.isFinite(value)) return [value]
  if (Array.isArray(value) && value.every((item) => typeof item === "number" && Number.isFinite(item)))
    return [...value]
  throw new TypeError("Slider: values must be finite numbers or an array of finite numbers")
}

export const createSliderModel = (min = 0, max = 100, step = 1) => {
  if (![min, max, step, max - min].every(Number.isFinite) || max < min || step <= 0)
    throw new RangeError("Slider: finite ordered bounds and a positive finite step are required")
  const text = step.toString().toLowerCase()
  const exponentIndex = text.indexOf("e-")
  const pointIndex = text.indexOf(".")
  const precision =
    exponentIndex > 0
      ? Math.abs(Math.floor(Math.log10(step))) + exponentIndex
      : pointIndex < 0
        ? 0
        : text.length - pointIndex
  const scale = 10 ** precision
  if (!Number.isFinite(scale)) throw new RangeError("Slider: step precision exceeds finite numeric arithmetic")
  const rounded = (value: number) => (precision === 0 ? value : Math.round(value * scale) / scale)
  const snap = (value: number, lower = min, upper = max) => {
    const remainder = (value - lower) % step
    let next = rounded(
      Math.abs(remainder) * 2 >= step ? value + Math.sign(remainder) * (step - Math.abs(remainder)) : value - remainder,
    )
    if (next < lower) next = lower
    else if (next > upper) next = lower + Math.floor(rounded((upper - lower) / step)) * step
    next = rounded(next)
    if (!Number.isFinite(next)) throw new RangeError("Slider: value cannot be represented at this step precision")
    return next === 0 ? 0 : next
  }
  return {
    min,
    max,
    step,
    key: JSON.stringify([min, max, step]),
    pageSize: Math.max(snap((max - min) / 10, 0, (max - min) / 10 + step), step),
    project: (values: readonly number[]) =>
      values.map((value, index) =>
        snap(value, index ? values[index - 1]! : min, index === values.length - 1 ? max : values[index + 1]!),
      ),
    snap,
    percent: (value: number) => (max === min ? 0 : (value - min) / (max - min)),
    fromPercent: (percent: number) =>
      Math.min(max, Math.max(min, Math.round((percent * (max - min)) / step) * step + min)),
  }
}
export const equalSliderValues = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((value, index) => value === b[index])
export const closestSliderThumb = (values: readonly number[], value: number) => {
  const right = values.findIndex((current) => current > value)
  if (right === 0) return 0
  if (right < 0) return values.length - 1
  return value - values[right - 1]! < values[right]! - value ? right - 1 : right
}
