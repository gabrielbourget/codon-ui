import type { ViewStyle } from "react-native"

export type TPanelLayoutLength = Readonly<{ points: number; percent: number }>
export type TPanelLayoutLengths = Readonly<Record<string, TPanelLayoutLength | undefined>>
export type TPanelViewportDefaults = Readonly<{ viewportHeight: boolean; viewportWidth: boolean }>

const LAYOUT_FIELDS = new Set([
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

export const getPanelLayoutLength = (field: string, value: unknown): TPanelLayoutLength | undefined => {
  if (!LAYOUT_FIELDS.has(field)) return undefined
  if (typeof value === "number" && Number.isFinite(value)) return { points: value, percent: 0 }
  if (typeof value !== "string") return undefined
  const match = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))(%|px)$/.exec(value.trim())
  if (!match || !Number.isFinite(Number(match[1]))) return undefined
  return match[2] === "%" ? { points: 0, percent: Number(match[1]) / 100 } : { points: Number(match[1]), percent: 0 }
}

export const getPanelLayoutLengths = (
  view: ViewStyle,
  bounds: Readonly<{ width: number; height: number }>,
  defaults?: TPanelViewportDefaults,
): TPanelLayoutLengths => ({
  ...Object.fromEntries(Object.entries(view).map(([field, value]) => [field, getPanelLayoutLength(field, value)])),
  // Browser transition keyframes snapshot computed viewport lengths in pixels.
  ...(defaults?.viewportHeight ? { height: { points: bounds.height, percent: 0 } } : {}),
  ...(defaults?.viewportWidth ? { width: { points: bounds.width < 500 ? bounds.width * 0.8 : 300, percent: 0 } } : {}),
})

export const mixPanelLayoutLength = (from: TPanelLayoutLength, to: TPanelLayoutLength) => (progress: number) => ({
  points: from.points + (to.points - from.points) * progress,
  percent: from.percent + (to.percent - from.percent) * progress,
})
