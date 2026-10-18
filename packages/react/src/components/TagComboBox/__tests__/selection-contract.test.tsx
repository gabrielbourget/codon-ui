import { render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { expect, it, vi } from "vitest"

import ListBoxItem from "../../ListBoxItem/ListBoxItem"
import TagComboBox from "../TagComboBox"

const item = { id: 0, label: "Alpha Wave" }
it("keeps a controlled query authoritative and ends selection requests with the composite clear", async () => {
  const events: string[] = [],
    selected = vi.fn()
  render(
    <TagComboBox
      aria-label="Tags"
      items={[item]}
      selectedItems={[]}
      getItemKey={(value) => value.id}
      getItemTextValue={(value) => value.label}
      inputValue="Alpha"
      onInputChange={(value) => events.push(`input:${value}`)}
      onSelectedItemsChange={(...args) => {
        events.push("selected")
        selected(...args)
      }}
    >
      {(value) => <ListBoxItem id={value.id}>{value.label}</ListBoxItem>}
    </TagComboBox>,
  )
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: "Show suggestions" }))
  await user.click(await screen.findByRole("option", { name: "Alpha Wave" }))
  expect(events).toEqual(["selected", "input:"])
  expect(screen.getByTestId("input")).toHaveValue("Alpha")
  expect(selected.mock.calls[0]).toEqual([[item], { action: "add", changedItems: [item], changedKeys: [0] }])
})
