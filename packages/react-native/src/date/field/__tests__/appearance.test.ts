import { resolveNativeTheme } from "../../../theme/defaults"
import { calibrateNativeTimePickerStyle, getNativeTimePickerAppearance } from "../appearance"
import { resolveNativeTimePickerBorderColors } from "../motion"
import type { TNativeTimeFieldStyleState } from "../types"

const theme = resolveNativeTheme("light")
const flags = { isDisabled: false, isFocusWithin: false }

it("retains zero dimensions and computed, custom, final style precedence", () => {
  expect(calibrateNativeTimePickerStyle({ height: 0, width: 0 })).toEqual([{ height: 0, width: 0 }, undefined])
  expect(
    calibrateNativeTimePickerStyle({ height: 8, width: 9, customStyles: { width: 10 }, style: { height: 11 } }),
  ).toEqual([{ height: 8, width: 10 }, { height: 11 }])
})

it("forwards the field's original render state and defaultStyle to authored style", () => {
  const authored = jest.fn<{ width: number }, [TNativeTimeFieldStyleState]>(() => ({ width: 31 }))
  const style = calibrateNativeTimePickerStyle({ width: 20, customStyles: { height: 21 }, style: authored })
  const renderState = { defaultStyle: { color: "red" } } as TNativeTimeFieldStyleState
  expect(typeof style).toBe("function")
  if (typeof style === "function") expect(style(renderState)).toEqual([{ height: 21, width: 20 }, { width: 31 }])
  expect(authored).toHaveBeenCalledWith(renderState)
  expect(authored.mock.calls[0][0]).toBe(renderState)
})

it.each([
  ["small", "b11"],
  ["medium", "b10"],
  ["large", "b9"],
  [undefined, "b10"],
] as const)("maps %s typography to %s without fixed editor dimensions", (textSize, variant) => {
  const result = getNativeTimePickerAppearance(theme, { textSize }, flags)
  expect(result.text.fontSize).toBe(theme.typography.fontSizes[variant])
  expect(result.segment).not.toHaveProperty("minWidth")
  expect(result.segment).not.toHaveProperty("minHeight")
  expect(result.placeholder).toMatchObject({ fontSize: 12, fontStyle: "italic" })
})

it.each([
  ["orthogonal", undefined],
  ["rounded", theme.radius.rounded],
  ["round", "50%"],
] as const)("preserves %s geometry", (geometry, radius) => {
  const result = getNativeTimePickerAppearance(theme, { geometry }, flags)
  expect(result.group.borderRadius).toBe(radius)
  if (geometry === "round") expect(result.group).toMatchObject({ padding: theme.spacing.unit, paddingHorizontal: 7 })
})

it.each([
  [{}, "controlBorder"],
  [{ successState: true }, "validationSuccessBorder"],
  [{ warningState: true, successState: true }, "validationWarningBorder"],
  [{ errorState: true, warningState: true, successState: true }, "validationErrorBorder"],
] as const)("retains explicit validation-color precedence %j", (props, color) => {
  expect(getNativeTimePickerAppearance(theme, props, flags).group.borderColor).toBe(theme.colors[color])
})

it("uses focus within for the group and clock while preserving explicit focus switches", () => {
  const focused = { ...flags, isFocusWithin: true }
  const result = getNativeTimePickerAppearance(theme, {}, focused)
  expect(result.group).toMatchObject({ outlineWidth: 1.5, outlineOffset: 1.5 })
  expect(result.iconColor).toBe(theme.colors.controlSelectedBackground)
  expect(getNativeTimePickerAppearance(theme, { offsetFocusRing: false }, focused).group.outlineOffset).toBe(0)
  expect(getNativeTimePickerAppearance(theme, { enableFocusStyle: false }, focused).group.outlineWidth).toBeUndefined()
  expect(getNativeTimePickerAppearance(theme, {}, flags).iconColor).toBe(theme.colors.controlForeground)
})

it("keeps group and input custom styles on their own final surfaces", () => {
  const result = getNativeTimePickerAppearance(
    theme,
    { customInputIconGroupStyles: { borderWidth: 3 }, customInputStyles: { padding: 0, backgroundColor: "red" } },
    { ...flags, isDisabled: true },
  )
  expect(result.root.opacity).toBe(theme.opacity.disabled)
  expect(result.group.borderWidth).toBe(3)
  expect(result.input).toMatchObject({ padding: 0, backgroundColor: "red", borderWidth: 0 })
  expect(result.group.backgroundColor).toBeUndefined()
})

it.each([
  [false, false, false, "red", "blue", "green", "purple", false],
  [false, true, false, "red", "blue", "green", "purple", false],
  [true, false, false, "orange", "yellow", "cyan", "purple", false],
  [true, true, false, "yellow", "orange", "cyan", "purple", false],
  [true, true, true, "yellow", "orange", "cyan", "purple", true],
] as const)(
  "uses pinned platform border priority android=%s rtl=%s swap=%s",
  (android, rtl, swap, left, right, top, bottom, swapPhysical) => {
    expect(
      resolveNativeTimePickerBorderColors(
        {
          borderColor: "black",
          borderLeftColor: "red",
          borderRightColor: "blue",
          borderStartColor: "orange",
          borderEndColor: "yellow",
          borderTopColor: "cyan",
          borderBottomColor: "pink",
          borderBlockColor: "green",
          borderBlockEndColor: "purple",
        },
        "white",
        rtl,
        android,
        swap,
      ),
    ).toMatchObject({
      borderLeftColor: left,
      borderRightColor: right,
      borderTopColor: top,
      borderBottomColor: bottom,
      swapPhysical,
    })
  },
)

it("preserves Android's native physical-edge swap when logical overrides are absent", () => {
  expect(
    resolveNativeTimePickerBorderColors(
      { borderLeftColor: "red", borderRightColor: "blue" },
      "black",
      true,
      true,
      true,
    ),
  ).toMatchObject({ borderLeftColor: "blue", borderRightColor: "red", swapPhysical: true })
  expect(
    resolveNativeTimePickerBorderColors(
      { borderLeftColor: "red", borderRightColor: "blue" },
      "black",
      true,
      true,
      false,
    ),
  ).toMatchObject({ borderLeftColor: "red", borderRightColor: "blue", swapPhysical: false })
})
