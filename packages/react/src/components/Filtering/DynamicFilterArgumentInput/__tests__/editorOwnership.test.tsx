import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, it, vi } from "vitest"

import BooleanArgument from "../InternalComponents/BooleanTypeFilterArgument/BooleanTypeFilterArgument"
import ComboBoxArgument from "../InternalComponents/ComboBoxTypeFilterArgument/ComboBoxTypeFilterArgument"
import InputArgument from "../InternalComponents/InputTypeFilterArgument/InputTypeFilterArgument"
import ListArgument from "../InternalComponents/MultiInputTypeFilterArgument/MultiInputTypeFilterArgument"
import RangeArgument from "../InternalComponents/RangeTypeFilterArgument/RangeTypeFilterArgument"

it.each([undefined, null, false])("keeps incomplete Boolean %s owned in both modes", async (argument) => {
  for (const mode of ["Checkbox", "Toggle"] as const) {
    const change = vi.fn()
    const { unmount } = render(
      <BooleanArgument
        dataType="boolean"
        argument={argument}
        booleanArgumentComponent={mode}
        onArgumentChange={change}
      />,
    )
    const input = screen.getByRole(mode === "Checkbox" ? "checkbox" : "switch")
    await userEvent.click(input)
    await userEvent.click(input)
    expect(input).not.toBeChecked()
    expect(change.mock.calls).toEqual([[{ argument: true }], [{ argument: true }]])
    unmount()
  }
})
it.each([undefined, null, 0, "", NaN])(
  "keeps numeric %s owned through repeated increment requests",
  async (argument) => {
    const change = vi.fn()
    const { rerender } = render(<InputArgument dataType="number" argument={argument} onArgumentChange={change} />)
    const input = screen.getByRole("textbox")
    await userEvent.click(screen.getByRole("button", { name: /^Increase/ }))
    await userEvent.click(screen.getByRole("button", { name: /^Increase/ }))
    expect(input).toHaveValue(argument === 0 ? "0" : "")
    expect(change.mock.calls).toEqual([[{ argument: argument === 0 ? 1 : 0 }], [{ argument: argument === 0 ? 1 : 0 }]])
    rerender(<InputArgument dataType="number" argument={2} onArgumentChange={change} />)
    expect(screen.getByRole("textbox")).toBe(input)
    expect(input).toHaveValue("2")
    await userEvent.clear(input)
    await userEvent.tab()
    expect(change).toHaveBeenLastCalledWith({ argument: null })
  },
)
it.each([undefined, null, []])(
  "keeps empty array editors %s controlled and preserves zero-row Add",
  async (argument) => {
    const change = vi.fn()
    const { unmount } = render(<RangeArgument dataType="text" argument={argument} onArgumentChange={change} />)
    const minimum = screen.getByRole("textbox", { name: "Min Value" })
    fireEvent.change(minimum, { target: { value: "edited" } })
    expect(minimum).toHaveValue("")
    expect(change).toHaveBeenLastCalledWith({ argument: ["edited", undefined] })
    unmount()
    change.mockClear()
    render(<ListArgument dataType="text" argument={argument} onArgumentChange={change} />)
    expect(screen.queryAllByRole("textbox")).toHaveLength(0)
    await userEvent.click(screen.getByRole("button", { name: "Add Filter Argument Entry" }))
    expect(change).toHaveBeenCalledWith({ argument: [""] })
    expect(screen.queryAllByRole("textbox")).toHaveLength(0)
  },
)
it.each([undefined, ""])(
  "controls incomplete numeric range bound %s and preserves the untouched bound",
  async (minimum) => {
    const change = vi.fn()
    render(<RangeArgument dataType="number" argument={[minimum, 7]} onArgumentChange={change} />)
    await userEvent.click(screen.getAllByRole("button", { name: /^Increase/ })[0])
    expect(screen.getByRole("textbox", { name: "Min Value" })).toHaveValue("")
    expect(change).toHaveBeenCalledWith({ argument: [0, 7] })
  },
)
it("keeps mixed list entries and missing entries owned without coercing untouched siblings", async () => {
  const change = vi.fn()
  const argument = [0, 1, undefined, null]
  render(<ListArgument dataType="number" argument={argument} onArgumentChange={change} />)
  fireEvent.change(screen.getByRole("textbox", { name: "Filter Argument 0" }), { target: { value: "edited" } })
  expect(change).toHaveBeenLastCalledWith({ argument: ["edited", 1, undefined, null] })
  expect(screen.getByRole("textbox", { name: "Filter Argument 0" })).toHaveValue("0")
  expect(screen.getAllByRole("button", { name: "Delete Filter Entry" })[0]).toBeDisabled()
  expect(argument).toEqual([0, 1, undefined, null])
})
it.each([undefined, null])("keeps incomplete ComboBox text %s owned", async (argument) => {
  const change = vi.fn()
  render(
    <ComboBoxArgument
      dataType="text"
      argument={argument}
      filterArgumentSelectedKey={null}
      availableFilterArguments={[]}
      onArgumentChange={change}
    />,
  )
  const input = screen.getByRole("combobox")
  fireEvent.change(input, { target: { value: "edited" } })
  expect(change).toHaveBeenCalledWith({ argument: "edited" })
  expect(input).toHaveValue("")
})
