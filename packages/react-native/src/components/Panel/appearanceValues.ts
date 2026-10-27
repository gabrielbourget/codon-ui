import { processColor, type BoxShadowValue, type ColorValue, type TextStyle } from "react-native"

import { mixNativeSRGBColors } from "../colors"

import { createPanelFilterMixer } from "./filters"
import { getPanelRadiusDefault, isPanelRadiusField, mixPanelRadius, type TPanelBorderBox } from "./radii"

type TMixer = (progress: number) => unknown
export type TPanelAppearanceBounds = Readonly<{
  width: number
  height: number
  content?: Readonly<{ width: number; height: number }> | null
  border?: TPanelBorderBox | null
}>
const GAP_FIELDS = new Set(["gap", "rowGap", "columnGap"])

const NUMBER_FIELDS = new Set([
  "opacity",
  "elevation",
  "flex",
  "flexGrow",
  "flexShrink",
  "zIndex",
  "borderWidth",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderStartWidth",
  "borderEndWidth",
  "outlineWidth",
  "outlineOffset",
  "shadowOpacity",
  "shadowRadius",
  "fontSize",
  "letterSpacing",
  "lineHeight",
  "textShadowRadius",
])
const DIMENSION_FIELDS = new Set([
  "width",
  "height",
  "minWidth",
  "minHeight",
  "maxWidth",
  "maxHeight",
  "top",
  "bottom",
  "left",
  "right",
  "start",
  "end",
  "inset",
  "insetBlock",
  "insetBlockStart",
  "insetBlockEnd",
  "insetInline",
  "insetInlineStart",
  "insetInlineEnd",
  "flexBasis",
  "margin",
  "marginHorizontal",
  "marginVertical",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "marginStart",
  "marginEnd",
  "padding",
  "paddingHorizontal",
  "paddingVertical",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "paddingStart",
  "paddingEnd",
])
const RADIUS_FIELDS = /^border.*Radius$/
const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value)
const aspectRatioNumber = (value: unknown) => {
  if (isNumber(value)) return value > 0 ? value : undefined
  if (typeof value !== "string") return undefined
  const match =
    /^\s*(\+?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*(?:\/\s*(\+?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?))?\s*$/i.exec(
      value,
    )
  if (!match) return undefined
  const numerator = Number(match[1]),
    denominator = Number(match[2] ?? 1)
  const ratio = numerator / denominator
  return isNumber(numerator) &&
    numerator > 0 &&
    isNumber(denominator) &&
    denominator > 0 &&
    isNumber(ratio) &&
    ratio > 0
    ? ratio
    : undefined
}
const numberMixer =
  (from: number, to: number): TMixer =>
  (progress) =>
    from + (to - from) * progress
const dimension = (value: unknown) => {
  if (isNumber(value)) return { value, percent: false }
  if (typeof value !== "string") return undefined
  const match = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))(%|px)$/.exec(value.trim())
  return match ? { value: Number(match[1]), percent: match[2] === "%" } : undefined
}
const colorMixer = (from: unknown, to: unknown): TMixer | undefined => {
  if (processColor(from as ColorValue) == null || processColor(to as ColorValue) == null) return undefined
  if (JSON.stringify(stableValue(from)) === JSON.stringify(stableValue(to))) return () => from
  if (typeof processColor(from as ColorValue) !== "number" || typeof processColor(to as ColorValue) !== "number")
    return undefined
  return (progress) => mixNativeSRGBColors(from as ColorValue, to as ColorValue, 1 - progress)
}

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([first], [last]) => first.localeCompare(last))
        .map(([key, entry]) => [key, stableValue(entry)]),
    )
  return value
}
export const arePanelAppearanceValuesEqual = (field: string, first: unknown, last: unknown) => {
  if (field === "aspectRatio") {
    const a = aspectRatioNumber(first),
      b = aspectRatioNumber(last)
    if (a !== undefined && b !== undefined) return a === b
  }
  if (field === "color" || field.endsWith("Color")) {
    const a = processColor(first as ColorValue)
    const b = processColor(last as ColorValue)
    if (typeof a === "number" && typeof b === "number") return a === b
  }
  return JSON.stringify(stableValue(first)) === JSON.stringify(stableValue(last))
}

