import type {
  AVAILABLE_ELEM_TYPES,
  AVAILABLE_FONT_STYLES,
  AVAILABLE_FONT_VARIANTS,
  AVAILABLE_FONT_WEIGHTS,
} from "./constants"

export type TAvailableFontWeights = (typeof AVAILABLE_FONT_WEIGHTS)[number]
export type TAvailableFontStyles = (typeof AVAILABLE_FONT_STYLES)[number]
export type TAvailableFontVariants = (typeof AVAILABLE_FONT_VARIANTS)[number]
export type TAvailableElementTypes = (typeof AVAILABLE_ELEM_TYPES)[number]
