import { AVAILABLE_THEMING_ORDER_CODES } from "../tokens/theme-order"

import type { TNativeTheme, TNativeThemeMode, TNativeThemeOverrides } from "./types"

// Native sRGB values mirror the pinned web theme/action-colors roles; typography uses the reviewed 10-unit rem calibration.
const lightTheme: TNativeTheme = {
  mode: "light",
  colors: {
    background: "#ffffff",
    foreground: "#171717",
    controlBackground: "#ffffff",
    controlForeground: "#171717",
    controlBorder: "#9e9e9e",
    focusRing: "#2563eb",
  },
  actions: {
    primary: {
      background: "#2563eb",
      hoverBackground: "#2358cb",
      pressedBackground: "#2250b6",
      foreground: "#ffffff",
      border: "#2563eb",
      outlineBackground: "#ffffff",
      outlineHoverBackground: "#dee8fc",
      outlinePressedBackground: "#bed0f9",
    },
    secondary: {
      background: "#c6c6c6",
      hoverBackground: "#acacac",
      pressedBackground: "#9a9a9a",
      foreground: "#ffffff",
      border: "#c6c6c6",
      outlineBackground: "#ffffff",
      outlineHoverBackground: "#f6f6f6",
      outlinePressedBackground: "#eeeeee",
    },
    tertiary: {
      background: "#2f7d18",
      hoverBackground: "#2b6e18",
      pressedBackground: "#296418",
      foreground: "#ffffff",
      border: "#2f7d18",
      outlineBackground: "#ffffff",
      outlineHoverBackground: "#e0ecdc",
      outlinePressedBackground: "#c1d8ba",
    },
    quaternary: {
      background: "#a66b00",
      hoverBackground: "#915e03",
      pressedBackground: "#825606",
      foreground: "#ffffff",
      border: "#a66b00",
      outlineBackground: "#ffffff",
      outlineHoverBackground: "#f2e9d9",
      outlinePressedBackground: "#e4d3b3",
    },
    quintenary: {
      background: "#b73434",
      hoverBackground: "#9f3030",
      pressedBackground: "#8f2d2d",
      foreground: "#ffffff",
      border: "#b73434",
      outlineBackground: "#ffffff",
      outlineHoverBackground: "#f4e1e1",
      outlinePressedBackground: "#e9c2c2",
    },
  },
  spacing: {
    unit: 5,
  },
  radius: {
    rounded: 5,
    round: 10000,
  },
  opacity: {
    disabled: 0.4,
  },
  typography: {
    fontFamilies: {},
    fontSizes: {
      d1: 425,
      d2: 320,
      d3: 240,
      d4: 180,
      d5: 134,
      d6: 100,
      h1: 38,
      h2: 24,
      h3: 20,
      h4: 18,
      h5: 16,
      h6: 14,
      "h1-sm": 24,
      "h2-sm": 20,
      "h3-sm": 18,
      "h4-sm": 16,
      "h5-sm": 14,
      "h6-sm": 12,
      b1: 76,
      b2: 58,
      b3: 42,
      b4: 32,
      b5: 24,
      b6: 22,
      b7: 20,
      b8: 18,
      b9: 16,
      b10: 14,
      b11: 12,
      b12: 11,
      b13: 10,
    },
    fontWeights: {
      light: "300",
      regular: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
      extrabold: "800",
    },
  },
}