const shadowList = (value: unknown): BoxShadowValue[] | undefined => {
  if (value === undefined || value === "none") return []
  if (Array.isArray(value)) return value as BoxShadowValue[]
  if (typeof value !== "string") return undefined
  const result: BoxShadowValue[] = []
  for (const source of value.split(/,(?![^()]*\))/).filter((part) => part.trim())) {
    const lengths: number[] = []
    const shadow: BoxShadowValue = { offsetX: 0, offsetY: 0 }
    let endedLengths = false
    for (const token of source.trim().split(/\s+(?![^(]*\))/)) {
      if (token === "inset" && shadow.inset === undefined) {
        shadow.inset = true
        endedLengths ||= lengths.length > 0
      } else if (processColor(token) != null && shadow.color === undefined) {
        shadow.color = token
        endedLengths ||= lengths.length > 0
      } else {
        const length = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))(px)?$/.exec(token)
        if (!length || (!length[2] && Number(length[1]) !== 0) || endedLengths || lengths.length === 4) return undefined
        lengths.push(Number(length[1]))
      }
    }
    if (lengths.length < 2 || (lengths[2] ?? 0) < 0) return undefined
    shadow.offsetX = lengths[0]
    shadow.offsetY = lengths[1]
    shadow.blurRadius = lengths[2]
    shadow.spreadDistance = lengths[3]
    result.push(shadow)
  }
  return result
}

const boxShadowMixer = (from: unknown, to: unknown, foreground: unknown): TMixer | undefined => {
  const previous = shadowList(from)
  const next = shadowList(to)
  if (!previous || !next) return undefined
  const mixers: ((progress: number) => BoxShadowValue)[] = []
  for (let index = 0; index < Math.max(previous.length, next.length); index++) {
    const before = previous[index]
    const after = next[index]
    if (before && after && !!before.inset !== !!after.inset) return undefined
    const first = before ?? { offsetX: 0, offsetY: 0, color: "transparent" }
    const last = after ?? { offsetX: 0, offsetY: 0, color: "transparent" }
    const values = (["offsetX", "offsetY", "blurRadius", "spreadDistance"] as const).map((field) => {
      const a = dimension(first[field] ?? 0)
      const b = dimension(last[field] ?? 0)
      return a && b && !a.percent && !b.percent ? numberMixer(a.value, b.value) : undefined
    })
    const color = colorMixer(first.color ?? foreground, last.color ?? foreground)
    if (values.some((mixer) => !mixer) || !color) return undefined
    mixers.push((progress) => ({
      offsetX: values[0]!(progress) as number,
      offsetY: values[1]!(progress) as number,
      blurRadius: values[2]!(progress) as number,
      spreadDistance: values[3]!(progress) as number,
      color: color(progress) as ColorValue,
      inset: before?.inset ?? after?.inset,
    }))
  }
  return (progress) => mixers.map((mixer) => mixer(progress))
}

export const resolvePanelBoxShadow = (value: unknown, foreground: ColorValue) => {
  const shadows = shadowList(value)
  if (!shadows || shadows.every((shadow) => shadow.color !== undefined)) return value
  return shadows.map((shadow) => ({ ...shadow, color: shadow.color ?? foreground }))
}

export const getPanelAppearanceDefault = (
  field: string,
  style: Readonly<Record<string, unknown>>,
  textDefaults: Pick<TextStyle, "color" | "fontSize" | "fontWeight" | "lineHeight">,
  borderBox?: TPanelBorderBox | null,
): unknown => {
  if (field === "opacity") return 1
  if (field === "aspectRatio" || field === "zIndex" || field === "flex") return undefined
  if (field === "fontWeight") return textDefaults.fontWeight ?? "normal"
  if (field === "fontSize" || field === "lineHeight") return textDefaults[field]
  if (field === "boxShadow") return undefined
  if (field === "filter") return []
  if (GAP_FIELDS.has(field)) return field === "gap" ? 0 : (style.gap ?? 0)
  if (field === "shadowOffset" || field === "textShadowOffset") return { width: 0, height: 0 }
  if (field.endsWith("Color") || field === "color") {
    if (field === "shadowColor") return "black"
    if (field.startsWith("border") && field !== "borderColor")
      return style.borderColor ?? style.color ?? textDefaults.color
    return field === "backgroundColor" ? "transparent" : (style.color ?? textDefaults.color)
  }
  if (RADIUS_FIELDS.test(field)) return getPanelRadiusDefault(field, style, borderBox)
  if (field.startsWith("border") && field.endsWith("Width")) return style.borderWidth ?? 0
  const spacing = /^(padding|margin)(Top|Right|Bottom|Left|Start|End|Horizontal|Vertical)?$/.exec(field)
  if (spacing) {
    const axis = ["Top", "Bottom"].includes(spacing[2]) ? "Vertical" : "Horizontal"
    return (spacing[2] && style[`${spacing[1]}${axis}`]) ?? style[spacing[1]] ?? 0
  }
  if (NUMBER_FIELDS.has(field)) return 0
  return undefined
}

