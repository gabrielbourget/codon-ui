import { render, screen, waitFor, within } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { cloneElement } from "react"
import { describe, expect, it, vi } from "vitest"

import SortAndFilterPanel from "../SortAndFilterPanel"

describe("native query panel composition oracle", () => {
  it("routes vertical list focus with boundaries, Home and End while selection stays absent", async () => {
    const user = userEvent.setup()
    const panel = (
      <SortAndFilterPanel
        isOpen
        onOpenChange={vi.fn()}
        possibleSortCriteria={[
          { id: "city", name: "City" },
          { id: "name", name: "Name" },
        ]}
        possibleFilterCriteria={[]}
        activeSorts={[
          { id: "city", criteriaID: "city", criteriaName: "City", sortDirection: "Ascending" },
          { id: "name", criteriaID: "name", criteriaName: "Name", sortDirection: "Descending" },
        ]}
        applyPendingSortAndFilterChanges={vi.fn()}
      />
    )
    const view = render(panel)
    await waitFor(() => expect(screen.getByRole("button", { name: "Add Sort Criteria" })).toHaveFocus())
    const [first, last] = screen.getAllByRole("option")
    expect(first).not.toHaveAttribute("data-hovered")
    await user.hover(first)
    expect(first).not.toHaveAttribute("data-hovered")
    await user.unhover(first)
    const nestedButton = within(first).getByRole("button", { name: "Sort Descending" })
    await user.hover(nestedButton)
    expect(nestedButton).toHaveAttribute("data-hovered", "true")
    expect(first).not.toHaveAttribute("data-hovered")
    await user.unhover(nestedButton)
    expect(first).not.toHaveAttribute("data-hovered")
    first.focus()
    await waitFor(() => expect(first).toHaveAttribute("data-focused", "true"))
    await user.keyboard("{ArrowDown}")
    expect(last).toHaveFocus()
    await user.keyboard("{ArrowDown}")
    expect(last).toHaveFocus()
    await user.keyboard("{Home}")
    expect(first).toHaveFocus()
    await user.keyboard("{ArrowUp}")
    expect(first).toHaveFocus()
    await user.keyboard("{End}")
    expect(last).toHaveFocus()
    expect(first).not.toHaveAttribute("aria-selected")
    expect(last).not.toHaveAttribute("aria-selected")
    view.rerender(cloneElement(panel, { title: "Updated query panel" }))
    expect(screen.getAllByRole("option")[1]).toBe(last)
    expect(last).toHaveFocus()
    expect(last).toHaveAttribute("data-focused", "true")
  })
  it("keeps nested sort controls independent and routes their arrow event through the list", async () => {
    const user = userEvent.setup(),
      apply = vi.fn()
    render(
      <SortAndFilterPanel
        isOpen
        onOpenChange={vi.fn()}
        possibleSortCriteria={[
          { id: "city", name: "City" },
          { id: "name", name: "Name" },
        ]}
        possibleFilterCriteria={[]}
        activeSorts={[
          { id: "city", criteriaID: "city", criteriaName: "City", sortDirection: "Ascending" },
          { id: "name", criteriaID: "name", criteriaName: "Name", sortDirection: "Descending" },
        ]}
        applyPendingSortAndFilterChanges={apply}
      />,
    )
    await waitFor(() => expect(screen.getByRole("button", { name: "Add Sort Criteria" })).toHaveFocus())
    const first = screen.getAllByRole("option")[0]
    first.focus()
    within(first).getByRole("button", { name: "Sort Descending" }).focus()
    await user.keyboard("{ArrowDown}")
    expect(screen.getAllByRole("option")[1]).toHaveFocus()
    await user.click(within(first).getByRole("button", { name: "Sort Descending" }))
    expect(screen.getAllByRole("option")[0]).toHaveAccessibleName("Sort Parameter - City - Descending")
    expect(apply).not.toHaveBeenCalled()
  })
  it("moves focus to the newly requested criteria control while the panel remains open", async () => {
    const tree = (target: "sort" | "filter") => (
      <SortAndFilterPanel
        isOpen
        onOpenChange={vi.fn()}
        possibleSortCriteria={[]}
        possibleFilterCriteria={[]}
        applyPendingSortAndFilterChanges={vi.fn()}
        initialFocusTarget={target}
      />
    )
    const view = render(tree("sort"))
    await waitFor(() => expect(screen.getByRole("button", { name: "Add Sort Criteria" })).toHaveFocus())
    view.rerender(tree("filter"))
    await waitFor(() => expect(screen.getByRole("button", { name: "Add Filter Criteria" })).toHaveFocus())
  })
  it("keeps authored children unused in the canonical compound view", () => {
    render(
      <SortAndFilterPanel
        isOpen
        onOpenChange={vi.fn()}
        possibleSortCriteria={[]}
        possibleFilterCriteria={[]}
        applyPendingSortAndFilterChanges={vi.fn()}
      >
        <div data-testid="caller-child">Unused</div>
      </SortAndFilterPanel>,
    )
    expect(screen.queryByTestId("caller-child")).toBeNull()
  })
})
