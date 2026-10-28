import { processColor, type ColorValue, type DropShadowValue, type FilterFunction } from "react-native"

import { mixNativeSRGBColors } from "../colors"

const FILTER_IDENTITIES = {
  brightness: 1,
  blur: 0,
  contrast: 1,
  grayscale: 0,
  hueRotate: 0,
  invert: 0,
  opacity: 1,
  saturate: 1,
  sepia: 0,
} as const
type TScalar = keyof typeof FILTER_IDENTITIES
type TShadow = { offsetX: number; offsetY: number; standardDeviation: number; color: ColorValue | number }
type TFilter = { name: TScalar; value: number } | { name: "dropShadow"; value: TShadow }
const numeric = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return { amount: value, unit: "" }
  if (typeof value !== "string") return undefined
  const match = /^\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*(%|px|deg|rad)?\s*$/i.exec(value)
  if (!match || !Number.isFinite(Number(match[1]))) return undefined
  return { amount: Number(match[1]), unit: (match[2] ?? "").toLowerCase() }
}
const length = (value: unknown) => {
  const parsed = numeric(value)
  return parsed && (parsed.unit === "px" || (!parsed.unit && (typeof value === "number" || parsed.amount === 0)))
    ? parsed.amount
    : undefined
}
const shadow = (value: unknown, foreground: ColorValue): TShadow | undefined => {
  let source: DropShadowValue
  if (typeof value === "string") {
    const lengths: number[] = []
    let color: ColorValue | undefined
    let endedLengths = false
    for (const token of value.trim().split(/\s+(?![^(]*\))/)) {
      if (processColor(token) != null && color === undefined) {
        color = token
        endedLengths ||= lengths.length > 0
      } else {
        const amount = length(token)
        if (amount === undefined || endedLengths || lengths.length === 3) return undefined
        lengths.push(amount)
      }
    }
    if (lengths.length < 2) return undefined
    source = { offsetX: lengths[0], offsetY: lengths[1], standardDeviation: lengths[2], color }
  } else if (value && typeof value === "object" && !Array.isArray(value)) source = value as DropShadowValue
  else return undefined
  if (Object.keys(source).some((key) => !["offsetX", "offsetY", "standardDeviation", "color"].includes(key)))
    return undefined
  const offsetX = length(source.offsetX),
    offsetY = length(source.offsetY),
    standardDeviation = length(source.standardDeviation ?? 0),
    color = source.color ?? foreground
  if (
    offsetX === undefined ||
    offsetY === undefined ||
    standardDeviation === undefined ||
    standardDeviation < 0 ||
    processColor(color as ColorValue) == null
  )
    return undefined
  return { offsetX, offsetY, standardDeviation, color }
}
const parse = (name: string, value: unknown, foreground: ColorValue): TFilter | undefined => {
  if (name === "dropShadow") {
    const parsed = shadow(value, foreground)
    return parsed ? { name, value: parsed } : undefined
  }
  if (!Object.hasOwn(FILTER_IDENTITIES, name)) return undefined
  const field = name as TScalar
  const parsed = numeric(value === "" ? (field === "blur" || field === "hueRotate" ? 0 : 1) : value)
  if (!parsed) return undefined
  let amount = parsed.amount
  if (field === "hueRotate") {
    if (parsed.unit === "rad") amount = (amount * 180) / Math.PI
    else if (parsed.unit !== "deg" && (parsed.unit || amount !== 0)) return undefined
  } else if (field === "blur") {
    if (parsed.unit && parsed.unit !== "px") return undefined
    if (amount < 0) return undefined
  } else {
    if (parsed.unit === "%") amount /= 100
    else if (parsed.unit && parsed.unit !== "px") return undefined
    if (amount < 0) return undefined
    if (["grayscale", "invert", "opacity", "sepia"].includes(field)) amount = Math.min(1, amount)
  }
  return { name: field, value: amount }
}
const filters = (value: unknown, foreground: ColorValue): TFilter[] | undefined => {
  if (value == null || (typeof value === "string" && value.trim().toLowerCase() === "none")) return []
  const entries: [string, unknown][] = []
  if (Array.isArray(value)) {
    for (const filter of value) {
      if (!filter || typeof filter !== "object" || Object.keys(filter).length !== 1) return undefined
      entries.push(Object.entries(filter)[0])
    }
  } else if (typeof value === "string") {
    let remaining = value.trim()
    if (!remaining) return undefined
    while (remaining) {
      const match = /^([a-z-]+)\(/i.exec(remaining)
      if (!match) return undefined
      let end = match[0].length,
        depth = 1
      for (; end < remaining.length && depth; end++) {
        if (remaining[end] === "(") depth++
        else if (remaining[end] === ")") depth--
      }
      if (depth) return undefined
      const name = match[1].toLowerCase()
      entries.push([
        name === "hue-rotate" ? "hueRotate" : name === "drop-shadow" ? "dropShadow" : name,
        remaining.slice(match[0].length, end - 1).trim(),
      ])
      remaining = remaining.slice(end).trim()
    }
  } else return undefined
  const result: TFilter[] = []
  for (const [name, value] of entries) {
    const parsed = parse(name, value, foreground)
    if (!parsed) return undefined
    result.push(parsed)
  }
  return result
}
const render = (filter: TFilter): FilterFunction => {
  if (filter.name === "dropShadow") return { dropShadow: filter.value }
  return {
    [filter.name]: filter.name === "hueRotate" ? `${filter.value}deg` : filter.value,
  } as FilterFunction
}
// Explicit arrays also preserve CSS defaults through the pinned SDK's legacy string parser.
export const resolvePanelFilters = (value: unknown, foreground: ColorValue) =>
  filters(value, foreground)?.map(render) ?? value

export const createPanelFilterMixer = (from: unknown, to: unknown, foreground: ColorValue) => {
  const first = filters(from, foreground),
    last = filters(to, foreground)
  if (!first || !last) return undefined
  const mixers: ((progress: number) => TFilter)[] = []
  for (let index = 0; index < Math.max(first.length, last.length); index++) {
    const before = first[index],
      after = last[index],
      name = before?.name ?? after!.name
    if (before && after && before.name !== after.name) return undefined
    if (name === "dropShadow") {
      const neutral: TShadow = { offsetX: 0, offsetY: 0, standardDeviation: 0, color: "transparent" }
      const a = before?.name === "dropShadow" ? before.value : neutral,
        b = after?.name === "dropShadow" ? after.value : neutral
      const concrete =
        typeof processColor(a.color as ColorValue) === "number" &&
        typeof processColor(b.color as ColorValue) === "number"
      if (!concrete && JSON.stringify(a.color) !== JSON.stringify(b.color)) return undefined
      mixers.push((progress) => ({
        name,
        value: {
          offsetX: a.offsetX + (b.offsetX - a.offsetX) * progress,
          offsetY: a.offsetY + (b.offsetY - a.offsetY) * progress,
          standardDeviation: a.standardDeviation + (b.standardDeviation - a.standardDeviation) * progress,
          color: concrete ? mixNativeSRGBColors(a.color as ColorValue, b.color as ColorValue, 1 - progress) : a.color,
        },
      }))
    } else {
      const a = before && before.name !== "dropShadow" ? before.value : FILTER_IDENTITIES[name],
        b = after && after.name !== "dropShadow" ? after.value : FILTER_IDENTITIES[name]
      mixers.push((progress) => ({ name, value: a + (b - a) * progress }))
    }
  }
  return (progress: number) => mixers.map((mix) => render(mix(progress)))
}
