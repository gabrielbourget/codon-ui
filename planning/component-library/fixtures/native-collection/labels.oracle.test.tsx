import { render, screen } from "@testing-library/react"
import { expect, it } from "vitest"

import {
  nativeCompositeLabelProps,
  nativeAccessibilityIDs,
} from "../../../../packages/react-native/src/input/accessibilityReferences"
import Tag from "../../../../packages/react/src/components/TagGroup/AdobeTag/AdobeTag"
import TagGroup from "../../../../packages/react/src/components/TagGroup/TagGroup"

it.each([
  { label: "Own", references: "reference" },
  { label: "0", references: " reference  reference " },
  { label: "", references: "reference" },
  { label: "Own", references: undefined },
])("matches the actual TagGroup field-label attributes for $label/$references", ({ label, references }) => {
  render(
    <>
      <span id="reference">Referenced</span>
      <TagGroup id="wrapper" aria-label={label} aria-labelledby={references}>
        <Tag id="a">Alpha</Tag>
      </TagGroup>
    </>,
  )
  const field = screen.getByRole("grid")
  const id = field.getAttribute("id")!
  expect(id).toBeTruthy()
  expect(id).not.toBe("wrapper")
  const native = nativeCompositeLabelProps(
    { accessibilityLabel: label, nativeLabelledBy: nativeAccessibilityIDs(references) },
    id,
  )
  expect(native.nativeID).toBe(id)
  expect(native.nativeLabelledBy ?? []).toEqual(
    nativeAccessibilityIDs(field.getAttribute("aria-labelledby") ?? undefined) ?? [],
  )
})
