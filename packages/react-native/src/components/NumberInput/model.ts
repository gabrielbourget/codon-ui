import { NumberFormatter, NumberParser } from "@internationalized/number"

import type { TNativeNumberInputFormatOptions } from "./types"

type TNumberConfiguration = {
  locale?: string
  formatOptions?: TNativeNumberInputFormatOptions
  minValue?: number
  maxValue?: number
  step?: number
}
const invalid = (field: string): never => {
  throw new TypeError(`NumberInput: invalid ${field}`)
}
const safe = (value: number) => (Number.isSafeInteger(value) ? value : undefined)

// Decimal strings avoid interpreting multiplication's binary tails as authored precision.
export const decimalUnits = (value: number, precision: number, round = false): number | undefined => {
  if (!Number.isFinite(value)) return undefined
  const [mantissa = "", exponent = "0"] = Math.abs(value).toString().toLowerCase().split("e")
  const [whole = "", fraction = ""] = mantissa.split(".")
  const digits = whole + fraction
  const length = whole.length + Number(exponent) + precision
  const kept = length <= 0 ? "0" : digits.slice(0, length).padEnd(length, "0")
  const discarded = length < 0 ? "0".repeat(-length) + digits : digits.slice(length)
  if (!round && /[1-9]/.test(discarded)) return undefined
  const magnitude = Number(kept) + (round && (discarded[0] ?? "0") >= "5" ? 1 : 0)
  const units = safe(magnitude * (value < 0 ? -1 : 1))
  return units === 0 ? 0 : units
}

