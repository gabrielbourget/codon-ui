import { render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import CompactTypeaheadSearch from "../CompactTypeaheadSearch"

const items = [
  { id: 0, name: "Alpha Wave" },
  { id: 1, name: "Beta Drift" },
]
const base = { "aria-label": "Search", items, getItemKey: (item: (typeof items)[number]) => item.id }
describe("native port ownership oracle", () => {
  it.each([undefined, false, true])(
    "keeps input navigation bounded when the list's shouldFocusWrap is %s",
    async (shouldFocusWrap) => {
      const user = userEvent.setup()
      render(<CompactTypeaheadSearch {...base} shouldFocusWrap={shouldFocusWrap} />)
      const input = screen.getByTestId("type-ahead-search-input")
      await user.click(input)
      await user.keyboard("{ArrowUp}")
      const active = () => {
        const id = input.getAttribute("aria-activedescendant")
        return id ? document.getElementById(id)?.textContent : null
      }
      await waitFor(() => expect(active()).toBe("Beta Drift"))
      await user.keyboard("{ArrowDown}")
      expect(active()).toBe("Beta Drift")
      await user.keyboard("{Home}{ArrowUp}")
      expect(active()).toBe("Alpha Wave")
      await user.keyboard("{End}")
      expect(active()).toBe("Beta Drift")
      expect(input).toHaveFocus()
    },
  )
  it("leaves shifted input boundaries alone until an option is highlighted and clears highlight for caret keys", async () => {
    const user = userEvent.setup()
    render(<CompactTypeaheadSearch {...base} />)
    const input = screen.getByTestId("type-ahead-search-input")
    await user.click(screen.getByTestId("type-ahead-search-button"))
    expect(input).not.toHaveAttribute("aria-activedescendant")
    await user.keyboard("{Shift>}{Home}{End}{/Shift}")
    expect(input).not.toHaveAttribute("aria-activedescendant")
    await user.keyboard("{Home}")
    expect(input).toHaveAttribute("aria-activedescendant")
    await user.keyboard("{ArrowLeft}")
    expect(input).not.toHaveAttribute("aria-activedescendant")
    await user.keyboard("{End}{ArrowRight}")
    expect(input).not.toHaveAttribute("aria-activedescendant")
    expect(input).toHaveFocus()
  })
  it("does not commit a previously highlighted result after loading replaces the results", async () => {
    const user = userEvent.setup(),
      onChange = vi.fn()
    const { rerender } = render(<CompactTypeaheadSearch {...base} onChange={onChange} />)
    const input = screen.getByTestId("type-ahead-search-input")
    await user.click(input)
    await user.keyboard("{ArrowDown}")
    expect(input).toHaveAttribute("aria-activedescendant")
    await rerender(<CompactTypeaheadSearch {...base} onChange={onChange} isLoading />)
    await user.keyboard("{Enter}")
    expect(onChange).not.toHaveBeenCalled()
    expect(input).toHaveFocus()
  })
  it("keeps the wrapper's explicit default query ahead of a default selected label", () => {
    render(<CompactTypeaheadSearch {...base} defaultValue={0} defaultInputValue="" />)
    expect(screen.getByTestId("type-ahead-search-input")).toHaveValue("")
  })
  it("does not request a selected label when the selected value is controlled, even with an uncontrolled wrapper query", async () => {
    const onChange = vi.fn(),
      onInputChange = vi.fn(),
      user = userEvent.setup()
    render(<CompactTypeaheadSearch {...base} value={null} onChange={onChange} onInputChange={onInputChange} />)
    await user.click(screen.getByTestId("type-ahead-search-button"))
    await user.click(await screen.findByRole("option", { name: "Alpha Wave" }))
    expect(onChange).toHaveBeenCalledWith(0)
    expect(onInputChange).not.toHaveBeenCalled()
    expect(screen.getByTestId("type-ahead-search-input")).toHaveValue("")
  })
  it("requests the selected label when selected value is uncontrolled and the external query is held", async () => {
    const onInputChange = vi.fn(),
      user = userEvent.setup()
    render(<CompactTypeaheadSearch {...base} inputValue="held" onInputChange={onInputChange} />)
    await user.click(screen.getByTestId("type-ahead-search-button"))
    onInputChange.mockClear()
    await user.click(await screen.findByRole("option", { name: "Alpha Wave" }))
    await waitFor(() => expect(onInputChange).toHaveBeenCalledWith("Alpha Wave"))
    expect(screen.getByTestId("type-ahead-search-input")).toHaveValue("held")
  })
  it("retains underlying trigger toggles while a controlled false vetoes the visible popup", async () => {
    const onOpenChange = vi.fn(),
      user = userEvent.setup()
    render(<CompactTypeaheadSearch {...base} isOpen={false} onOpenChange={onOpenChange} />)
    await user.click(screen.getByTestId("type-ahead-search-button"))
    await user.click(screen.getByTestId("type-ahead-search-button"))
    expect(onOpenChange.mock.calls.map(([open]) => open)).toEqual([true, false])
    expect(screen.queryByRole("listbox")).toBeNull()
  })
  it("recommitting the selected row requests its label without another selection callback", async () => {
    const onChange = vi.fn(),
      onInputChange = vi.fn(),
      user = userEvent.setup()
    render(
      <CompactTypeaheadSearch
        {...base}
        value={0}
        inputValue="held"
        onChange={onChange}
        onInputChange={onInputChange}
      />,
    )
    await user.click(screen.getByTestId("type-ahead-search-button"))
    onChange.mockClear()
    onInputChange.mockClear()
    await user.click(await screen.findByRole("option", { name: "Alpha Wave" }))
    expect(onChange).not.toHaveBeenCalled()
    expect(onInputChange).toHaveBeenCalledWith("Alpha Wave")
    expect(screen.getByTestId("type-ahead-search-input")).toHaveValue("held")
  })
})
