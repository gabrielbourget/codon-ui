import { render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import SortAndFilterPanel from "../SortAndFilterPanel"

describe("native query panel composition oracle", () => {
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