export const createNumberModel = ({
  locale = "en-US",
  formatOptions = {},
  minValue,
  maxValue,
  step,
}: TNumberConfiguration) => {
  const allowed = ["style", "useGrouping", "minimumFractionDigits", "maximumFractionDigits"]
  if (
    !formatOptions ||
    typeof formatOptions !== "object" ||
    Array.isArray(formatOptions) ||
    Object.keys(formatOptions).some((key) => !allowed.includes(key))
  )
    invalid("formatOptions")
  if (formatOptions.style !== undefined && formatOptions.style !== "decimal") invalid("formatOptions.style")
  if (formatOptions.useGrouping !== undefined && typeof formatOptions.useGrouping !== "boolean")
    invalid("formatOptions.useGrouping")
  for (const field of ["minimumFractionDigits", "maximumFractionDigits"] as const)
    if (formatOptions[field] !== undefined && typeof formatOptions[field] !== "number")
      invalid(`formatOptions.${field}`)
  const minimumFractionDigits = formatOptions.minimumFractionDigits ?? 0
  const maximumFractionDigits = formatOptions.maximumFractionDigits ?? Math.max(3, minimumFractionDigits)
  for (const digits of [minimumFractionDigits, maximumFractionDigits])
    if (!Number.isInteger(digits) || digits < 0 || digits > 6) invalid("fraction digits (expected 0..6)")
  if (minimumFractionDigits > maximumFractionDigits) invalid("fraction digit order")
  let canonicalLocale = locale
  try {
    if (typeof locale !== "string" || !locale) invalid("locale")
    const supportedLocales = Intl.NumberFormat.supportedLocalesOf([locale])
    if (supportedLocales.length !== 1) invalid("locale")
    canonicalLocale = supportedLocales[0] ?? invalid("locale")
  } catch {
    invalid("locale/Intl support")
  }
  const options = {
    style: "decimal" as const,
    useGrouping: formatOptions.useGrouping ?? true,
    minimumFractionDigits,
    maximumFractionDigits,
  }
  const formatter = new NumberFormatter(canonicalLocale, options)
  const parser = new NumberParser(canonicalLocale, options)
  try {
    if (!formatter.formatToParts(0).some((part) => part.type === "integer")) invalid("Intl number parts")
  } catch {
    throw new TypeError(
      "NumberInput: Intl.NumberFormat.formatToParts is required; initialize consumer Intl support before importing Codon UI",
    )
  }
  const resolved = formatter.resolvedOptions()
  const requestedNumberingSystem = canonicalLocale.match(/-u-(?:[a-z0-9]+-)*nu-([a-z0-9]+)/i)?.[1]
  if (requestedNumberingSystem && resolved.numberingSystem !== requestedNumberingSystem)
    invalid("Intl numbering system support")
  if (
    resolved.maximumFractionDigits !== maximumFractionDigits ||
    resolved.minimumFractionDigits !== minimumFractionDigits
  )
    invalid("Intl fraction support")
  const scale = 10 ** maximumFractionDigits
  const requireUnits = (value: number, field: string) => decimalUnits(value, maximumFractionDigits) ?? invalid(field)
  const min = minValue === undefined ? undefined : requireUnits(minValue, "minValue")
  const max = maxValue === undefined ? undefined : requireUnits(maxValue, "maxValue")
  if (min !== undefined && max !== undefined && min > max) invalid("bounds order")
  const increment = step === undefined ? scale : requireUnits(step, "step")
  if (increment <= 0) invalid("step (expected positive)")
  const anchor = min ?? 0
  const number = (units: number) => {
    const value = units === 0 ? 0 : units / scale
    return decimalUnits(value, maximumFractionDigits) === units ? value : undefined
  }
  const parse = (raw: string): number | null | undefined => {
    if (!raw.trim() || !parser.isValidPartialNumber(raw)) return undefined
    const parsed = parser.parse(raw)
    if (Number.isNaN(parsed)) return undefined
    return decimalUnits(parsed, maximumFractionDigits, true) ?? null
  }
  const clamp = (units: number) =>
    Math.min(max ?? Number.MAX_SAFE_INTEGER, Math.max(min ?? -Number.MAX_SAFE_INTEGER, units))
  const grid = (units: number, direction: -1 | 0 | 1) => {
    const distance = safe(units - anchor)
    if (distance === undefined) return undefined
    let index = Math.floor(distance / increment)
    const product = safe(index * increment)
    if (product === undefined) return undefined
    const remainder = safe(distance - product)
    if (remainder === undefined) return undefined
    if (direction === 1) index += 1
    else if (direction === -1 && remainder === 0) index -= 1
    else if (
      direction === 0 &&
      (remainder > increment - remainder || (remainder === increment - remainder && distance >= 0))
    )
      index += 1
    if (!Number.isSafeInteger(index)) return undefined
    const offset = safe(index * increment)
    return offset === undefined ? undefined : safe(anchor + offset)
  }
  const feasible = (units: number | undefined) =>
    units !== undefined && (min === undefined || units >= min) && (max === undefined || units <= max)
  const project = (units: number) => {
    let target = grid(units, 0)
    if (target !== undefined && min !== undefined && target < min) target = grid(min, 0)
    if (target !== undefined && max !== undefined && target > max) {
      target = grid(max, -1)
      // An exact grid maximum is itself feasible.
      if (grid(max, 0) === max) target = max
    }
    return feasible(target) ? target : undefined
  }
  return {
    key: JSON.stringify([locale, options, minValue, maxValue, step]),
    validateValue: (value: number | null | undefined, field: string) => {
      if (value !== null && value !== undefined) requireUnits(value, field)
    },
    format: (value: number | null) => (value === null ? "" : formatter.format(value === 0 ? 0 : value)),
    commit: (raw: string): { value: number | null } | undefined => {
      if (!raw.trim()) return { value: null }
      const parsed = parse(raw)
      if (parsed === undefined || parsed === null) return undefined
      const clamped = clamp(parsed)
      const result = step === undefined ? clamped : project(clamped)
      const value = result === undefined ? undefined : number(result)
      return value === undefined ? undefined : { value }
    },
    step: (raw: string, direction: -1 | 1): number | undefined => {
      const parsed = parse(raw)
      if (parsed === null) return undefined
      if (parsed === undefined) {
        const seed = direction === 1 ? (min ?? 0) : (max ?? 0)
        const result = project(seed)
        return result === undefined ? undefined : number(result)
      }
      let target = grid(parsed, direction)
      if (direction === 1 && min !== undefined && parsed < min) target = project(min)
      if (direction === -1 && max !== undefined && parsed > max) target = project(max)
      return feasible(target) && (direction === 1 ? target! > parsed : target! < parsed) ? number(target!) : undefined
    },
  }
}
