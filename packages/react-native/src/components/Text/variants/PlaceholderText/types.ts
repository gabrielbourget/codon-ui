import type { TNativeTextProps, TNativeTextRef } from "../../types"

export const PLACEHOLDER_TEXT_ALIGNMENT__LEFT = "left"
export const PLACEHOLDER_TEXT_ALIGNMENT__CENTER = "center"
export const AVAILABLE_PLACEHOLDER_TEXT_ALIGNMENTS = [
  PLACEHOLDER_TEXT_ALIGNMENT__LEFT,
  PLACEHOLDER_TEXT_ALIGNMENT__CENTER,
] as const
export type TNativePlaceholderTextAlignment = (typeof AVAILABLE_PLACEHOLDER_TEXT_ALIGNMENTS)[number]
export type TNativePlaceholderTextRef = TNativeTextRef
export type TNativePlaceholderTextProps = Omit<TNativeTextProps, "color" | "variant" | "fontStyle" | "fontWeight"> & {
  align?: TNativePlaceholderTextAlignment
}
