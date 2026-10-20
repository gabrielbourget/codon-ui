import { nativeCompositeLabelProps } from "../accessibilityReferences"

it("preserves native alias precedence and composes the owning label before referenced names", () => {
  const references = Object.freeze(["one", "two", "one"])
  expect(
    nativeCompositeLabelProps(
      { nativeID: "old", id: "field", accessibilityLabel: "Own", nativeLabelledBy: references },
      "generated",
    ),
  ).toEqual({ id: undefined, nativeID: "field", nativeLabelledBy: ["field", "one", "two"] })
  expect(references).toEqual(["one", "two", "one"])
  expect(
    nativeCompositeLabelProps(
      { accessibilityLabel: "Old", "aria-label": "", nativeLabelledBy: references },
      "generated",
    ).nativeLabelledBy,
  ).toBe(references)
})

it("retains explicit empty reference overrides and generates only a missing or source-falsy identity", () => {
  const empty = Object.freeze([])
  expect(
    nativeCompositeLabelProps(
      { accessibilityLabel: "Own", nativeLabelledBy: empty, "aria-labelledby": "ignored" },
      "generated",
    ).nativeLabelledBy,
  ).toBe(empty)
  expect(
    nativeCompositeLabelProps(
      { id: "", nativeID: "ignored", accessibilityLabel: "Own", "aria-labelledby": " other  other " },
      "generated",
    ),
  ).toEqual({ id: undefined, nativeID: "generated", nativeLabelledBy: ["generated", "other"] })
  expect(
    nativeCompositeLabelProps({ accessibilityLabel: "0", "aria-labelledby": "label" }, "generated").nativeLabelledBy,
  ).toEqual(["generated", "label"])
})
