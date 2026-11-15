import type { ViewStyle } from "react-native"

import { getNativeButtonStyle } from "../../../components/Button/styles"
import { resolveNativeTheme } from "../../../theme/defaults"
import { getNativeDatePickerAppearance } from "../appearance"

const theme = resolveNativeTheme("light")
const flags = { isDisabled: false, isFocusWithin: false, isOpen: false }
const padding = (style: ViewStyle, edge: "Top" | "Bottom" | "Left" | "Right") =>
  Number(
    style[`padding${edge}`] ??
      style[edge === "Top" || edge === "Bottom" ? "paddingVertical" : "paddingHorizontal"] ??
      style.padding ??
      0,
  )

it.each(["rounded", "round", "orthogonal"] as const)(
  "keeps one five-point inset around date field children with %s geometry and an intact trigger target",
  (geometry) => {
    const appearance = getNativeDatePickerAppearance(theme, { geometry }, flags)
    const trigger = getNativeButtonStyle(
      theme,
      { customStyles: appearance.button },
      { isDisabled: false, isPending: false, isPressed: false, isHovered: false, isFocused: false },
    )
    for (const edge of ["Top", "Bottom", "Left", "Right"] as const) {
      expect(padding(appearance.group, edge)).toBe(5)
      expect(
        padding(appearance.group, edge) + padding(appearance.input, edge) + padding(appearance.segment, edge),
      ).toBe(5)
      expect(padding(appearance.group, edge) + padding(trigger.viewStyle, edge)).toBe(5)
    }
    expect(trigger.viewStyle.minWidth).toBe(trigger.target)
    expect(trigger.viewStyle.minHeight).toBe(trigger.target)
  },
)

it("preserves explicit zero and independent authored group, editor and trigger spacing", () => {
  const appearance = getNativeDatePickerAppearance(
    theme,
    {
      customInputButtonGroupStyles: { padding: 0 },
      customInputStyles: { padding: 2 },
      customButtonStyles: { padding: 3 },
    },
    flags,
  )
  expect(padding(appearance.group, "Left")).toBe(0)
  expect(padding(appearance.input, "Left")).toBe(2)
  expect(padding(appearance.button, "Left")).toBe(3)
})
