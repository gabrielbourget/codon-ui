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
