import { processColor, type TextStyle } from "react-native"

import { splitNativeTextStyle } from "./nativeTextStyle"

export const serializeNativeTypographyStyle = (style: TextStyle | undefined) => {
  if (!style) return undefined
  const text = splitNativeTextStyle(style).text
  const fields: Record<string, unknown> = Object.fromEntries(
    Object.entries(text).filter(([, value]) => value !== undefined && value !== null),
  )
  for (const field of ["color", "textDecorationColor", "textShadowColor"] as const) {
    const value = text[field]
    if (value !== undefined && value !== null) {
      const resolved = processColor(value)
      if (resolved === undefined || resolved === null) throw new Error(`Native typography: invalid ${field}`)
      fields[field] = resolved
    }
  }
  if (fields.verticalAlign !== undefined) {
    fields.textAlignVertical = fields.verticalAlign === "middle" ? "center" : fields.verticalAlign
    delete fields.verticalAlign
  }
  if (fields.userSelect !== undefined) {
    fields.selectable = fields.userSelect !== "none"
    delete fields.userSelect
  }
  return JSON.stringify(fields)
}
