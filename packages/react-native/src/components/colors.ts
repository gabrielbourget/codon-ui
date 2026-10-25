import { processColor, StyleSheet, type ColorValue, type StyleProp, type TextStyle, type ViewStyle } from "react-native"

const COLOR_FIELDS = [
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
] as const

export const validateNativeColor = (value: unknown, component: string, field: string) => {
  if (value === undefined || value === null) return
  const processed = processColor(value as ColorValue)
  if (processed === null || processed === undefined) {
    throw new TypeError(`${component}: unsupported native color in ${field}; use an RN color instead of CSS variables`)
  }
}

const splitNativeStyleString = (value: string, separator: RegExp) => {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let index = 0; index < value.length; index++) {
    if (value[index] === "(") depth++
    else if (value[index] === ")") depth--
    else if (depth === 0 && separator.test(value[index])) {
      const part = value.slice(start, index).trim()
      if (part) parts.push(part)
      start = index + 1
    }
  }
  const last = value.slice(start).trim()
  if (last) parts.push(last)
  return parts
}

const validateNativeShadowColors = (value: unknown, component: string, field: string, allowInset = false) => {
  if (typeof value === "string") {
    for (const token of splitNativeStyleString(value, /\s/)) {
      if (/^[+-]?\d*\.?\d+(?:px)?$/.test(token) || (allowInset && token === "inset")) continue
      validateNativeColor(token, component, `${field}.color`)
    }
  } else if (value && typeof value === "object" && "color" in value) {
    validateNativeColor(value.color, component, `${field}.color`)
  }
}

const validateNativeFilterColors = (value: unknown, component: string, field: string) => {
  if (Array.isArray(value)) {
    for (const [index, filter] of value.entries()) {
      if (filter && typeof filter === "object" && "dropShadow" in filter) {
        validateNativeShadowColors(filter.dropShadow, component, `${field}[${index}].dropShadow`)
      }
    }
  } else if (typeof value === "string") {
    const functions = /([\w-]+)\s*\(/g
    let match = functions.exec(value)
    let filterIndex = 0
    while (match) {
      const start = functions.lastIndex
      let depth = 1
      let end = start
      for (; end < value.length && depth; end++) {
        if (value[end] === "(") depth++
        else if (value[end] === ")") depth--
      }
      if (match[1].toLowerCase() === "drop-shadow") {
        validateNativeShadowColors(
          value.slice(start, depth === 0 ? end - 1 : end),
          component,
          `${field}[${filterIndex}].dropShadow`,
        )
      }
      functions.lastIndex = end
      filterIndex++
      match = functions.exec(value)
    }
  }
}

export const resolveNativeStyle = <T extends TextStyle | ViewStyle>(
  style: StyleProp<T>,
  component: string,
  field: string,
): T => {
  const resolved = (StyleSheet.flatten(style) ?? {}) as T
  const values = resolved as Record<string, unknown>
  for (const key of COLOR_FIELDS) validateNativeColor(values[key], component, `${field}.${key}`)
  if (Array.isArray(values.boxShadow)) {
    for (const [index, shadow] of values.boxShadow.entries()) {
      validateNativeShadowColors(shadow, component, `${field}.boxShadow[${index}]`, true)
    }
  } else if (typeof values.boxShadow === "string") {
    for (const [index, shadow] of splitNativeStyleString(values.boxShadow, /,/).entries()) {
      validateNativeShadowColors(shadow, component, `${field}.boxShadow[${index}]`, true)
    }
  }
  validateNativeFilterColors(values.filter, component, `${field}.filter`)
  return resolved
}

export const mixNativeSRGBColors = (color: ColorValue, other: ColorValue, ratio: number): ColorValue => {
  const first = processColor(color),
    second = processColor(other)
  if (typeof first !== "number" || typeof second !== "number") return color
  const a = ((first >>> 24) / 255) * ratio,
    b = ((second >>> 24) / 255) * (1 - ratio),
    alpha = a + b
  const channel = (shift: number) =>
    alpha ? Math.round((((first >>> shift) & 255) * a + ((second >>> shift) & 255) * b) / alpha) : 0
  return `rgba(${channel(16)}, ${channel(8)}, ${channel(0)}, ${alpha})`
}
