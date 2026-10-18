import { resolveNativeTheme } from "../../../theme/defaults"
import { getNativeTagComboBoxAddRequest, getNativeTagComboBoxRemoveRequest, getNativeTagComboBoxLabels } from "../model"
import { getNativeTagComboBoxStyles } from "../styles"
import type { TNativeTagComboBoxProps } from "../types"

const zero = { id: 0 },
  alias = { id: "0" },
  empty = { id: "" },
  missing = { id: "missing" }
const key = (item: { id: string | number }) => item.id
const props: TNativeTagComboBoxProps<{ id: string | number }> = {
  selectedItems: [],
  getItemKey: key,
  getItemTextValue: (item) => String(item.id),
  onSelectedItemsChange: () => {},
}
it("uses the canonical String(key) duplicate/removal comparison while preserving original typed keys and refs", () => {
  expect(getNativeTagComboBoxAddRequest([zero, alias, empty], [zero], "0", key)).toBeNull()
  const request = getNativeTagComboBoxAddRequest([zero, alias, empty], [missing], 0, key)!
  expect(request.items[1] === zero).toBe(true)
  expect(request.details.changedKeys).toEqual([0])
  expect(getNativeTagComboBoxAddRequest([zero], [], null, key)).toBeNull()
  expect(getNativeTagComboBoxAddRequest([zero], [], "absent", key)).toBeNull()
  const owner = [zero, alias, empty, missing],
    removed = getNativeTagComboBoxRemoveRequest(owner, new Set([0]), key)!
  expect(removed.items).toEqual([empty, missing])
  expect(removed.details.changedItems).toEqual([zero, alias])
  expect(removed.details.changedKeys).toEqual([0, "0"])
  expect(owner).toHaveLength(4)
})
it.each(["light", "dark"] as const)(
  "CAP.tag-combobox.008/.009 preserves validation precedence and defaults in %s",
  (mode) => {
    const theme = resolveNativeTheme(mode)
    expect(getNativeTagComboBoxStyles(theme, props, false).view).toMatchObject({
      maxWidth: 280,
      borderColor: theme.colors.controlBorder,
    })
    expect(
      getNativeTagComboBoxStyles(theme, { ...props, errorState: true, warningState: true, successState: true }, false)
        .view.borderColor,
    ).toBe(theme.colors.validationErrorBorder)
    expect(
      getNativeTagComboBoxStyles(theme, { ...props, warningState: true, successState: true }, false).view.borderColor,
    ).toBe(theme.colors.validationWarningBorder)
    expect(getNativeTagComboBoxStyles(theme, { ...props, successState: true }, false).view.borderColor).toBe(
      theme.colors.validationSuccessBorder,
    )
  },
)
it.each(["rounded", "round", "orthogonal"] as const)(
  "retains %s geometry and independent final zero overrides",
  (geometry) => {
    const styles = getNativeTagComboBoxStyles(
      resolveNativeTheme("light"),
      { ...props, geometry, maxWidth: 0, minWidth: 0, width: 0, customStyles: { padding: 7 }, style: { padding: 0 } },
      true,
    )
    expect(styles.view).toMatchObject({
      maxWidth: 0,
      minWidth: 0,
      width: 0,
      padding: 0,
      outlineWidth: 1.5,
      outlineOffset: 1.5,
    })
    expect(styles.view.borderRadius).toBe(geometry === "round" ? 10000 : geometry === "orthogonal" ? 0 : 5)
  },
)
it("preserves empty authored root/slot labels and nested precedence without changing the parent name guard", () => {
  const labels = getNativeTagComboBoxLabels({
    ...props,
    labels: { groupAriaLabel: "", tagGroupAriaLabel: "", comboBox: { triggerButtonAriaLabel: "Outer" } },
    customComboBoxProps: { labels: { triggerButtonAriaLabel: "" } },
  })
  expect(labels.groupAriaLabel).toBe("")
  expect(labels.tagGroupAriaLabel).toBe("")
  expect(labels.comboBox.triggerButtonAriaLabel).toBe("")
})
