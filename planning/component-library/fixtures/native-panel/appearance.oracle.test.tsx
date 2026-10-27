import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { useState, type CSSProperties } from "react"
import { createPortal } from "react-dom"
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

it("restores the canonical overlay stylesheet background after undefined inline paint while retaining the original editor", () => {
  const sheet = document.createElement("style")
  sheet.textContent = readFileSync(path, "utf8").replace(/\.([A-Za-z][\w-]*)/g, (selector, name) =>
    (styles as Record<string, string>)[name] ? `.${(styles as Record<string, string>)[name]}` : selector,
  )
  document.head.append(sheet)
  try {
    const changed = vi.fn()
    const tree = (backgroundColor?: string) => (
      <Panel isOpen customOverlayStyles={{ backgroundColor }}>
        <input aria-label="Overlay held editor" value="held" onChange={changed} />
      </Panel>
    )
    const view = render(tree("plum"))
    const panel = screen.getByTestId("panel"),
      editor = screen.getByLabelText("Overlay held editor")
    const overlay = panel.closest(`.${styles["panel__overlay"]}`) as HTMLElement
    expect(overlay.style.backgroundColor).toBe("plum")
    view.rerender(tree())
    expect(overlay.style.backgroundColor).toBe("")
    expect(getComputedStyle(overlay).backgroundColor).toBe("rgba(0, 0, 0, 0.3)")
    view.rerender(tree("transparent"))
    expect(getComputedStyle(overlay).backgroundColor).toBe("rgba(0, 0, 0, 0)")
    expect(screen.getByTestId("panel")).toBe(panel)
    expect(screen.getByLabelText("Overlay held editor")).toBe(editor)
    expect(editor).toHaveValue("held")
    expect(changed).not.toHaveBeenCalled()
  } finally {
    sheet.remove()
  }
})

it("owns overlay filter, blend, isolation and stacking on the common original ancestor", () => {
  const changed = vi.fn()
  const tree = (overlay?: CSSProperties) => (
    <Panel isOpen customStyles={{ filter: "contrast(150%)" }} customOverlayStyles={overlay}>
      <input aria-label="Compositor editor" value="held" onChange={changed} />
      {createPortal(<div data-testid="escaped-compositor">Portal content</div>, document.body)}
    </Panel>
  )
  const view = render(
    tree({ filter: "brightness(50%) opacity(25%)", mixBlendMode: "multiply", isolation: "isolate", zIndex: 50 }),
  )
  const panel = screen.getByTestId("panel"),
    editor = screen.getByLabelText("Compositor editor")
  const overlay = panel.closest(`.${styles["panel__overlay"]}`) as HTMLElement
  expect(overlay.style.filter).toBe("brightness(50%) opacity(25%)")
  expect(overlay.style.mixBlendMode).toBe("multiply")
  expect(overlay.style.isolation).toBe("isolate")
  expect(overlay.style.zIndex).toBe("50")
  expect(panel.style.filter).toBe("contrast(150%)")
  expect(overlay).toContainElement(editor)
  expect(overlay).not.toContainElement(screen.getByTestId("escaped-compositor"))
  view.rerender(tree({ filter: "none", mixBlendMode: "normal", isolation: "auto", zIndex: 0 }))
  expect(overlay.style.filter).toBe("none")
  expect(overlay.style.zIndex).toBe("0")
  view.rerender(tree())
  for (const field of ["filter", "mixBlendMode", "isolation", "zIndex"] as const) expect(overlay.style[field]).toBe("")
  expect(screen.getByTestId("panel")).toBe(panel)
  expect(screen.getByLabelText("Compositor editor")).toBe(editor)
  expect(editor).toHaveValue("held")
  expect(changed).not.toHaveBeenCalled()
})

