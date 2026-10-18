import { resolveNativeTheme } from "../../../theme/defaults"
import { AVAILABLE_THEMING_ORDER_CODES } from "../../../tokens/theme-order"
import { getNativeClickPopoverStyles } from "../styles"

const theme = resolveNativeTheme("light")
const styles = (
  props: Parameters<typeof getNativeClickPopoverStyles>[1] = {},
  side: Parameters<typeof getNativeClickPopoverStyles>[2] = "bottom",
  direction: "ltr" | "rtl" = "ltr",
) => getNativeClickPopoverStyles(theme, props, side, direction, 300)

it.each(["light", "dark"] as const)("retains the three independent default style owners in %s mode", (mode) => {
  const current = resolveNativeTheme(mode)
  const result = getNativeClickPopoverStyles(current, {}, "bottom", "ltr", 300)
  expect(result.root).toMatchObject({
    padding: current.spacing.unit * 2,
    borderRadius: current.radius.rounded,
    backgroundColor: current.colors.background,
    marginTop: current.spacing.unit * 2,
  })
  expect(result.rootText.color).toBe(current.colors.foreground)
  expect(result.root.boxShadow).toHaveLength(2)
  expect(result.dialog).toMatchObject({ flexDirection: "column", gap: current.spacing.unit * 3, borderRadius: 0.5 })
  expect(result.arrowPaint.fill).toBe(current.colors.background)
})

it.each(AVAILABLE_THEMING_ORDER_CODES)(
  "maps %s onto existing native roles while retaining normal foreground",
  (order) => {
    const mapped = {
      primary: theme.colors.controlSelectedBackground,
      secondary: theme.colors.controlPressedBackground,
      tertiary: theme.colors.statusSuccess,
      quaternary: theme.colors.statusWarning,
      quintenary: theme.colors.statusDanger,
    }
    const result = styles({ order })
    expect(result.root.backgroundColor).toBe(mapped[order])
    expect(result.arrowPaint.fill).toBe(mapped[order])
    expect(result.rootText.color).toBe(theme.colors.foreground)
  },
)

it("preserves canonical foreground-color, order suppression and independently painted arrow quirks", () => {
  const result = styles({ order: "primary", color: "red", style: { color: "blue", backgroundColor: "black" } })
  expect(result.root.backgroundColor).toBe("black")
  expect(result.rootText.color).toBe("blue")
  expect(result.arrowColor).toBe("red")
  expect(result.arrowPaint.fill).toBe(theme.colors.background)
})

it("preserves final zeroes and distinct raw-text, dialog and vector customization", () => {
  const result = styles({
    width: 30,
    height: 40,
    customStyles: { backgroundColor: "red", borderRadius: 9, width: 20, fontSize: 18, margin: 0 },
    style: { backgroundColor: undefined, borderRadius: 0, width: 0, fontSize: 0 },
    customDialogStyles: { gap: 0, color: "purple", fontSize: 24, padding: 0 },
    customOverlayArrowStyles: { width: 0, backgroundColor: "green", fill: "tomato", fillOpacity: 0, color: "cyan" },
  })
  expect(result.root).toMatchObject({
    backgroundColor: theme.colors.background,
    borderRadius: 0,
    width: 0,
    height: 40,
    margin: 0,
  })
  expect(result.root).not.toHaveProperty("fontSize")
  expect(result.rootText.fontSize).toBe(0)
  expect(result.dialog).toMatchObject({ gap: 0, padding: 0 })
  expect(result.dialogText).toMatchObject({ color: "purple", fontSize: 24 })
  expect(result.arrow).toMatchObject({ width: 0, backgroundColor: "green" })
  expect(result.arrow).not.toHaveProperty("fill")
  expect(result.arrowPaint).toMatchObject({ fill: "tomato", fillOpacity: 0 })
  expect(result.arrowColor).toBe("cyan")
  expect(result.margins).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
})

it("clears authored inline dimensions with undefined and retains computed geometry defaults", () => {
  const result = styles({
    width: 30,
    customStyles: { borderRadius: 40 },
    style: { width: undefined, borderRadius: undefined },
  })
  expect(result.root.width).toBeUndefined()
  expect(result.root.borderRadius).toBe(theme.radius.rounded)
  expect(styles({ geometry: "orthogonal", raised: false }).root).toMatchObject({ borderRadius: 0 })
  expect(styles({ raised: false }).root.boxShadow).toBeUndefined()
})

it("resolves native edge/axis/shorthand, logical RTL and computed percentage margins without altering their authored values", () => {
  expect(styles({ style: { margin: 0 } }).margins).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
  const fractional = styles({ style: { marginTop: 2.5, marginHorizontal: "10%", marginStart: 0 } })
  expect(fractional.root).toMatchObject({ marginTop: 2.5, marginHorizontal: "10%", marginStart: 0 })
  expect(fractional.margins).toEqual({ top: 2, right: 30, bottom: 0, left: 0 })
  expect(styles({ style: { marginStart: 0 } }, "left", "rtl").margins.right).toBe(0)
})

it("validates native dimensions, colors and geometry without adding palette roles", () => {
  expect(() => styles({ width: -1 })).toThrow("width")
  expect(() => styles({ color: "var(--private-color)" })).toThrow("native color")
  expect(() => styles({ customOverlayArrowStyles: { fill: "var(--private-color)" } })).toThrow("native color")
  expect(styles({ customOverlayArrowStyles: { fill: "currentColor" } }).arrowPaint.fill).toBe("currentColor")
})
