import { Time } from "@internationalized/date"
import { act, cleanup, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { I18nProvider } from "react-aria-components"
import { afterEach, expect, it, vi } from "vitest"

import TimePicker from "../../../../packages/react/src/components/TimePicker/TimePicker"

afterEach(() => {
  document.querySelector<HTMLButtonElement>("[data-event-outside]")?.focus()
  cleanup()
  vi.restoreAllMocks()
})
const content = (
  <>
    <button data-event-outside>Outside field</button>
  </>
)
const icon = (
  <>
    <button>Icon action</button>
    <input aria-label="Icon editor" />
  </>
)

it("navigates all authored focusable descendants in reading order without wrapping", async () => {
  render(
    <>
      {content}
      <TimePicker value={new Time(13, 45)} aria-label="Clock" ComponentIcon={icon} />
    </>,
  )
  const user = userEvent.setup(),
    parts = screen.getAllByRole("spinbutton"),
    button = screen.getByRole("button", { name: "Icon action" }),
    editor = screen.getByRole("textbox", { name: "Icon editor" })
  act(() => parts[0].focus())
  for (const expected of [parts[1], button, editor, editor]) {
    await user.keyboard("{ArrowRight}")
    expect(document.activeElement).toBe(expected)
  }
  for (const expected of [button, parts[1], parts[0], parts[0]]) {
    await user.keyboard("{ArrowLeft}")
    expect(document.activeElement).toBe(expected)
  }
})

it("retains source value-request, down and up order on an unchanged segment", async () => {
  const events: string[] = []
  render(
    <>
      {content}
      <TimePicker
        value={new Time(13, 45)}
        aria-label="Clock"
        onChange={() => events.push("change")}
        onKeyDown={() => events.push("down")}
        onKeyUp={() => events.push("up")}
      />
    </>,
  )
  act(() => screen.getAllByRole("spinbutton")[0].focus())
  await userEvent.setup().keyboard("{ArrowUp}")
  expect(events).toEqual(["change", "down", "down", "up", "up"])
})

it("delivers key up on the newly focused icon through its actual single group path", async () => {
  const down = vi.fn(),
    up = vi.fn()
  render(
    <>
      {content}
      <TimePicker value={new Time(13, 45)} aria-label="Clock" ComponentIcon={icon} onKeyDown={down} onKeyUp={up} />
    </>,
  )
  act(() => screen.getAllByRole("spinbutton")[1].focus())
  await userEvent.setup().keyboard("{ArrowRight}")
  const button = screen.getByRole("button", { name: "Icon action" })
  expect(document.activeElement).toBe(button)
  expect(down).toHaveBeenCalledTimes(1)
  expect(up).toHaveBeenCalledTimes(1)
  expect(up.mock.calls[0][0].target).toBe(button)
})

it("honors an authored child's propagation stop before group navigation", async () => {
  const field = vi.fn(),
    child = vi.fn((event) => event.stopPropagation())
  render(
    <>
      {content}
      <TimePicker
        value={new Time(13, 45)}
        aria-label="Clock"
        onKeyDown={field}
        ComponentIcon={
          <>
            <button onKeyDown={child}>Stopped action</button>
            <input aria-label="Following editor" />
          </>
        }
      />
    </>,
  )
  const button = screen.getByRole("button", { name: "Stopped action" })
  act(() => button.focus())
  await userEvent.setup().keyboard("{ArrowRight}")
  expect(child).toHaveBeenCalledTimes(1)
  expect(field).not.toHaveBeenCalled()
  expect(document.activeElement).toBe(button)
})

it("lets a field callback veto an authored editor's edit before its default", async () => {
  const down = vi.fn((event) => event.preventDefault()),
    up = vi.fn()
  render(
    <>
      {content}
      <TimePicker value={new Time(13, 45)} aria-label="Clock" ComponentIcon={icon} onKeyDown={down} onKeyUp={up} />
    </>,
  )
  const editor = screen.getByRole("textbox", { name: "Icon editor" })
  act(() => editor.focus())
  await userEvent.setup().keyboard("2")
  expect(down).toHaveBeenCalledTimes(1)
  expect(up).toHaveBeenCalledTimes(1)
  expect(editor).toHaveValue("")
})

it("includes authored focusables in RTL physical-neighbor selection", async () => {
  render(
    <>
      {content}
      <I18nProvider locale="ar-EG">
        <TimePicker value={new Time(13, 45)} aria-label="Clock" ComponentIcon={icon} />
      </I18nProvider>
    </>,
  )
  const parts = screen.getAllByRole("spinbutton"),
    button = screen.getByRole("button", { name: "Icon action" }),
    editor = screen.getByRole("textbox", { name: "Icon editor" })
  const targets = [...parts, button, editor]
  const positions = [30, 80, 50, 100]
  positions.forEach((left, index) =>
    vi.spyOn(targets[index], "getBoundingClientRect").mockReturnValue(new DOMRect(left, 0, 10, 20)),
  )
  act(() => parts[0].focus())
  await userEvent.setup().keyboard("{ArrowRight}")
  expect(document.activeElement).toBe(button)
})
