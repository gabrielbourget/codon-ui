import { writeFileSync } from "node:fs"
import { act, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { afterAll, expect, it, vi } from "vitest"
import Breadcrumbs from "../../../../packages/react/src/components/Breadcrumbs/Breadcrumbs"

const observations: unknown[] = []
afterAll(() =>
  writeFileSync(
    "/private/tmp/codon-native-breadcrumbs-selection-oracle.json",
    JSON.stringify(observations, null, 2) + "\n",
  ),
)
it.each(["#destination", ""])(
  "records actual canonical overflow keyboard/pointer semantics for href=%j",
  async (href) => {
    const navigate = vi.fn()
    const items = ["A", "B", "C", "D", "E", "F"].map((content) => ({ id: content, content, href, disabled: false }))
    render(
      <Breadcrumbs
        items={items}
        maxVisibleItems={3}
        onNavigate={navigate}
        customClickPopoverProps={{ isOpen: true }}
      />,
    )
    const user = userEvent.setup()
    const option = screen.getByRole("option", { name: "C" })
    const states: unknown[] = []
    const record = (step: string) =>
      states.push({
        step,
        selected: option.getAttribute("aria-selected"),
        focused: document.activeElement === option,
        navigations: navigate.mock.calls.length,
      })
    await act(() => option.focus())
    record("focus")
    await user.keyboard(" ")
    record("space")
    await user.keyboard("{Enter}")
    record("enter-while-selected")
    await user.click(option)
    record("click-after-space")
    await user.keyboard("{Enter}")
    record("enter")
    expect(option).toBeInTheDocument()
    expect(states).toEqual(
      href
        ? [
            { step: "focus", selected: "false", focused: true, navigations: 0 },
            { step: "space", selected: "false", focused: true, navigations: 0 },
            { step: "enter-while-selected", selected: "false", focused: true, navigations: 1 },
            { step: "click-after-space", selected: "false", focused: true, navigations: 2 },
            { step: "enter", selected: "false", focused: true, navigations: 3 },
          ]
        : [
            { step: "focus", selected: "false", focused: true, navigations: 0 },
            { step: "space", selected: "true", focused: true, navigations: 0 },
            { step: "enter-while-selected", selected: "true", focused: true, navigations: 0 },
            { step: "click-after-space", selected: "false", focused: true, navigations: 0 },
            { step: "enter", selected: "false", focused: true, navigations: 1 },
          ],
    )
    for (const [details] of navigate.mock.calls) {
      expect(details.item).toBe(items[2])
      expect(details.href).toBe(href)
      expect(details.target).toBe("_blank")
    }
    observations.push({ href, states })
  },
)
