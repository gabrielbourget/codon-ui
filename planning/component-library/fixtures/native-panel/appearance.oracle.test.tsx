import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { cleanup, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { Dialog } from "react-aria-components"
import { afterEach, expect, it, vi } from "vitest"

import Panel from "../../../../packages/react/src/components/Panel/Panel"
import styles from "../../../../packages/react/src/components/Panel/PanelStyles.module.css"

afterEach(cleanup)
const path = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../packages/react/src/components/Panel/PanelStyles.module.css",
)

it("owns all350ms ease-in-out style transitions on the actual Panel root, with an independent overlay", () => {
  const sheet = document.createElement("style")
  sheet.textContent = readFileSync(path, "utf8")
  document.head.append(sheet)
  try {
    const rules = [...sheet.sheet!.cssRules] as CSSStyleRule[]
    expect(rules.find((rule) => rule.selectorText === ".panel")!.style.getPropertyValue("transition")).toBe(
      "all 350ms ease-in-out",
    )
    expect(rules.find((rule) => rule.selectorText === ".panel__overlay")!.style.getPropertyValue("transition")).toBe("")
    render(<Panel isOpen>Owned phrase</Panel>)
    expect(screen.getByTestId("panel")).toHaveClass(styles.panel)
  } finally {
    sheet.remove()
  }
})

it("retains custom/final precedence and original editor while changing the entire inline appearance", () => {
  const changed = vi.fn()
  const tree = (expanded: boolean) => (
    <Panel
      isOpen
      width={200}
      customStyles={{
        padding: expanded ? 24 : 4,
        opacity: expanded ? 0.2 : 1,
        fontSize: expanded ? 32 : 12,
        borderWidth: expanded ? 5 : 1,
        color: "red",
        boxShadow: expanded ? "0 8px 12px 4px blue" : "none",
      }}
      style={{ width: expanded ? "50%" : 300, paddingLeft: expanded ? 48 : 8, fontWeight: expanded ? 800 : 400 }}
      customOverlayStyles={{ backgroundColor: expanded ? "plum" : "gold" }}
    >
      Raw phrase
      <input aria-label="Held editor" value="held" onChange={changed} />
    </Panel>
  )
  const view = render(tree(false))
  const editor = screen.getByLabelText("Held editor")
  const panel = screen.getByTestId("panel")
  expect(panel.style.width).toBe("300px")
  view.rerender(tree(true))
  expect(panel.style.width).toBe("50%")
  expect(panel.style.padding).toBe("24px 24px 24px 48px")
  expect(panel.style.opacity).toBe("0.2")
  expect(panel.style.fontSize).toBe("32px")
  expect(panel.style.fontWeight).toBe("800")
  expect(panel.style.borderWidth).toBe("5px")
  expect(panel.style.boxShadow).toBe("0 8px 12px 4px blue")
  expect(screen.getByLabelText("Held editor")).toBe(editor)
  expect(editor).toHaveValue("held")
  expect(changed).not.toHaveBeenCalled()
})

it("leaves entry and Tab order to arbitrary children when no child Dialog enables containment", async () => {
  const user = userEvent.setup()
  render(
    <Panel isOpen>
      <button disabled>Disabled first</button>
      <button>First</button>
      <input aria-label="Middle" defaultValue="held" />
      <button>Last</button>
    </Panel>,
  )
  const first = screen.getByRole("button", { name: "First" })
  expect(screen.getByTestId("panel")).not.toHaveAttribute("tabindex")
  expect(document.body).toHaveFocus()
  await user.tab()
  expect(first).toHaveFocus()
  await user.tab()
  expect(screen.getByLabelText("Middle")).toHaveFocus()
  expect((screen.getByLabelText("Middle") as HTMLInputElement).selectionStart).toBe(0)
  expect((screen.getByLabelText("Middle") as HTMLInputElement).selectionEnd).toBe(4)
  await user.tab()
  expect(screen.getByRole("button", { name: "Last" })).toHaveFocus()
  await user.tab()
  expect(document.body).toHaveFocus()
  await user.tab({ shift: true })
  expect(screen.getByRole("button", { name: "Last" })).toHaveFocus()
})

it("enables actual entry and forward/backward containment when its child Dialog requests it", async () => {
  const user = userEvent.setup()
  render(
    <Panel isOpen>
      <Dialog aria-label="Composed dialog">
        <button>Dialog first</button>
        <input aria-label="Dialog middle" defaultValue="held" />
        <button>Dialog last</button>
      </Dialog>
    </Panel>,
  )
  const dialog = screen.getByRole("dialog", { name: "Composed dialog" })
  expect(screen.getByTestId("panel")).not.toHaveAttribute("tabindex")
  expect(dialog.tabIndex).toBe(-1)
  expect(dialog).toHaveFocus()
  await user.tab()
  const first = screen.getByRole("button", { name: "Dialog first" })
  expect(first).toHaveFocus()
  await user.tab({ shift: true })
  expect(screen.getByRole("button", { name: "Dialog last" })).toHaveFocus()
  await user.tab()
  expect(first).toHaveFocus()
})
