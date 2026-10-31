import { Platform } from "react-native"

import { resolveNativeTheme } from "../../../theme/defaults"
import { AVAILABLE_THEMING_ORDER_CODES } from "../../../tokens/theme-order"
import { getNativeGroupedTagColors, getNativeGroupedTagStyles, getNativeTagGroupStyles } from "../styles"
import type { TNativeGroupedTagState } from "../visualTypes"

const flags: TNativeGroupedTagState = {
  isSelected: false,
  isDisabled: false,
  isHovered: false,
  isPressed: false,
  isFocused: false,
  isFocusVisible: false,
  allowsSelection: true,
  hasAction: false,
  allowsRemoving: false,
  selectionMode: "multiple",
  selectionBehavior: "toggle",
}
const light = resolveNativeTheme("light")
it("CAP.tag-group.002–.005 keeps root/list axes, orientation, wrapping and style owners independent", () => {
  const initial = getNativeTagGroupStyles(light, {})
  expect(initial.root).toMatchObject({ width: "auto", height: "auto", flexDirection: "row" })
  expect(initial.list).toMatchObject({
    width: "auto",
    height: "auto",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: light.spacing.unit,
  })
  const changed = getNativeTagGroupStyles(light, {
    width: 0,
    height: "50%",
    orientation: "vertical",
    customStyles: [{ width: 200 }, false, { height: 100 }],
    style: { width: 500 },
    customTagListStyles: { backgroundColor: "red", gap: 0 },
  })
  expect(changed.root).toMatchObject({ width: 500, height: 100 })
  expect(changed.list).toMatchObject({
    width: 0,
    height: "50%",
    flexDirection: "column",
    backgroundColor: "red",
    gap: 0,
  })
  expect(changed.root.backgroundColor).toBeUndefined()
})
it.each(["light", "dark"] as const)("CAP.tag-group.item.004/.005 uses all five semantic pairs in %s", (mode) => {
  const theme = resolveNativeTheme(mode),
    colors = theme.colors
  const backgrounds = [
    colors.controlSelectedBackground,
    colors.controlPressedBackground,
    colors.statusSuccess,
    colors.statusWarning,
    colors.statusDanger,
  ]
  const foregrounds = [
    colors.controlSelectedForeground,
    colors.foreground,
    colors.background,
    colors.background,
    colors.background,
  ]
  for (const [index, order] of AVAILABLE_THEMING_ORDER_CODES.entries()) {
    const style = getNativeGroupedTagStyles(theme, { order }, { ...flags, isSelected: true })
    expect(style.view).toMatchObject({ backgroundColor: backgrounds[index], borderColor: backgrounds[index] })
    expect(style.text.color).toBe(foregrounds[index])
  }
})
it("keeps default selected/hover/pressed priorities and suppresses interaction tint when disabled", () => {
  expect(getNativeGroupedTagColors(light, {}, { ...flags, isSelected: true, isHovered: true }).backgroundColor).toBe(
    light.colors.controlSelectedHoverBackground,
  )
  expect(
    getNativeGroupedTagColors(light, {}, { ...flags, isSelected: true, isHovered: true, isPressed: true })
      .backgroundColor,
  ).toBe(light.colors.controlSelectedPressedBackground)
  expect(
    getNativeGroupedTagColors(light, {}, { ...flags, isDisabled: true, isSelected: true, isPressed: true })
      .backgroundColor,
  ).toBe(light.colors.controlSelectedBackground)
  expect(getNativeGroupedTagColors(light, {}, { ...flags, isHovered: true }).backgroundColor).toBe(
    light.colors.controlHoverBackground,
  )
})
it("maps component-local compatibility mixes without changing native palette roles", () => {
  const before = JSON.stringify(light)
  expect(
    getNativeGroupedTagColors(light, { order: "tertiary" }, { ...flags, isSelected: true, isHovered: true })
      .backgroundColor,
  ).toBe("rgba(78, 145, 59, 1)")
  expect(
    getNativeGroupedTagColors(light, { order: "tertiary" }, { ...flags, isSelected: true, isPressed: true })
      .backgroundColor,
  ).toBe("rgba(99, 158, 82, 1)")
  expect(getNativeGroupedTagColors(light, { order: "secondary" }, { ...flags, isPressed: true }).backgroundColor).toBe(
    light.colors.controlPressedBackground,
  )
  expect(JSON.stringify(light)).toBe(before)
})
it("CAP.tag-group.item.007 preserves explicit background over transparency/order and independent foreground", () => {
  const selected = { ...flags, isSelected: true, isHovered: true, isPressed: true }
  expect(getNativeGroupedTagColors(light, { color: "tomato", transparent: true, order: "tertiary" }, selected)).toEqual(
    { color: light.colors.controlForeground, borderColor: light.colors.controlBorder, backgroundColor: "tomato" },
  )
  expect(getNativeGroupedTagColors(light, { transparent: true }, selected).backgroundColor).toBe("transparent")
})
it("CAP.tag-group.item.003/.006 retains geometry, canonical focused outline and explicit false flags", () => {
  for (const [geometry, radius] of [
    ["rounded", light.radius.rounded],
    ["round", light.radius.round],
    ["orthogonal", 0],
  ] as const) {
    expect(getNativeGroupedTagStyles(light, { geometry }, flags).view.borderRadius).toBe(radius)
  }
  expect(getNativeGroupedTagStyles(light, { geometry: "round" }, flags).view.paddingHorizontal).toBe(7)
  const focused = { ...flags, isFocused: true, isFocusVisible: false }
  expect(getNativeGroupedTagStyles(light, {}, focused).view).toMatchObject({ outlineWidth: 1.5, outlineOffset: 1.5 })
  expect(
    getNativeGroupedTagStyles(light, { enableFocusStyle: false, offsetFocusRing: false }, focused).view,
  ).toMatchObject({ outlineWidth: 0, outlineOffset: 0 })
})
it("CAP.tag-group.item.002/.008 keeps native zero dimensions, authored constraints and default raised=false", () => {
  const defaults = getNativeGroupedTagStyles(light, {}, flags).view
  expect(defaults.minHeight).toBe(Platform.OS === "ios" ? 44 : 48)
  expect(defaults.shadowOpacity).toBeUndefined()
  const styled = getNativeGroupedTagStyles(light, { width: 0, height: 30, raised: true }, flags).view
  expect(styled).toMatchObject({ width: 0, height: 30, shadowOpacity: 0.24, elevation: 2 })
  expect(styled.minWidth).toBeUndefined()
  expect(styled.minHeight).toBeUndefined()
  expect(getNativeGroupedTagStyles(light, {}, { ...flags, allowsSelection: false }).view.minHeight).toBeUndefined()
})
it("CAP.tag-group.item.009/.010 splits text/layout styles and supplies current flags plus post-custom defaults", () => {
  const style = jest.fn((state) => ({ width: 0, color: state.isSelected ? "tomato" : "blue", marginTop: 0 }))
  const rendered = getNativeGroupedTagStyles(
    light,
    { geometry: "round", customStyles: { fontSize: 19, color: "purple", marginTop: 8, borderRadius: 2 }, style },
    { ...flags, isSelected: true, allowsRemoving: true },
  )
  expect(style.mock.calls[0][0]).toMatchObject({
    isSelected: true,
    allowsRemoving: true,
    selectionMode: "multiple",
    selectionBehavior: "toggle",
    defaultStyle: { fontSize: 19, color: "purple", borderRadius: 2 },
  })
  expect(rendered.text).toMatchObject({ fontSize: 19, color: "tomato" })
  expect(rendered.view).toMatchObject({ width: 0, marginTop: 0, borderRadius: 2 })
  expect(rendered.view.minWidth).toBeUndefined()
  expect("color" in rendered.view).toBe(false)
  expect("marginTop" in rendered.text).toBe(false)
})
it("protects computed styles against callback mutation and responds to provider overrides", () => {
  const changed = resolveNativeTheme("dark", {
    spacing: { unit: 9 },
    colors: { controlSelectedBackground: "tomato", controlSelectedForeground: "purple" },
  })
  const result = getNativeGroupedTagStyles(
    changed,
    {
      style: ({ defaultStyle }) => {
        defaultStyle.color = "red"
        return undefined
      },
    },
    { ...flags, isSelected: true },
  )
  expect(result.text.color).toBe("purple")
  expect(result.view).toMatchObject({ padding: 9, backgroundColor: "tomato" })
})
it("rejects unsupported native colors/dimensions/variants instead of advertising CSS behavior", () => {
  expect(() => getNativeGroupedTagStyles(light, { width: "1rem" as never }, flags)).toThrow(/native dimension/)
  expect(() => getNativeGroupedTagStyles(light, { geometry: "square" as never }, flags)).toThrow(/geometry/)
  expect(() => getNativeGroupedTagStyles(light, { color: "var(--cui-color)" }, flags)).toThrow(/native color/)
  expect(() => getNativeTagGroupStyles(light, { orientation: "diagonal" as never })).toThrow(/orientation/)
})
