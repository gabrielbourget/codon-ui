import { act, render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { useContext, type ContextType } from "react"
import { ComboBoxStateContext } from "react-aria-components"
import { describe, expect, it, vi } from "vitest"

import CompactTypeaheadSearch from "../CompactTypeaheadSearch"

const items = [
  { id: 0, name: "Alpha Wave" },
  { id: 1, name: "Beta Drift" },
]
const base = { "aria-label": "Search", items, getItemKey: (item: (typeof items)[number]) => item.id }
describe("native port ownership oracle", () => {
  it("retains selection suppression through programmatic query requests and clears it on the next key", async () => {
    let state: ContextType<typeof ComboBoxStateContext> = null
    const Capture = () => {
      state = useContext(ComboBoxStateContext)
      return null
    }
    const node = (query: string) => (
      <CompactTypeaheadSearch
        {...base}
        value={null}
        inputValue={query}
        isOpen
        minimumInputLength={3}
        SearchIcon={<Capture />}
      />
    )
    const view = render(node("long"))
    await act(() => {
      state!.setValue(0)
    })
    await view.rerender(node(""))
    expect(screen.queryByTestId("type-ahead-search-minimum-query-state")).toBeNull()
    await act(() => {
      state!.setInputValue("a")
    })
    expect(screen.queryByTestId("type-ahead-search-minimum-query-state")).toBeNull()
    await act(() => {
      screen.getByTestId("type-ahead-search-input").focus()
    })
    await userEvent.setup().keyboard("{ArrowLeft}")
    expect(screen.getByTestId("type-ahead-search-minimum-query-state")).toBeInTheDocument()
    expect(screen.getByTestId("type-ahead-search-input")).toHaveValue("")
  })
  it("keeps a controlled status popup open while focus moves to an authored search descendant", async () => {
    let state: ContextType<typeof ComboBoxStateContext> = null
    const Capture = () => {
      state = useContext(ComboBoxStateContext)
      return (
        <span tabIndex={0} data-testid="search-descendant">
          Search child
        </span>
      )
    }
    const onOpenChange = vi.fn()
    render(
      <>
        <CompactTypeaheadSearch
          {...base}
          inputValue="q"
          minimumInputLength={3}
          isOpen
          onOpenChange={onOpenChange}
          SearchIcon={<Capture />}
        />
        <button data-testid="outside">Outside</button>
      </>,
    )
    await act(() => {
      screen.getByTestId("type-ahead-search-input").focus()
    })
    await act(() => {
      screen.getByTestId("search-descendant").focus()
    })
    expect(screen.getByTestId("search-descendant")).toHaveFocus()
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
    await act(() => {
      state!.open(null, "manual")
    })
    onOpenChange.mockClear()
    await act(() => {
      state!.close()
    })
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
    expect(screen.getByTestId("search-descendant")).toHaveFocus()
    await act(() => {
      screen.getByTestId("outside").focus()
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
  it.each(["isDisabled", "isReadOnly"] as const)("preserves programmatic state requests under %s", async (guard) => {
    let state: ContextType<typeof ComboBoxStateContext> = null
    const Capture = () => {
      state = useContext(ComboBoxStateContext)
      return null
    }
    const onInputChange = vi.fn(),
      onChange = vi.fn(),
      onOpenChange = vi.fn()
    render(
      <CompactTypeaheadSearch
        {...base}
        {...{ [guard]: true }}
        value={null}
        inputValue="held"
        onInputChange={onInputChange}
        onChange={onChange}
        onOpenChange={onOpenChange}
        SearchIcon={<Capture />}
      />,
    )
    await act(() => {
      state!.setInputValue("programmatic")
      state!.setValue(0)
      state!.open(null, "manual")
    })
    expect(onInputChange).toHaveBeenCalledWith("programmatic")
    expect(onChange).toHaveBeenCalledWith(0)
    expect(onOpenChange).toHaveBeenCalledWith(true)
    expect(screen.getByTestId("type-ahead-search-input")).toHaveValue("held")
  })
  it.each([false, true])(
    "retains a consumed iterable with query-keyed item caching, query change=%s",
    async (changeQuery) => {
      const iterable = (function* () {
        yield* items
      })()
      const user = userEvent.setup()
      const { rerender } = render(<CompactTypeaheadSearch {...base} items={iterable} isOpen inputValue="held" />)
      expect(screen.getByTestId("type-ahead-search-empty-state")).toBeInTheDocument()
      await user.click(screen.getByTestId("type-ahead-search-button"))
      expect(await screen.findByRole("option", { name: "Alpha Wave" })).toBeInTheDocument()
      await rerender(
        <CompactTypeaheadSearch
          {...base}
          items={iterable}
          isOpen
          inputValue={changeQuery ? "new held" : "held"}
          getItemTextValue={(item) => `${item.name}!`}
        />,
      )
      expect(screen.getByRole("option", { name: changeQuery ? "Alpha Wave!" : "Alpha Wave" })).toBeInTheDocument()
    },
  )
  it("keeps repeated Enter selection requests under a held value and open popup", async () => {
    const onChange = vi.fn(),
      user = userEvent.setup()
    render(<CompactTypeaheadSearch {...base} value={null} inputValue="" isOpen onChange={onChange} />)
    await user.click(screen.getByTestId("type-ahead-search-button"))
    await user.keyboard("{ArrowDown}{Enter>2/}")
    expect(onChange.mock.calls).toEqual([[0], [0]])
  })
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
