import { I18nManager, type ViewStyle } from "react-native"

export type TPanelBorderBox = Readonly<{
  width: number
  height: number
  direction?: "ltr" | "rtl"
  platform: "android" | "ios"
}>
type TRadius = Readonly<{ panelRadius: true; points: number; percent: number; fallback: number | `${number}%` }>
const isRadius = (value: unknown): value is TRadius =>
  !!value && typeof value === "object" && "panelRadius" in value && value.panelRadius === true
const radius = (value: unknown): TRadius | undefined => {
  if (isRadius(value)) return value
  if (typeof value === "number" && Number.isFinite(value))
    return { panelRadius: true, points: Math.max(0, value), percent: 0, fallback: Math.max(0, value) }
  if (typeof value !== "string") return undefined
  const match = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))(%|px)$/.exec(value.trim())
  if (!match) return undefined
  const amount = Math.max(0, Number(match[1]))
  if (!Number.isFinite(amount)) return undefined
  return match[2] === "%"
    ? { panelRadius: true, points: 0, percent: amount / 100, fallback: `${amount}%` }
    : { panelRadius: true, points: amount, percent: 0, fallback: amount }
}
export const isPanelRadiusField = (field: string) => /^border.*Radius$/.test(field)
export const mixPanelRadius = (from: unknown, to: unknown) => {
  const first = radius(from),
    last = radius(to)
  if (!first || !last) return undefined
  return (progress: number): unknown => {
    const points = first.points + (last.points - first.points) * progress
    const percent = first.percent + (last.percent - first.percent) * progress
    if (!percent) return points
    if (!points) return `${percent * 100}%`
    return { panelRadius: true, points, percent, fallback: first.fallback } satisfies TRadius
  }
}
export const panelRadiusNeedsMeasurement = (style: ViewStyle) =>
  Object.entries(style).some(([field, value]) => {
    if (!isPanelRadiusField(field)) return false
    const resolved = radius(value)
    return resolved && (resolved.points > 0 || resolved.percent > 0)
  })

const cornerNames = ["topLeft", "topRight", "bottomLeft", "bottomRight"] as const
const physicalFields = [
  "borderTopLeftRadius",
  "borderTopRightRadius",
  "borderBottomLeftRadius",
  "borderBottomRightRadius",
]
const aliases = (rtl: boolean, android: boolean) => {
  if (!android)
    return [
      [
        "borderTopLeftRadius",
        rtl ? "borderTopEndRadius" : "borderTopStartRadius",
        rtl ? "borderStartEndRadius" : "borderStartStartRadius",
      ],
      [
        "borderTopRightRadius",
        rtl ? "borderTopStartRadius" : "borderTopEndRadius",
        rtl ? "borderStartStartRadius" : "borderStartEndRadius",
      ],
      [
        "borderBottomLeftRadius",
        rtl ? "borderBottomEndRadius" : "borderBottomStartRadius",
        rtl ? "borderEndEndRadius" : "borderEndStartRadius",
      ],
      [
        "borderBottomRightRadius",
        rtl ? "borderBottomStartRadius" : "borderBottomEndRadius",
        rtl ? "borderEndStartRadius" : "borderEndEndRadius",
      ],
    ]
  const swap = rtl && I18nManager.doLeftAndRightSwapInRTL
  return rtl
    ? [
        ["borderEndStartRadius", "borderTopEndRadius", swap ? "borderTopRightRadius" : "borderTopLeftRadius"],
        ["borderStartStartRadius", "borderTopStartRadius", swap ? "borderTopLeftRadius" : "borderTopRightRadius"],
        [
          "borderEndEndRadius",
          swap ? "borderBottomEndRadius" : "borderBottomStartRadius",
          swap ? "borderBottomRightRadius" : "borderBottomLeftRadius",
        ],
        [
          "borderStartEndRadius",
          swap ? "borderBottomStartRadius" : "borderBottomEndRadius",
          swap ? "borderBottomLeftRadius" : "borderBottomRightRadius",
        ],
      ]
    : [
        ["borderStartStartRadius", "borderTopStartRadius", "borderTopLeftRadius"],
        ["borderEndStartRadius", "borderTopEndRadius", "borderTopRightRadius"],
        ["borderStartEndRadius", "borderBottomStartRadius", "borderBottomLeftRadius"],
        ["borderEndEndRadius", "borderBottomEndRadius", "borderBottomRightRadius"],
      ]
}

export const getPanelRadiusDefault = (
  field: string,
  style: Readonly<Record<string, unknown>>,
  box?: TPanelBorderBox | null,
) => {
  if (field !== "borderRadius" && box?.direction) {
    const keys = aliases(box.direction === "rtl", box.platform === "android").find((keys) => keys.includes(field))
    const value = keys?.map((key) => style[key]).find((value) => value != null)
    if (value !== undefined) return value
  }
  return field === "borderRadius" ? 0 : (style.borderRadius ?? 0)
}

// Resolve CSS length/percentage mixtures against the original host's border box,
// then use the existing elliptical drawing receiver without leaking objects into RN style props.
export const resolvePanelRadii = (style: ViewStyle, box?: TPanelBorderBox | null) => {
  const view = { ...style } as Record<string, unknown>
  for (const [field, value] of Object.entries(view))
    if (isPanelRadiusField(field) && isRadius(value)) view[field] = value.fallback
  const logical = Object.entries(style).some(
    ([field, value]) =>
      value != null && isPanelRadiusField(field) && field !== "borderRadius" && !physicalFields.includes(field),
  )
  if (!box || (logical && !box.direction)) return { view: view as ViewStyle, radii: "" }
  const fields = style as Record<string, unknown>
  const resolved = aliases(box.direction === "rtl", box.platform === "android").map((keys) => {
    const value = keys.map((key) => fields[key]).find((value) => value != null) ?? fields.borderRadius ?? 0
    const entry = radius(value)
    return entry ? { x: entry.points + entry.percent * box.width, y: entry.points + entry.percent * box.height } : null
  })
  if (resolved.some((entry) => !entry)) return { view: view as ViewStyle, radii: "" }
  const [tl, tr, bl, br] = resolved as { x: number; y: number }[]
  const fit = (length: number, sum: number) => (sum > 0 ? length / sum : 1)
  // CSS Backgrounds §4.5 scales every corner by the same limiting edge ratio.
  const factor = Math.min(
    1,
    fit(box.width, tl.x + tr.x),
    fit(box.width, bl.x + br.x),
    fit(box.height, tl.y + bl.y),
    fit(box.height, tr.y + br.y),
  )
  return {
    view: view as ViewStyle,
    radii: JSON.stringify(
      Object.fromEntries(
        cornerNames.map((name, index) => [name, { x: resolved[index]!.x * factor, y: resolved[index]!.y * factor }]),
      ),
    ),
  }
}