it("owns overlay transforms around the original Panel and editor while authored portals escape them", () => {
  const changed = vi.fn()
  const tree = (transform?: string, transformOrigin?: string) => (
    <Panel isOpen customOverlayStyles={{ transform, transformOrigin }}>
      <input aria-label="Transform editor" value="held" onChange={changed} />
      {createPortal(<div data-testid="escaped-transform">Portal content</div>, document.body)}
    </Panel>
  )
  const view = render(tree("translateX(40px) rotate(8deg) scale(0.8)", "0px 0px"))
  const panel = screen.getByTestId("panel"),
    editor = screen.getByLabelText("Transform editor")
  const overlay = panel.closest(`.${styles["panel__overlay"]}`) as HTMLElement
  expect(overlay.style.transform).toBe("translateX(40px) rotate(8deg) scale(0.8)")
  expect(overlay.style.transformOrigin).toBe("0px 0px")
  expect(overlay).toContainElement(panel)
  expect(overlay).toContainElement(editor)
  expect(overlay).not.toContainElement(screen.getByTestId("escaped-transform"))
  view.rerender(tree("scaleX(-1)", "right bottom"))
  expect(overlay.style.transform).toBe("scaleX(-1)")
  expect(overlay.style.transformOrigin).toBe("right bottom")
  view.rerender(tree())
  expect(overlay.style.transform).toBe("")
  expect(overlay.style.transformOrigin).toBe("")
  expect(screen.getByTestId("panel")).toBe(panel)
  expect(screen.getByLabelText("Transform editor")).toBe(editor)
  expect(editor).toHaveValue("held")
  expect(changed).not.toHaveBeenCalled()
})

it("owns overlay opacity on the common Panel/editor ancestor while authored portals escape it", () => {
  const changed = vi.fn()
  const tree = (opacity?: number) => (
    <Panel isOpen customStyles={{ opacity: 0.6 }} customOverlayStyles={{ opacity }}>
      <input aria-label="Opacity editor" value="held" onChange={changed} />
      {createPortal(<div data-testid="escaped-opacity">Portal content</div>, document.body)}
    </Panel>
  )
  const view = render(tree(0.4))
  const panel = screen.getByTestId("panel"),
    editor = screen.getByLabelText("Opacity editor")
  const overlay = panel.closest(`.${styles["panel__overlay"]}`) as HTMLElement
  expect(overlay.style.opacity).toBe("0.4")
  expect(panel.style.opacity).toBe("0.6")
  expect(overlay).toContainElement(editor)
  expect(overlay).not.toContainElement(screen.getByTestId("escaped-opacity"))
  view.rerender(tree(0.8))
  expect(overlay.style.opacity).toBe("0.8")
  view.rerender(tree(0))
  expect(overlay.style.opacity).toBe("0")
  view.rerender(tree(undefined))
  expect(overlay.style.opacity).toBe("")
  expect(screen.getByTestId("panel")).toBe(panel)
  expect(screen.getByLabelText("Opacity editor")).toBe(editor)
  expect(editor).toHaveValue("held")
  expect(changed).not.toHaveBeenCalled()
})

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

it("contains sibling controls in the enclosing Panel scope after a child Dialog opts in", async () => {
  const user = userEvent.setup()
  render(
    <Panel isOpen>
      <button>Before dialog</button>
      <Dialog aria-label="Scope requester">
        <input aria-label="Inside requester" />
      </Dialog>
      <button>After dialog</button>
    </Panel>,
  )
  expect(screen.getByRole("dialog", { name: "Scope requester" })).toHaveFocus()
  screen.getByRole("button", { name: "After dialog" }).focus()
  expect(screen.getByRole("button", { name: "After dialog" })).toHaveFocus()
  await user.tab()
  expect(screen.getByRole("button", { name: "Before dialog" })).toHaveFocus()
  await user.tab({ shift: true })
  expect(screen.getByRole("button", { name: "After dialog" })).toHaveFocus()
})

