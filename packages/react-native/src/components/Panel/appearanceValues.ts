import { processColor, type BoxShadowValue, type ColorValue, type TextStyle } from "react-native"

import { mixNativeSRGBColors } from "../colors"

import { createPanelFilterMixer } from "./filters"

type TMixer = (progress: number) => unknown
export type TPanelAppearanceBounds = Readonly<{ width: number; height: number }>

const NUMBER_FIELDS = new Set([
  "opacity",
  "elevation",
  "flex",
  "flexGrow",
  "flexShrink",
  "aspectRatio",
  "zIndex",
  "gap",
  "rowGap",
  "columnGap",
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
): unknown => {
  if (field === "opacity") return 1
  if (field === "aspectRatio" || field === "zIndex" || field === "flex") return undefined
  if (field === "fontWeight") return textDefaults.fontWeight ?? "normal"
  if (field === "fontSize" || field === "lineHeight") return textDefaults[field]
  if (field === "boxShadow") return undefined
  if (field === "filter") return []
  if (field === "shadowOffset" || field === "textShadowOffset") return { width: 0, height: 0 }
  if (field.endsWith("Color") || field === "color") {
    if (field === "shadowColor") return "black"
    if (field.startsWith("border") && field !== "borderColor")
      return style.borderColor ?? style.color ?? textDefaults.color
    return field === "backgroundColor" ? "transparent" : (style.color ?? textDefaults.color)
  }
  if (RADIUS_FIELDS.test(field)) return style.borderRadius ?? 0
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
  if (NUMBER_FIELDS.has(field)) return isNumber(from) && isNumber(to) ? numberMixer(from, to) : undefined
  if (!DIMENSION_FIELDS.has(field) && !RADIUS_FIELDS.test(field)) return undefined
  const first = dimension(from)
  const last = dimension(to)
  if (!first || !last) return undefined
  if (first.percent === last.percent) {
    const mixer = numberMixer(first.value, last.value)
    return first.percent ? (progress) => `${mixer(progress)}%` : mixer
  }
  // A single RN radius cannot represent CSS's mixed-unit elliptical corners.
  if (RADIUS_FIELDS.test(field) || field === "flexBasis") return undefined
  return (progress) => {
    const basis = /^(height|minHeight|maxHeight|top|bottom|insetBlock.*)$/.test(field) ? bounds.height : bounds.width
    const start = first.value * (first.percent ? basis / 100 : 1)
    const end = last.value * (last.percent ? basis / 100 : 1)
    return start + (end - start) * progress
  }
}
