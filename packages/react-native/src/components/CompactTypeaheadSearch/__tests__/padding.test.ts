import { resolveNativeTheme } from "../../../theme/defaults"
import { getCompactTypeaheadStyles } from "../styles"

const state = { isOpen: false, isDisabled: false, isReadOnly: false, isInvalid: false, isRequired: false }
it("preserves round Compact group scalar padding without inherited axis insets", () => {
  const theme = resolveNativeTheme("light")
  const defaults = getCompactTypeaheadStyles(theme, { geometry: "round" }, state, false).group
  expect(defaults.paddingHorizontal).toBeUndefined()
  expect(defaults.paddingVertical).toBeUndefined()
  for (const padding of [0, 3, 11]) {
    const group = getCompactTypeaheadStyles(
      theme,
      {
        geometry: "round",
        customInputButtonGroupStyles: { padding },
      },
      state,
      false,
    ).group
    expect(group.padding).toBe(padding)
    expect(group.paddingHorizontal).toBeUndefined()
    expect(group.paddingVertical).toBeUndefined()
  }
  expect(
    getCompactTypeaheadStyles(
      theme,
      {
        geometry: "round",
        customInputButtonGroupStyles: { padding: 0, paddingHorizontal: 3, paddingLeft: 2 },
      },
      state,
      false,
    ).group,
  ).toMatchObject({ padding: 0, paddingHorizontal: 3, paddingLeft: 2 })
})
