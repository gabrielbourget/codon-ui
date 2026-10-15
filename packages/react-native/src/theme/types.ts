import type { ColorValue, TextStyle } from "react-native"

import type { TThemingOrderCode } from "../tokens/theme-order"

export const AVAILABLE_NATIVE_THEME_MODES = ["light", "dark"] as const
export type TNativeThemeMode = (typeof AVAILABLE_NATIVE_THEME_MODES)[number]

export const AVAILABLE_FONT_VARIANTS = [
  "d1",
  "d2",
  "d3",
  "d4",
  "d5",
  "d6",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "h1-sm",
  "h2-sm",
  "h3-sm",
  "h4-sm",
  "h5-sm",
  "h6-sm",
  "b1",
  "b2",
  "b3",
  "b4",
  "b5",
  "b6",
  "b7",
  "b8",
  "b9",
  "b10",
  "b11",
  "b12",
  "b13",
] as const
export type TNativeFontVariant = (typeof AVAILABLE_FONT_VARIANTS)[number]
export const AVAILABLE_FONT_WEIGHTS = ["light", "regular", "medium", "semibold", "bold", "extrabold"] as const
export type TNativeFontWeight = (typeof AVAILABLE_FONT_WEIGHTS)[number]

export type TNativeActionTheme = Readonly<{
  background: ColorValue
  hoverBackground: ColorValue
  pressedBackground: ColorValue
  foreground: ColorValue
  border: ColorValue
  outlineBackground: ColorValue
  outlineHoverBackground: ColorValue
  outlinePressedBackground: ColorValue
}>

export type TNativeTheme = Readonly<{
  mode: TNativeThemeMode
  colors: Readonly<{
    overlayBackdrop: ColorValue
    background: ColorValue
    foreground: ColorValue
    controlBackground: ColorValue
    controlForeground: ColorValue
    controlBorder: ColorValue
    focusRing: ColorValue
    controlPlaceholder: ColorValue
    controlHoverBackground: ColorValue
    controlPressedBackground: ColorValue
    controlSelectedBackground: ColorValue
    controlSelectedHoverBackground: ColorValue
    controlSelectedPressedBackground: ColorValue
    controlSelectedForeground: ColorValue
    controlTrackBackground: ColorValue
    controlTrackInvertedBackground: ColorValue
    validationErrorBorder: ColorValue
    validationWarningBorder: ColorValue
    validationSuccessBorder: ColorValue
  }>
  actions: Readonly<Record<TThemingOrderCode, TNativeActionTheme>>
  spacing: Readonly<{ unit: number }>
  radius: Readonly<{ rounded: number; round: number }>
  opacity: Readonly<{ disabled: number }>
  typography: Readonly<{
    fontFamilies: Readonly<{ body?: string; heading?: string; display?: string }>
    fontSizes: Readonly<Record<TNativeFontVariant, number>>
    fontWeights: Readonly<Record<TNativeFontWeight, TextStyle["fontWeight"]>>
    lineHeight?: number
  }>
}>

export type TNativeThemeOverrides = Readonly<{
  colors?: Partial<TNativeTheme["colors"]>
  actions?: Partial<Record<TThemingOrderCode, Partial<TNativeActionTheme>>>
  spacing?: Partial<TNativeTheme["spacing"]>
  radius?: Partial<TNativeTheme["radius"]>
  opacity?: Partial<TNativeTheme["opacity"]>
  typography?: Readonly<{
    fontFamilies?: Partial<TNativeTheme["typography"]["fontFamilies"]>
    fontSizes?: Partial<TNativeTheme["typography"]["fontSizes"]>
    fontWeights?: Partial<TNativeTheme["typography"]["fontWeights"]>
    lineHeight?: number
  }>
}>
