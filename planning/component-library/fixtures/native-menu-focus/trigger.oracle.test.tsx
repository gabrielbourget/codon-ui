import { writeFileSync } from "node:fs"
import { createRef } from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { Button, MenuTrigger, I18nProvider } from "react-aria-components"
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest"

import {
  nativeMenuTriggerMessages,
  nativeMenuLongPressDescription,
} from "../../../../packages/react-native/src/components/Menu/triggerMessages"

import Menu from "../../../../packages/react/src/components/Menu/Menu"
import MenuItem from "../../../../packages/react/src/components/Menu/components/MenuItem"

const originalPointerEvent = globalThis.PointerEvent
beforeAll(() => {
  if (!globalThis.PointerEvent)
    globalThis.PointerEvent = class extends MouseEvent {
      pointerType: string
      pointerId: number
      width: number
      height: number
      pressure: number
      isPrimary: boolean
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init)
        this.pointerType = init.pointerType ?? "mouse"
        this.pointerId = init.pointerId ?? 1
        this.width = init.width ?? 1
        this.height = init.height ?? 1
        this.pressure = init.pressure ?? 0.5
        this.isPrimary = init.isPrimary ?? true
      }
    } as typeof PointerEvent
})
const records: unknown[] = []
afterAll(() => {
  globalThis.PointerEvent = originalPointerEvent
  const path = process.env.CODON_MENU_TRIGGER_OBSERVATIONS
  if (path) writeFileSync(path, JSON.stringify(records, null, 2))
})
afterEach(() => vi.useRealTimers())
const content = (trigger: "press" | "longPress" = "press", selected = false) => (
  <MenuTrigger trigger={trigger}>
    <Button>Open actions</Button>
    <Menu
      isNonModal
      selectionMode="single"
      selectedKeys={selected ? new Set(["b"]) : new Set()}
      shouldCloseOnSelect={false}
    >
      <MenuItem id="a" data-testid="a">
        Alpha
      </MenuItem>
      <MenuItem id="b" data-testid="b">
        Beta
      </MenuItem>
    </Menu>
  </MenuTrigger>
)

it("opens ordinary mouse input on press start and initially focuses the collection", async () => {
  render(content())
  const button = screen.getByRole("button", { name: "Open actions" })
  fireEvent.pointerDown(button, {
    pointerType: "mouse",
    pointerId: 1,
    isPrimary: true,
    width: 2,
    height: 2,
    pressure: 0.5,
    detail: 1,
    button: 0,
    buttons: 1,
  })
  const menu = await screen.findByRole("menu")
  await waitFor(() => expect(document.activeElement).toBe(menu))
  records.push({ kind: "mouse", phase: "down", focus: "collection" })
  fireEvent.pointerUp(button, {
    pointerType: "mouse",
    pointerId: 1,
    isPrimary: true,
    width: 2,
    height: 2,
    pressure: 0.5,
    detail: 1,
    button: 0,
    buttons: 0,
  })
})

it.each(["{ArrowDown}", "{ArrowUp}"])("prefers the current selectable owner selection for %s", async (key) => {
  render(content("press", true))
  const user = userEvent.setup()
  await user.tab()
  await user.keyboard(key)
  await screen.findByRole("menu")
  await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId("b")))
  records.push({ kind: key, focus: "selected b" })
})

it("requires Alt arrows for a long-press trigger and retains the native button description", async () => {
  render(content("longPress"))
  const user = userEvent.setup()
  await user.tab()
  await user.keyboard("{Enter}{ArrowDown}")
  expect(screen.queryByRole("menu")).toBeNull()
  expect(screen.getByRole("button", { name: "Open actions" })).toHaveAccessibleDescription(
    "Long press or press Alt + ArrowDown to open menu",
  )
  await user.keyboard("{Alt>}{ArrowDown}{/Alt}")
  await screen.findByRole("menu")
  await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId("a")))
  records.push({ kind: "longPress keyboard", enterAndPlainArrow: false, altArrow: true })
})

it("opens a held physical-pointer model at the pinned threshold without a release reopen", () => {
  vi.useFakeTimers()
  render(content("longPress"))
  const button = screen.getByRole("button", { name: "Open actions" })
  const physical = {
    pointerType: "mouse",
    pointerId: 1,
    isPrimary: true,
    width: 2,
    height: 2,
    pressure: 0.5,
    detail: 1,
    button: 0,
    buttons: 1,
  }
  fireEvent.pointerDown(button, physical)
  act(() => {
    vi.advanceTimersByTime(499)
  })
  expect(screen.queryByRole("menu")).toBeNull()
  act(() => {
    vi.advanceTimersByTime(1)
  })
  expect(screen.getByRole("menu")).toBeTruthy()
  fireEvent.pointerUp(button, { ...physical, buttons: 0 })
  expect(screen.getByRole("menu")).toBeTruthy()
  records.push({ kind: "longPress physical-pointer model", threshold: 500, releaseReopen: false })
})

it("retains repeated owner-vetoed arrow requests from the original focused trigger", () => {
  const requested = vi.fn()
  render(
    <MenuTrigger isOpen={false} onOpenChange={requested}>
      <Button>Open held actions</Button>
      <Menu>
        <MenuItem id="a">Alpha</MenuItem>
      </Menu>
    </MenuTrigger>,
  )
  const trigger = screen.getByRole("button", { name: "Open held actions" })
  fireEvent.keyDown(trigger, { key: "ArrowDown", code: "ArrowDown", repeat: false })
  fireEvent.keyDown(trigger, { key: "ArrowDown", code: "ArrowDown", repeat: true })
  expect(requested.mock.calls).toEqual([[true], [true]])
  expect(screen.queryByRole("menu")).toBeNull()
  records.push({ repeatWhileVetoed: true, requests: requested.mock.calls.length })
})

it("retains all 34 actual pinned localized long-press descriptions", () => {
  for (const locale of Object.keys(nativeMenuTriggerMessages)) {
    const view = render(<I18nProvider locale={locale}>{content("longPress")}</I18nProvider>)
    expect(screen.getByRole("button", { name: "Open actions" })).toHaveAccessibleDescription(
      nativeMenuLongPressDescription(locale),
    )
    view.unmount()
  }
  records.push({ localizedDescriptions: 34 })
})

it("keeps focus outside a directly controlled nonmodal popover without a menu-trigger strategy", async () => {
  const trigger = createRef<HTMLButtonElement>()
  render(
    <>
      <Button ref={trigger}>External trigger</Button>
      <Menu isOpen triggerRef={trigger} isNonModal selectionMode="single" selectedKeys={new Set(["b"])}>
        <MenuItem id="a">Alpha</MenuItem>
        <MenuItem id="b">Beta</MenuItem>
      </Menu>
    </>,
  )
  const menu = await screen.findByRole("menu")
  await act(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  expect(document.activeElement).toBe(document.body)
  records.push({ kind: "direct controlled nonmodal menu", focus: "unchanged", selectedOverride: false })
})
