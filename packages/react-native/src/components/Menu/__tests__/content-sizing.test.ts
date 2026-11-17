import { resolveNativeTheme } from "../../../theme/defaults"
import { getNativeMenuItemStyles } from "../styles"

const state: Parameters<typeof getNativeMenuItemStyles>[2] = {
  isSelected: false,
  isDisabled: false,
  isHovered: false,
  isPressed: false,
  isFocused: false,
  isFocusVisible: false,
  selectionMode: "none",
  selectionBehavior: "replace",
  hasSubmenu: false,
  isOpen: false,
}
it("sizes menu rows to content while preserving assigned padding and minima", () => {
  const theme = resolveNativeTheme("light")
  const defaults = getNativeMenuItemStyles(theme, { id: "one", children: "Choice" }, state, {})
  expect(defaults.view.minHeight).toBeUndefined()
  expect(defaults.view.padding).toBe(5)
  const result = getNativeMenuItemStyles(
    theme,
    {
      id: "one",
      children: "Choice",
      customStyles: { padding: 0, minHeight: 0, width: 0 },
      style: ({ defaultStyle }) => ({ ...defaultStyle, minWidth: 13, paddingRight: 2 }),
    },
    state,
    {},
  )
  expect(result.view).toMatchObject({ padding: 0, paddingRight: 2, minHeight: 0, width: 0, minWidth: 13 })
})
