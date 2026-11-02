import type { TextStyle, ViewStyle } from "react-native"

const textFields = [
  "color",
  "fontFamily",
  "fontSize",
  "fontStyle",
  "fontWeight",
  "fontVariant",
  "letterSpacing",
  "lineHeight",
  "textAlign",
  "textAlignVertical",
  "verticalAlign",
  "includeFontPadding",
  "textDecorationLine",
  "textDecorationStyle",
  "textDecorationColor",
  "textShadowColor",
  "textShadowOffset",
  "textShadowRadius",
  "textTransform",
  "writingDirection",
  "userSelect",
] as const
export const splitNativeTextStyle = (style: TextStyle) => {
  const view = { ...style },
    text: TextStyle = {}
  for (const key of textFields) {
    if (Object.hasOwn(view, key)) Object.assign(text, { [key]: view[key] })
    delete view[key]
  }
  return { view: view as ViewStyle, text }
}

const NATIVE_FONT_WEIGHTS = new Set<unknown>([
  "normal",
  "bold",
  "100",
  "200",
  "300",
  "400",
  "500",
  "600",
  "700",
  "800",
  "900",
  100,
  200,
  300,
  400,
  500,
  600,
  700,
  800,
  900,
  "ultralight",
  "thin",
  "light",
  "medium",
  "regular",
  "semibold",
  "condensedBold",
  "condensed",
  "heavy",
  "black",
])

export const validateNativeFontWeight = (fontWeight: unknown, component: string) => {
  if (fontWeight != null && !NATIVE_FONT_WEIGHTS.has(fontWeight))
    throw new TypeError(
      `${component}: fontWeight must use a stock React Native weight; migrate custom scalar weights explicitly`,
    )
}
