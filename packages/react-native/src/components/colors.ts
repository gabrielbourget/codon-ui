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
      if (shadow && typeof shadow === "object" && "color" in shadow) {
        validateNativeColor(shadow.color, component, `${field}.boxShadow[${index}].color`)
      }
    }
  }
  if (typeof values.boxShadow === "string" && /var\(|currentcolor/i.test(values.boxShadow)) {
    throw new TypeError(`${component}: unsupported native color in ${field}.boxShadow`)
  }
  return resolved
}