export const createPanelAppearanceMixer = (
  field: string,
  from: unknown,
  to: unknown,
  bounds: TPanelAppearanceBounds,
  foreground: unknown,
): TMixer | undefined => {
  if (field.endsWith("Color") || field === "color") return colorMixer(from, to)
  if (field === "boxShadow") return boxShadowMixer(from, to, foreground)
  if (field === "filter") return createPanelFilterMixer(from, to, foreground as ColorValue)
  if (isPanelRadiusField(field)) return mixPanelRadius(from, to)
  if (field === "shadowOffset" || field === "textShadowOffset") {
    const first = from as { width?: unknown; height?: unknown } | undefined
    const last = to as { width?: unknown; height?: unknown } | undefined
    if (!isNumber(first?.width) || !isNumber(first.height) || !isNumber(last?.width) || !isNumber(last.height))
      return undefined
    const width = numberMixer(first.width, last.width)
    const height = numberMixer(first.height, last.height)
    return (progress) => ({ width: width(progress), height: height(progress) })
  }
  // Fabric's FontWeight decoder accepts only100-step weights; arbitrary CSS weight interpolation remains required.
  if (field === "fontWeight") return undefined
  if (field === "aspectRatio") {
    const first = aspectRatioNumber(from),
      last = aspectRatioNumber(to)
    if (first === undefined || last === undefined) return undefined
    // CSS Values §5.7.1 interpolates ratios in logarithmic space.
    const firstLog = Math.log(first)
    const lastLog = Math.log(last)
    return (progress) =>
      progress === 0 ? first : progress === 1 ? last : Math.exp(firstLog + (lastLog - firstLog) * progress)
  }
  if (field === "zIndex")
    return isNumber(from) && isNumber(to) && Number.isInteger(from) && Number.isInteger(to)
      ? (progress) => Math.round(from + (to - from) * progress) || 0
      : undefined
  if (GAP_FIELDS.has(field)) {
    const first = dimension(from)
    const last = dimension(to)
    if (!first || !last) return undefined
    const start = Math.max(0, first.value)
    const end = Math.max(0, last.value)
    if (first.percent === last.percent) {
      const mix = numberMixer(start, end)
      return first.percent ? (progress) => `${mix(progress)}%` : mix
    }
    if (field === "gap") return undefined
    return (progress) => {
      const basis = field === "rowGap" ? bounds.content?.height : bounds.content?.width
      if (basis === undefined) return from
      return (
        start * (first.percent ? basis / 100 : 1) * (1 - progress) + end * (last.percent ? basis / 100 : 1) * progress
      )
    }
  }
  if (NUMBER_FIELDS.has(field)) return isNumber(from) && isNumber(to) ? numberMixer(from, to) : undefined
  if (!DIMENSION_FIELDS.has(field) && !RADIUS_FIELDS.test(field)) return undefined
  const first = dimension(from)
  const last = dimension(to)
  if (!first || !last) return undefined
  if (first.percent === last.percent) {
    const mixer = numberMixer(first.value, last.value)
    return first.percent ? (progress) => `${mixer(progress)}%` : mixer
  }
  if (field === "flexBasis") return undefined
  return (progress) => {
    const basis = /^(height|minHeight|maxHeight|top|bottom|insetBlock.*)$/.test(field) ? bounds.height : bounds.width
    const start = first.value * (first.percent ? basis / 100 : 1)
    const end = last.value * (last.percent ? basis / 100 : 1)
    return start + (end - start) * progress
  }
}
