import { act, render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { createRef } from "react"
import { expect, it, vi } from "vitest"

import CompactTypeaheadSearch from "../../../../packages/react/src/components/CompactTypeaheadSearch/CompactTypeaheadSearch"

const initial = [
  { id: 0, name: "Alpha" },
  { id: "beta", name: "Beta" },
]
const replacement = [
  { id: "beta", name: "Replaced Beta" },
  { id: 0, name: "Replaced Alpha" },
]
const options = () => screen.queryAllByRole("option").map((option) => option.textContent)

it.each([false, true])(
  "observes original compact owner-open metadata with actual trigger activation %s",
  async (activate) => {
    const root = createRef<HTMLDivElement>()
    const selection = vi.fn(),
      query = vi.fn(),
      opened = vi.fn()
    const node = (items: typeof initial) => (
      <CompactTypeaheadSearch
        ref={root}
        aria-label="Deferred compact search"
        items={items}
        getItemKey={(item) => item.id}
        inputValue="held query"
        value={0}
        isOpen
        minimumInputLength={0}
        onChange={selection}
        onInputChange={query}
        onOpenChange={opened}
      />
    )
    const view = render(node(initial))
    const originalRoot = root.current,
      originalInput = screen.getByTestId("type-ahead-search-input")
    expect(originalRoot).not.toBeNull()
    expect(originalInput).not.toBeNull()
    if (activate) {
      await userEvent.setup().click(screen.getByTestId("type-ahead-search-button"))
      await waitFor(() => expect(options()).toEqual(["Alpha", "Beta"]))
    }
    const before = options(),
      requests = opened.mock.calls.map((call) => [...call])
    await act(() => view.rerender(node(replacement)))
    const after = options()
    console.log("COMPACT_METADATA_ORACLE", JSON.stringify({ activate, before, after, opened: opened.mock.calls }))
    expect(root.current).toBe(originalRoot)
    expect(screen.getByTestId("type-ahead-search-input")).toBe(originalInput)
    expect(originalInput).toHaveValue("held query")
    expect(selection).not.toHaveBeenCalled()
    expect(query).not.toHaveBeenCalled()
    expect(opened.mock.calls).toEqual(requests)
    expect(requests).toEqual(activate ? [[true]] : [])
    expect({ before, after }).toEqual(
      activate
        ? { before: ["Alpha", "Beta"], after: ["Replaced Beta", "Replaced Alpha"] }
        : { before: ["No matching results found"], after: ["No matching results found"] },
    )
    await view.unmount()
    expect(root.current).toBeNull()
    expect(document.contains(originalInput)).toBe(false)
  },
)