const darkTheme: TNativeTheme = {
  mode: "dark",
  colors: {
    background: "#171717",
    foreground: "#ffffff",
    controlBackground: "#171717",
    controlForeground: "#ffffff",
    controlBorder: "#474747",
    focusRing: "#2563eb",
  },
  actions: {
    primary: {
      background: "#2563eb",
      hoverBackground: "#467aee",
      pressedBackground: "#5c8af0",
      foreground: "#ffffff",
      border: "#2563eb",
      outlineBackground: "#171717",
      outlineHoverBackground: "#5c8af0",
      outlinePressedBackground: "#467aee",
    },
    secondary: {
      background: "#3d3d3d",
      hoverBackground: "#5a5a5a",
      pressedBackground: "#6e6e6e",
      foreground: "#ffffff",
      border: "#3d3d3d",
      outlineBackground: "#171717",
      outlineHoverBackground: "#6e6e6e",
      outlinePressedBackground: "#5a5a5a",
    },
    tertiary: {
      background: "#6ad060",
      hoverBackground: "#80d778",
      pressedBackground: "#8fdc88",
      foreground: "#ffffff",
      border: "#6ad060",
      outlineBackground: "#171717",
      outlineHoverBackground: "#8fdc88",
      outlinePressedBackground: "#80d778",
    },
    quaternary: {
      background: "#f0b429",
      hoverBackground: "#f2bf49",
      pressedBackground: "#f4c75f",
      foreground: "#ffffff",
      border: "#f0b429",
      outlineBackground: "#171717",
      outlineHoverBackground: "#f4c75f",
      outlinePressedBackground: "#f2bf49",
    },
    quintenary: {
      background: "#ff6b5f",
      hoverBackground: "#ff8177",
      pressedBackground: "#ff9087",
      foreground: "#ffffff",
      border: "#ff6b5f",
      outlineBackground: "#171717",
      outlineHoverBackground: "#ff9087",
      outlinePressedBackground: "#ff8177",
    },
  },
  spacing: {
    unit: 5,
  },
  radius: {
    rounded: 5,
    round: 10000,
  },
  opacity: {
    disabled: 0.4,
  },
  typography: {
    fontFamilies: {},
    fontSizes: {
      d1: 425,
      d2: 320,
      d3: 240,
      d4: 180,
      d5: 134,
      d6: 100,
      h1: 38,
      h2: 24,
      h3: 20,
      h4: 18,
      h5: 16,
      h6: 14,
      "h1-sm": 24,
      "h2-sm": 20,
      "h3-sm": 18,
      "h4-sm": 16,
      "h5-sm": 14,
      "h6-sm": 12,
      b1: 76,
      b2: 58,
      b3: 42,
      b4: 32,
      b5: 24,
      b6: 22,
      b7: 20,
      b8: 18,
      b9: 16,
      b10: 14,
      b11: 12,
      b12: 11,
      b13: 10,
    },
    fontWeights: {
      light: "300",
      regular: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
      extrabold: "800",
    },
  },
}

const mergeDefinedOverrides = <T extends object>(defaults: T, overrides?: Partial<T>): T => {
  const result = { ...defaults }

  for (const key of Object.keys(overrides ?? {}) as (keyof T)[]) {
    const value = overrides?.[key]
    if (value !== undefined) result[key] = value
  }

  return result
}

export const resolveNativeTheme = (mode: TNativeThemeMode, overrides: TNativeThemeOverrides = {}): TNativeTheme => {
  const defaults = mode === "dark" ? darkTheme : lightTheme
  const actions = { ...defaults.actions }

  for (const order of AVAILABLE_THEMING_ORDER_CODES) {
    actions[order] = mergeDefinedOverrides(defaults.actions[order], overrides.actions?.[order])
  }

  return {
    ...defaults,
    colors: mergeDefinedOverrides(defaults.colors, overrides.colors),
    actions,
    spacing: mergeDefinedOverrides(defaults.spacing, overrides.spacing),
    radius: mergeDefinedOverrides(defaults.radius, overrides.radius),
    opacity: mergeDefinedOverrides(defaults.opacity, overrides.opacity),
    typography: {
      ...mergeDefinedOverrides(defaults.typography, { lineHeight: overrides.typography?.lineHeight }),
      fontFamilies: mergeDefinedOverrides(defaults.typography.fontFamilies, overrides.typography?.fontFamilies),
      fontSizes: mergeDefinedOverrides(defaults.typography.fontSizes, overrides.typography?.fontSizes),
      fontWeights: mergeDefinedOverrides(defaults.typography.fontWeights, overrides.typography?.fontWeights),
    },
  }
}
