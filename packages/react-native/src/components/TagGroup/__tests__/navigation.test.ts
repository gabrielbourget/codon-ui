import {
  getNativeTagGroupKeyTokens,
  getNativeTagGroupNavigationKey,
  getNativeTagGroupNavigationSelection,
} from "../keyboard"
import type { TNativeTagGroupRow } from "../model"

const rows: TNativeTagGroupRow[] = [
  { key: 0, textValue: "Zero", isDisabled: false, hasAction: false },
  { key: "disabled", textValue: "Disabled", isDisabled: true, hasAction: false },
  { key: "0", textValue: "String zero", isDisabled: false, hasAction: false },
  { key: "", textValue: "Empty", isDisabled: false, hasAction: false },
]
it("keeps zero/string-zero/empty identities while wrapping, skipping disabled and recovering absent starts", () => {
  expect(getNativeTagGroupNavigationKey(rows, 0, "ArrowDown", false)).toBe("0")
  expect(getNativeTagGroupNavigationKey(rows, 0, "ArrowUp", false)).toBe("")
  expect(getNativeTagGroupNavigationKey(rows, "0", "ArrowRight", false)).toBe("")
  expect(getNativeTagGroupNavigationKey(rows, "", "ArrowDown", false)).toBe(0)
  expect(getNativeTagGroupNavigationKey(rows, null, "ArrowUp", false)).toBe("")
  expect(getNativeTagGroupNavigationKey(rows, null, "ArrowLeft", false)).toBe(0)
  expect(getNativeTagGroupNavigationKey(rows, "missing", "ArrowDown", false)).toBe(0)
  expect(getNativeTagGroupNavigationKey(rows, "disabled", "ArrowDown", false)).toBe("0")
  expect(getNativeTagGroupNavigationKey([], 0, "Home", false)).toBeNull()
  expect(
    getNativeTagGroupNavigationKey(
      rows.map((row) => ({ ...row, isDisabled: true })),
      0,
      "End",
      false,
    ),
  ).toBeNull()
})
it.each([true, false])("routes all navigation modifiers and only the platform command-A (%s)", (isApple) => {
  const tokens = getNativeTagGroupKeyTokens(isApple)
  expect(tokens).toContain("1111:ArrowRight")
  expect(tokens).toContain("1111:End")
  expect(tokens).toContain("1111:Delete")
  expect(tokens).not.toContain("0000:a")
  expect(tokens).not.toContain("1111:A")
  expect(tokens).toContain(isApple ? "0001:a" : "0010:a")
  expect(tokens).not.toContain(isApple ? "0010:a" : "0001:a")
})
it.each([
  { isApple: true, modifiers: { altKey: true }, expected: null },
  { isApple: true, modifiers: { ctrlKey: true }, expected: "replace" },
  { isApple: false, modifiers: { altKey: true }, expected: "replace" },
  { isApple: false, modifiers: { ctrlKey: true }, expected: null },
] as const)(
  "uses the audited platform noncontiguous modifier: $isApple/$modifiers",
  ({ isApple, modifiers, expected }) => {
    expect(
      getNativeTagGroupNavigationSelection({
        key: "ArrowDown",
        mode: "multiple",
        behavior: "replace",
        isLink: false,
        isApple,
        modifiers: { shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, ...modifiers },
      }),
    ).toBe(expected)
  },
)
it("keeps Apple Home/End range selection distinct from arrows and never selects in none mode", () => {
  const base = {
    mode: "multiple" as const,
    behavior: "replace" as const,
    isLink: true,
    isApple: true,
    modifiers: { shiftKey: true, metaKey: true, ctrlKey: false, altKey: false },
  }
  expect(getNativeTagGroupNavigationSelection({ ...base, key: "Home" })).toBe("extend")
  expect(getNativeTagGroupNavigationSelection({ ...base, key: "ArrowDown" })).toBeNull()
  expect(getNativeTagGroupNavigationSelection({ ...base, key: "End", mode: "none" })).toBeNull()
})
