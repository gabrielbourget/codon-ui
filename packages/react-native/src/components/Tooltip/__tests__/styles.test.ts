import { getNativeFloatingSurfaceStyles } from "../../../overlays/floating/styles"
import { resolveNativeTheme } from "../../../theme/defaults"
import { AVAILABLE_THEMING_ORDER_CODES } from "../../../tokens/theme-order"
import type { TNativeTooltipProps } from "../types"

const profiles = ["tooltip", "hover-popover"] as const
const styles = (
  profile: (typeof profiles)[number],
  props: TNativeTooltipProps = {},
  mode: "light" | "dark" = "light",
) => getNativeFloatingSurfaceStyles(resolveNativeTheme(mode), props, "top", "ltr", 300, profile)

describe.each(profiles)("%s style contract", (profile) => {
  it.each(["light", "dark"] as const)("retains its exact default surface, text and shadow owners in %s", (mode) => {
    const theme = resolveNativeTheme(mode)
    const result = styles(profile, {}, mode)
    expect(result.root).toMatchObject({ padding: profile === "tooltip" ? 5 : 10, borderRadius: 5, marginBottom: 10 })
    expect(result.root.backgroundColor).toBe(profile === "tooltip" ? theme.colors.foreground : theme.colors.background)
    expect(result.rootText.color).toBe(profile === "tooltip" ? theme.colors.background : theme.colors.foreground)
    expect(result.arrowPaint.fill).toBe(result.root.backgroundColor)
    if (profile === "tooltip") {
      const filter = [
        {
          dropShadow: {
            offsetX: 0,
            offsetY: 2,
            standardDeviation: mode === "dark" ? 3.5 : 3,
            color: mode === "dark" ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.12)",
          },
        },
      ]
      expect(result.root.filter).toEqual(filter)
      expect(result.arrow.filter).toEqual(filter)
      expect(result.arrowGraphic).toEqual({ filter })
      expect(result.root.boxShadow).toBeUndefined()
    } else {
      expect(result.root).toMatchObject({ flexDirection: "column", gap: 15 })
      expect(result.arrow.boxShadow).toEqual(result.root.boxShadow)
      expect(result.root.boxShadow).toHaveLength(2)
      expect(result.root.filter).toBeUndefined()
      expect(result.arrowGraphic).toBeUndefined()
    }
  })

  it.each(AVAILABLE_THEMING_ORDER_CODES)("maps %s to existing roles without changing the foreground", (order) => {
    const theme = resolveNativeTheme("light")
    const expected = {
      primary: theme.colors.controlSelectedBackground,
      secondary: theme.colors.controlPressedBackground,
      tertiary: theme.colors.statusSuccess,
      quaternary: theme.colors.statusWarning,
      quintenary: theme.colors.statusDanger,
    }
    const result = styles(profile, { order })
    expect(result.root.backgroundColor).toBe(expected[order])
    expect(result.arrowPaint.fill).toBe(expected[order])
    expect(result.rootText.color).toBe(profile === "tooltip" ? theme.colors.background : theme.colors.foreground)
  })

  it("preserves color suppression, separate arrow paint and final native zeroes", () => {
    const theme = resolveNativeTheme("light")
    const result = styles(profile, {
      color: "red",
      order: "primary",
      geometry: "orthogonal",
      width: 30,
      customStyles: { color: "purple", backgroundColor: "blue", width: 20, margin: 0 },
      style: { color: "cyan", width: 0, padding: 0, borderRadius: 0 },
      customOverlayArrowStyles: { fill: "green", color: "orange", fillOpacity: 0, width: 0 },
    })
    expect(result.root).toMatchObject({ backgroundColor: "blue", width: 0, padding: 0, borderRadius: 0, margin: 0 })
    expect(result.rootText.color).toBe("cyan")
    expect(result.arrowPaint).toMatchObject({ fill: "green", fillOpacity: 0 })
    expect(result.arrowColor).toBe("orange")
    expect(result.arrow).toMatchObject({ width: 0 })
    expect(result.margins).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
    expect(styles(profile, { color: "red", order: "primary" }).arrowPaint.fill).toBe(
      profile === "tooltip" ? theme.colors.foreground : theme.colors.background,
    )
  })

  it("restores computed fields after undefined while retaining independent graphic shadow behavior", () => {
    const result = styles(profile, {
      customStyles: { padding: 0, borderRadius: 0, filter: [] },
      style: { padding: undefined, borderRadius: undefined, filter: undefined },
      raised: false,
    })
    expect(result.root).toMatchObject({ padding: profile === "tooltip" ? 5 : 10, borderRadius: 5 })
    expect(result.root.filter).toBeUndefined()
    expect(result.root.boxShadow).toBeUndefined()
    expect(result.arrow.filter).toBeUndefined()
    expect(result.arrow.boxShadow).toBeUndefined()
    expect(result.arrowGraphic?.filter !== undefined).toBe(profile === "tooltip")
  })

  it("names invalid native inputs for their actual component", () => {
    expect(() => styles(profile, { width: -1 })).toThrow(profile === "tooltip" ? "Tooltip" : "HoverPopover")
    expect(() => styles(profile, { customOverlayArrowStyles: { fill: "var(--invalid)" } })).toThrow("native color")
  })
})
