import { writeFileSync } from "node:fs"
import { render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { createRef, useContext } from "react"
import {
  Button,
  MenuTrigger,
  MenuStateContext,
  SeparatorContext,
  type MenuItemRenderProps,
} from "react-aria-components"
import { afterAll, expect, it, vi } from "vitest"

import Menu from "../../../../packages/react/src/components/Menu/Menu"
import MenuSeparator from "../../../../packages/react/src/components/Menu/components/MenuSeparator"
import MenuItem from "../../../../packages/react/src/components/Menu/components/MenuItem"

const observations: unknown[] = []
afterAll(() => {
  const path = process.env.CODON_MENU_ITEM_OBSERVATIONS
  if (path) writeFileSync(path, JSON.stringify(observations, null, 2))
})

it.each(["none", "single", "multiple"] as const)(
  "retains original custom-root refs, values and full %s render state",
  async (selectionMode) => {
    const original = { id: 0, label: "Original value" },
      ref = createRef<HTMLDivElement>(),
      action = vi.fn()
    let state: React.ContextType<typeof MenuStateContext>
    let rendered: MenuItemRenderProps | undefined
    const Capture = () => {
      state = useContext(MenuStateContext)
      return null
    }
    render(
      <MenuTrigger defaultOpen>
        <Button>Open actions</Button>
        <Menu
          isNonModal
          selectionMode={selectionMode}
          selectedKeys={new Set([0])}
          shouldCloseOnSelect={false}
          onAction={action}
        >
          <MenuItem
            id={0}
            value={original}
            ref={ref}
            textValue="Original value"
            icon={<span data-testid="original-icon">Icon</span>}
            render={(props, values) => {
              rendered = values
              return <div {...props} data-testid="custom-item" />
            }}
          >
            <Capture />
            Original value
          </MenuItem>
        </Menu>
      </MenuTrigger>,
    )
    const item = await screen.findByTestId("custom-item")
    expect(ref.current).toBe(item)
    expect(state!.collection.getItem(0)!.value).toBe(original)
    expect(Object.isFrozen(original)).toBe(false)
    expect(screen.getByTestId("original-icon")).toBeTruthy()
    expect(rendered).toMatchObject({
      isSelected: selectionMode !== "none",
      isDisabled: false,
      isHovered: false,
      isPressed: false,
      selectionMode,
      selectionBehavior: "toggle",
      hasSubmenu: false,
      isOpen: false,
    })
    expect(typeof rendered!.isFocused).toBe("boolean")
    expect(typeof rendered!.isFocusVisible).toBe("boolean")
    const user = userEvent.setup()
    await user.hover(item)
    expect(rendered!.isHovered).toBe(true)
    await user.click(item)
    expect(action).toHaveBeenCalledWith(0)
    expect(ref.current).toBe(item)
    observations.push({ selectionMode, flags: Object.keys(rendered!).sort(), sameRef: true, sameValue: true })
  },
)

it("replaces only the requested original custom host and keeps callbacks current", async () => {
  const ref = createRef<HTMLDivElement>(),
    first = vi.fn(),
    second = vi.fn()
  const content = (version: number, action: () => void) => (
    <MenuTrigger defaultOpen>
      <Button>Open actions</Button>
      <Menu isNonModal shouldCloseOnSelect={false}>
        <MenuItem
          id="item"
          ref={ref}
          onAction={action}
          render={(props) => <div {...props} key={version} data-testid="replace-item" />}
        >
          Item
        </MenuItem>
      </Menu>
    </MenuTrigger>
  )
  const view = render(content(0, first))
  const original = await screen.findByTestId("replace-item")
  view.rerender(content(0, second))
  expect(ref.current).toBe(original)
  view.rerender(content(1, second))
  const replacement = screen.getByTestId("replace-item")
  expect(ref.current).toBe(replacement)
  expect(replacement).not.toBe(original)
  await userEvent.setup().click(replacement)
  expect(first).not.toHaveBeenCalled()
  expect(second).toHaveBeenCalledTimes(1)
  observations.push({ customHostReplacement: true, originalRefRetainedUntilReplacement: true, currentCallbacks: true })
})

it("retains explicit separator custom rendering and resets ancestor default props", async () => {
  const ref = createRef<HTMLElement>()
  let value: unknown = "unseen"
  const content = (custom: boolean) => (
    <SeparatorContext.Provider
      value={{ ref, style: { opacity: 0.4 }, render: (props) => <div {...props} data-testid="ignored-separator" /> }}
    >
      <MenuTrigger defaultOpen>
        <Button>Open separator menu</Button>
        <Menu isNonModal>
          <MenuItem id="a">Alpha</MenuItem>
          <MenuSeparator
            style={{ opacity: 0.7 }}
            render={
              custom
                ? (props, state) => {
                    value = state
                    return <div {...props} data-testid="custom-separator" />
                  }
                : undefined
            }
          />
          <MenuItem id="b">Beta</MenuItem>
        </Menu>
      </MenuTrigger>
    </SeparatorContext.Provider>
  )
  const view = render(content(true))
  const host = await screen.findByTestId("custom-separator")
  expect(host).toHaveStyle({ opacity: "0.7" })
  expect(value).toBeUndefined()
  expect(ref.current).toBeNull()
  expect(screen.queryByTestId("ignored-separator")).toBeNull()
  view.rerender(content(false))
  expect(screen.queryByTestId("custom-separator")).toBeNull()
  expect(screen.queryByTestId("ignored-separator")).toBeNull()
  expect(screen.getByRole("separator")).toBe(screen.getByTestId("menu-separator"))
  observations.push({ separatorExplicitRender: true, ancestorDefaultsReset: true })
})
