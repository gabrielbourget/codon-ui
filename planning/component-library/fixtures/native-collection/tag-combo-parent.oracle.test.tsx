import { writeFileSync } from "node:fs"
import { fireEvent, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { createRef } from "react"
import { ComboBoxContext } from "react-aria-components"
import { afterAll, expect, it, vi } from "vitest"

import ListBoxItem from "../../../../packages/react/src/components/ListBoxItem/ListBoxItem"
import TagComboBox from "../../../../packages/react/src/components/TagComboBox/TagComboBox"

const items = [{ id: 0, label: "Alpha" }]
const base = {
  "aria-label": "Source tags",
  items,
  selectedItems: [],
  getItemKey: (item: (typeof items)[number]) => item.id,
  getItemTextValue: (item: (typeof items)[number]) => item.label,
  onSelectedItemsChange: () => {},
  children: (item: (typeof items)[number]) => <ListBoxItem id={item.id}>{item.label}</ListBoxItem>,
}
const records: unknown[] = []
afterAll(() => {
  const path = process.env.CODON_TAG_COMBO_CONTRACT_OBSERVATIONS
  if (path) writeFileSync(path, JSON.stringify(records, null, 2))
})

it("inherits parent context at the inner ComboBox, preserves actual refs, and honors slot=null", () => {
  const root = createRef<HTMLDivElement>(),
    picker = createRef<HTMLDivElement>(),
    inherited = vi.fn(),
    authored = vi.fn()
  const content = (slot?: null) => (
    <ComboBoxContext.Provider
      value={{ ref: picker, isReadOnly: true, inputValue: "context query", onInputChange: inherited }}
    >
      <TagComboBox {...base} ref={root} slot={slot} onInputChange={authored} />
    </ComboBoxContext.Provider>
  )
  const view = render(content())
  expect(root.current).toBe(screen.getByTestId("tag-combobox"))
  expect(picker.current).toBe(screen.getByTestId("combo-box"))
  expect(picker.current).not.toBe(root.current)
  expect(screen.getByRole("combobox")).toHaveAttribute("readonly")
  expect(screen.getByRole("combobox")).toHaveValue("")
  view.rerender(content(null))
  expect(screen.getByRole("combobox")).not.toHaveAttribute("readonly")
  expect(picker.current).toBeNull()
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "owner query" } })
  expect(authored).toHaveBeenCalledWith("owner query")
  expect(inherited).not.toHaveBeenCalled()
  records.push({ context: "inner ComboBox", outerInputOverridesContext: true, slotNullOptsOut: true })
})

it("preserves duplicate form entries, null key ownership and the custom-value text override", () => {
  render(
    <form data-testid="owner-form">
      <TagComboBox {...base} name="entry" formValue="key" inputValue="held" />
      <TagComboBox {...base} name="entry" formValue="text" inputValue="held" />
      <TagComboBox {...base} name="custom" formValue="key" allowsCustomValue inputValue="draft" />
    </form>,
  )
  const entries = [...new FormData(screen.getByTestId("owner-form") as HTMLFormElement).entries()]
  expect(entries).toEqual([
    ["entry", ""],
    ["entry", "held"],
    ["custom", "draft"],
  ])
  records.push({ entries })
})

it("materializes declarative options without inventing item objects for the composite add callback", async () => {
  const selected = vi.fn()
  render(
    <TagComboBox {...base} items={undefined} onSelectedItemsChange={selected}>
      <ListBoxItem id="static">Static option</ListBoxItem>
    </TagComboBox>,
  )
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: "Show suggestions" }))
  await user.click(await screen.findByRole("option", { name: "Static option" }))
  expect(selected).not.toHaveBeenCalled()
  expect(screen.getByRole("combobox")).toHaveValue("")
  records.push({ declarativeOptionRendered: true, compositeAddRequests: selected.mock.calls.length })
})