it("retains the enclosing Panel containment request after its requesting Dialog unmounts", async () => {
  const user = userEvent.setup()
  const node = (dialog: boolean) => (
    <Panel isOpen>
      <button>Remaining first</button>
      {dialog && (
        <Dialog aria-label="Temporary requester">
          <input aria-label="Temporary editor" />
        </Dialog>
      )}
      <button>Remaining last</button>
    </Panel>
  )
  const view = render(node(true))
  view.rerender(node(false))
  screen.getByRole("button", { name: "Remaining last" }).focus()
  await user.tab()
  expect(screen.getByRole("button", { name: "Remaining first" })).toHaveFocus()
})

it("retains the original empty Dialog root for both traversal directions", async () => {
  const user = userEvent.setup()
  render(
    <Panel isOpen>
      <Dialog aria-label="Empty scope" />
    </Panel>,
  )
  const dialog = screen.getByRole("dialog", { name: "Empty scope" })
  expect(dialog).toHaveFocus()
  await user.tab()
  expect(dialog).toHaveFocus()
  await user.tab({ shift: true })
  expect(dialog).toHaveFocus()
})

it("recovers escaped focus to the latest eligible original in-scope control", async () => {
  const changed = vi.fn()
  render(
    <>
      <button>Outside</button>
      <Panel isOpen>
        <Dialog aria-label="Recovery scope">
          <input aria-label="Original blank" value="" onChange={changed} />
          <button>Latest target</button>
        </Dialog>
      </Panel>
    </>,
  )
  const original = screen.getByLabelText("Original blank")
  const latest = screen.getByRole("button", { name: "Latest target" })
  latest.focus()
  expect(latest).toHaveFocus()
  screen.getByText("Outside").focus()
  await waitFor(() => expect(latest).toHaveFocus())
  expect(screen.getByLabelText("Original blank")).toBe(original)
  expect(original).toHaveValue("")
  expect(changed).not.toHaveBeenCalled()
})

it("gives the nested Dialog scope traversal and restores its original parent control on close", async () => {
  const user = userEvent.setup(),
    changed = vi.fn()
  const Scene = () => {
    const [open, setOpen] = useState(false)
    return (
      <Panel isOpen>
        <Dialog aria-label="Parent scope">
          <input aria-label="Parent blank" value="" onChange={changed} />
          <button onClick={() => setOpen(true)}>Open nested</button>
          <Panel isOpen={open} onOpenChange={setOpen}>
            <Dialog aria-label="Nested scope">
              <button>Nested first</button>
              <button onClick={() => setOpen(false)}>Close nested</button>
            </Dialog>
          </Panel>
        </Dialog>
      </Panel>
    )
  }
  render(<Scene />)
  const original = screen.getByLabelText("Parent blank"),
    opener = screen.getByRole("button", { name: "Open nested" })
  await user.click(opener)
  expect(screen.getByRole("dialog", { name: "Nested scope" })).toHaveFocus()
  await user.tab({ shift: true })
  expect(screen.getByRole("button", { name: "Close nested" })).toHaveFocus()
  await user.tab()
  expect(screen.getByRole("button", { name: "Nested first" })).toHaveFocus()
  await user.click(screen.getByRole("button", { name: "Close nested" }))
  await waitFor(() => expect(opener).toHaveFocus())
  expect(screen.getByLabelText("Parent blank")).toBe(original)
  expect(original).toHaveValue("")
  expect(changed).not.toHaveBeenCalled()
})

it("keeps an authored raw portal outside Dialog containment while retaining its original controls", async () => {
  const changed = vi.fn()
  render(
    <Panel isOpen>
      <Dialog aria-label="Portal owner">
        <input aria-label="Portal blank" value="" onChange={changed} />
      </Dialog>
      {createPortal(<button data-testid="authored-portal-focus">Authored portal control</button>, document.body)}
    </Panel>,
  )
  const original = screen.getByLabelText("Portal blank"),
    portal = screen.getByTestId("authored-portal-focus")
  original.focus()
  portal.focus()
  await waitFor(() => expect(original).toHaveFocus())
  expect(screen.getByLabelText("Portal blank")).toBe(original)
  expect(screen.getByTestId("authored-portal-focus")).toBe(portal)
  expect(original).toHaveValue("")
  expect(changed).not.toHaveBeenCalled()
})
