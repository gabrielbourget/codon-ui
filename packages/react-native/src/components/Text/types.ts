import type { ComponentRef } from "react"
import type { ColorValue, StyleProp, Text as NativeText, TextProps, TextStyle } from "react-native"

import type { TNativeFontVariant, TNativeFontWeight } from "../../theme/types"

export const AVAILABLE_NATIVE_TEXT_ELEMENT_TYPES = [
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "section",
  "span",
  "strong",
  "label",
  "legend",
] as const
export type TNativeTextElementType = (typeof AVAILABLE_NATIVE_TEXT_ELEMENT_TYPES)[number]
export type TNativeTextRef = ComponentRef<typeof NativeText>

export type TNativeTextProps = Omit<TextProps, "style" | "aria-label"> & {
  slot?: string | null
  variant?: TNativeFontVariant
  fontWeight?: TNativeFontWeight
  fontStyle?: "italic"
  elementType?: TNativeTextElementType
  composedInLink?: boolean
  color?: ColorValue
  customStyles?: StyleProp<TextStyle>
  style?: StyleProp<TextStyle>
  "data-testid"?: string
  "aria-label"?: string
}
