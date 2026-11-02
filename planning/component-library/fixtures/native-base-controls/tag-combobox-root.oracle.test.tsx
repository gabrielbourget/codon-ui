import { render, screen } from "@testing-library/react"
import { createRef } from "react"
import { expect, it, vi } from "vitest"

import ListBoxItem from "../../../../packages/react/src/components/ListBoxItem/ListBoxItem"
import TagComboBox from "../../../../packages/react/src/components/TagComboBox/TagComboBox"

const item = { id: 0, label: "Zero" }
it("preserves canonical root and local tag typography declarations with original controlled hosts", () => {
  const root = createRef<HTMLDivElement>(),
    selected = vi.fn(),
    query = vi.fn()
  const node = (local: boolean) => (
    <TagComboBox
      ref={root}
      aria-label="Tags"
      items={[item]}
      selectedItems={[local ? { ...item } : item]}
      getItemKey={(value) => value.id}
      getItemTextValue={(value) => value.label}
      inputValue="held"
      onInputChange={query}
      onSelectedItemsChange={selected}
      customStyles={{ fontStyle: "italic", letterSpacing: 3 }}
      customTagGroupStyles={local ? { fontStyle: "normal", letterSpacing: 0 } : undefined}
      customTagProps={{
        "data-testid": "owned-tag",
        customStyles: local ? { fontStyle: "italic", letterSpacing: 5 } : undefined,
      }}
    >
      {(value) => <ListBoxItem id={value.id}>{value.label}</ListBoxItem>}
    </TagComboBox>
  )
  const view = render(node(false))
  const originalRoot = root.current,
    originalEditor = screen.getByRole("combobox", { name: "Tags" }),
    originalLabel = screen.getByText("Zero")
  expect(originalRoot).not.toBeNull()
  expect(originalRoot).toHaveStyle({ fontStyle: "italic", letterSpacing: "3px" })
  expect(originalLabel.style.fontStyle).toBe("")
  expect(originalLabel.style.letterSpacing).toBe("")
  expect(originalRoot).toContainElement(originalLabel)
  view.rerender(node(true))
  expect(root.current).toBe(originalRoot)
  expect(screen.getByRole("combobox", { name: "Tags" })).toBe(originalEditor)
  expect(screen.getByText("Zero")).toBe(originalLabel)
  expect(screen.getByTestId("owned-tag")).toHaveStyle({ fontStyle: "italic", letterSpacing: "5px" })
  expect(originalEditor).toHaveValue("held")
  expect(selected).not.toHaveBeenCalled()
  expect(query).not.toHaveBeenCalled()
  view.unmount()
  expect(root.current).toBeNull()
})
