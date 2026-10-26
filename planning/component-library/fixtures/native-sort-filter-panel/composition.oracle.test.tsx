import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { cleanup, render, screen } from "@testing-library/react"
import { Dialog } from "react-aria-components"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import Button from "../../../../packages/react/src/components/Button/Button"
import buttonStyles from "../../../../packages/react/src/components/Button/ButtonStyles.module.css"
import Panel from "../../../../packages/react/src/components/Panel/Panel"
import ActiveFilters from "../../../../packages/react/src/components/SortAndFilterPanel/InternalComponents/ActiveFilters/ActiveFilters"
import filterStyles from "../../../../packages/react/src/components/SortAndFilterPanel/InternalComponents/ActiveFilters/ActiveFiltersStyles.module.css"
import { resolveSortAndFilterPanelLabels } from "../../../../packages/react/src/components/SortAndFilterPanel/labels"
import { createQueryFilterGroupDraftFromCriteria } from "../../../../packages/react/src/components/Table/filterDraft"
import Text from "../../../../packages/react/src/components/Text/Text"
import textStyles from "../../../../packages/react/src/components/Text/TextStyles.module.css"

let sheet: HTMLStyleElement
const base = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../packages/react/src/components")
beforeEach(() => {
  sheet = document.createElement("style")
  sheet.textContent = [
    ["SortAndFilterPanel/InternalComponents/ActiveFilters/ActiveFiltersStyles.module.css", filterStyles],
    ["Text/TextStyles.module.css", textStyles],
    ["Button/ButtonStyles.module.css", buttonStyles],
  ]
    .map(([path, names]) =>
      readFileSync(resolve(base, path as string), "utf8").replace(/\.([A-Za-z][\w-]*)/g, (selector, name) =>
        (names as Record<string, string>)[name] ? `.${(names as Record<string, string>)[name]}` : selector,
      ),
    )
    .join("\n")
  document.head.append(sheet)
})
afterEach(() => {
  cleanup()
  sheet.remove()
})

it("retains ancestor text styles, Text-owned font classes, explicit resets and the original editor", () => {
  const changed = vi.fn()
  const tree = (spacing: number) => (
    <Panel isOpen customStyles={{ letterSpacing: spacing, fontStyle: "italic", textAlign: "right" }}>
      <Dialog aria-label="Typography" style={{ textAlign: "left" }}>
        <Text data-testid="inherited">Inherited</Text>
        <Button>
          <Text data-testid="button-child">Button child</Text>
        </Button>
        <Text data-testid="cleared" customStyles={{ letterSpacing: 9 }} style={{ letterSpacing: undefined }}>
          Cleared
        </Text>
        <input aria-label="Held" value="held" onChange={changed} />
      </Dialog>
    </Panel>
  )
  const view = render(tree(2))
  const panel = screen.getByTestId("panel"),
    child = screen.getByTestId("inherited"),
    editor = screen.getByLabelText("Held")
  expect(panel.style.letterSpacing).toBe("2px")
  expect(panel.style.fontStyle).toBe("italic")
  expect(screen.getByRole("dialog").style.textAlign).toBe("left")
  expect(child).toHaveClass(textStyles.b10, textStyles["fw-regular"])
  expect(child.style.fontStyle).toBe("")
  expect(screen.getByTestId("cleared").style.letterSpacing).toBe("")
  expect(getComputedStyle(screen.getByRole("button")).letterSpacing).toBe("normal")
  view.rerender(tree(0))
  expect(screen.getByTestId("panel")).toBe(panel)
  expect(screen.getByLabelText("Held")).toBe(editor)
  expect(editor).toHaveValue("held")
  expect(changed).not.toHaveBeenCalled()
})

it("constructs the canonical outer filter scroller and separate parameter scroller on their original hosts", () => {
  const criterion = { id: "name", name: "Name", dataType: "text", allowedOperationCodes: ["like"] } as const
  const labels = resolveSortAndFilterPanelLabels()
  const group = createQueryFilterGroupDraftFromCriteria({ ...criterion, allowedOperationCodes: ["like"] })
  const { container } = render(
    <ActiveFilters
      filterGroupDrafts={[group]}
      availableFilterCriteria={[{ ...criterion, allowedOperationCodes: ["like"] }]}
      labels={labels}
      onChangeFilterGroupJoinOperator={vi.fn()}
      onAddFilterParameter={vi.fn()}
      onModifyFilterClause={vi.fn()}
      onDeleteFilterParameter={vi.fn()}
    />,
  )
  const outer = container.querySelector(`.${filterStyles.activeFilters}`)!
  const inner = outer.querySelector(`.${filterStyles.activeFilters__parameterList}`)!
  expect(getComputedStyle(outer).overflowY).toBe("scroll")
  expect(getComputedStyle(inner).overflowY).toBe("scroll")
  expect(inner).toHaveAttribute("aria-label", labels.activeFilters.activeFiltersListAriaLabel)
  expect(inner.querySelectorAll("input").length).toBeGreaterThan(0)
})
