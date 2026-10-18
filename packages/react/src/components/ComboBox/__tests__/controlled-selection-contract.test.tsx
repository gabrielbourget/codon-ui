import { render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { expect, it, vi } from "vitest"

import ListBoxItem from "../../ListBoxItem/ListBoxItem"
import ComboBox from "../ComboBox"

it.each([
  { value: 0, query: "held" },
  { value: 0, query: "Zero" },
  { value: "tail", query: "held" },
  { value: "tail", query: "Zero" },
])("preserves joint ownership and same-key synchronization for value=$value/query=$query", async ({ value, query }) => {
  const input = vi.fn(),
    selected = vi.fn()
  render(
    <ComboBox aria-label="Choices" value={value} inputValue={query} onInputChange={input} onChange={selected}>
      <ListBoxItem id={0}>Zero</ListBoxItem>
      <ListBoxItem id="tail">Tail</ListBoxItem>
    </ComboBox>,
  )
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: "Show suggestions" }))
  input.mockClear()
  selected.mockClear()
  await user.click(await screen.findByRole("option", { name: "Zero" }))
  expect(input.mock.calls).toEqual(value === 0 && query !== "Zero" ? [["Zero"]] : [])
  expect(screen.getByTestId("input")).toHaveValue(query)
  if (value === "tail") expect(selected).toHaveBeenCalledWith(0)
})
