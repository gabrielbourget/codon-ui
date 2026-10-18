import type { StyleProp, ViewStyle } from "react-native"

import type { TNativeTheme } from "../../theme/types"
import { AVAILABLE_THEMING_ORDER_CODES } from "../../tokens/theme-order"
import { resolveNativeStyle, validateNativeColor } from "../colors"
import { validateNativeDisplayDimension } from "../displayDimensions"

import {
  AVAILABLE_NATIVE_STROKE_LINECAPS,
  type TNativeCircularProgressProps,
  type TNativeCircularProgressRenderState,
  type TNativeCircularProgressRootStyle,
  type TNativeCircularProgressSVGStyle,
  type TNativeCircularProgressPathStyle,
  type TNativeCircularProgressTextStyle,
  type TNativeCircularProgressBackgroundStyle,
} from "./types"

export const resolveNativeCircularStyle = <T extends ViewStyle>(style: StyleProp<T>, field: string): T => {
  const resolved = resolveNativeStyle(style, "CircularProgress", field)
  for (const key of ["fill", "stroke"] as const) {
    const value = (resolved as { fill?: unknown; stroke?: unknown })[key]
    if (value !== "none" && value !== "currentColor" && value !== "context-fill" && value !== "context-stroke")
      validateNativeColor(value, "CircularProgress", `${field}.${key}`)
  }
  const visited = new WeakSet<object>()
  const validateNumbers = (value: unknown) => {
    if (typeof value === "number" && !Number.isFinite(value))
      throw new TypeError(`CircularProgress: ${field} cannot contain nonfinite native drawing data`)
    if (value && typeof value === "object") {
      if (visited.has(value)) return
      visited.add(value)
      if (Array.isArray(value)) value.forEach(validateNumbers)
      else Object.values(value).forEach(validateNumbers)
    }
  }
  validateNumbers(resolved)
  return resolved
}

export const getNativeCircularStyles = (
  theme: TNativeTheme,
  props: TNativeCircularProgressProps,
  state: TNativeCircularProgressRenderState,
) => {
  const { height, width, pathColor, trackColor, backgroundColor, order, strokeLineCap = "butt" } = props
  validateNativeDisplayDimension(height, "CircularProgress", "height")
  validateNativeDisplayDimension(width, "CircularProgress", "width")
  for (const [name, value] of Object.entries({ pathColor, trackColor, backgroundColor }))
    validateNativeColor(value, "CircularProgress", name)
  if (!AVAILABLE_NATIVE_STROKE_LINECAPS.includes(strokeLineCap))
    throw new TypeError("CircularProgress: unsupported strokeLineCap")
  if (order !== undefined && !AVAILABLE_THEMING_ORDER_CODES.includes(order))
    throw new TypeError("CircularProgress: unsupported order")
  const baseline: TNativeCircularProgressRootStyle = {
    width: width ?? 100,
    height: height ?? 100,
    ...resolveNativeStyle(props.customStyles, "CircularProgress", "customStyles"),
  }
  const root = resolveNativeStyle(
    [baseline, typeof props.style === "function" ? props.style({ ...state, defaultStyle: baseline }) : props.style],
    "CircularProgress",
    "style",
  )
  const orderColors = {
    primary: theme.colors.controlSelectedBackground,
    secondary: theme.colors.controlPressedBackground,
    tertiary: theme.colors.statusSuccess,
    quaternary: theme.colors.statusWarning,
    quintenary: theme.colors.statusDanger,
  }
  const svg = resolveNativeCircularStyle<TNativeCircularProgressSVGStyle>(props.customSVGStyles, "customSVGStyles")
  validateNativeDisplayDimension(svg.width, "CircularProgress", "customSVGStyles.width")
  validateNativeDisplayDimension(svg.height, "CircularProgress", "customSVGStyles.height")
  return {
    root,
    svg,
    path: resolveNativeCircularStyle<TNativeCircularProgressPathStyle>(
      [
        {
          color: pathColor,
          stroke: !pathColor && order ? orderColors[order] : theme.colors.controlSelectedBackground,
          strokeLinecap: strokeLineCap,
        },
        props.customPathStyles,
      ],
      "customPathStyles",
    ),
    track: resolveNativeCircularStyle<TNativeCircularProgressPathStyle>(
      [
        { color: trackColor, stroke: theme.mode === "dark" ? "#202020" : "#f7f7f7", strokeLinecap: strokeLineCap },
        props.customTrackStyles,
      ],
      "customTrackStyles",
    ),
    background: resolveNativeCircularStyle<TNativeCircularProgressBackgroundStyle>(
      [{ backgroundColor, fill: theme.colors.background }, props.customBackgroundStyles],
      "customBackgroundStyles",
    ),
    text: resolveNativeCircularStyle<TNativeCircularProgressTextStyle>(
      [
        {
          fill: theme.colors.foreground,
          fontFamily: theme.typography.fontFamilies.body,
          fontSize: 24,
          alignmentBaseline: "middle",
          textAnchor: "middle",
        },
        props.customTextStyles,
      ],
      "customTextStyles",
    ),
  }
}

// SVG presentation properties must be props: the pinned extractor lets props override style.
export const nativeCircularPresentation = (style: ViewStyle) => {
  const view = { ...style } as Record<string, unknown>
  const presentation: Record<string, unknown> = {}
  for (const key of [
    "color",
    "fill",
    "fillOpacity",
    "fillRule",
    "stroke",
    "strokeWidth",
    "strokeOpacity",
    "strokeLinecap",
    "strokeLinejoin",
    "strokeMiterlimit",
    "strokeDasharray",
    "strokeDashoffset",
    "vectorEffect",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "fontStyle",
    "fontVariant",
    "fontStretch",
    "letterSpacing",
    "wordSpacing",
    "textAnchor",
    "alignmentBaseline",
    "baselineShift",
    "x",
    "y",
    "dx",
    "dy",
    "rotate",
    "textLength",
    "lengthAdjust",
    "cx",
    "cy",
    "r",
  ]) {
    if (view[key] !== undefined) presentation[key] = view[key]
    delete view[key]
  }
  return { ...presentation, style: view } as import("react-native-svg").TextProps &
    import("react-native-svg").CircleProps
}
