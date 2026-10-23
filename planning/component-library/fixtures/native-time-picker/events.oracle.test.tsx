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

it("includes negative tab stops in logical focus order", async () => {
  render(
    <>
      {content}
      <TimePicker
        value={new Time(13, 45)}
        aria-label="Clock"
        ComponentIcon={
          <>
            <button tabIndex={-1}>Programmatic action</button>
            <button>Tab action</button>
          </>
        }
      />
    </>,
  )
  const user = userEvent.setup(),
    parts = screen.getAllByRole("spinbutton"),
    programmatic = screen.getByRole("button", { name: "Programmatic action" }),
    tabbable = screen.getByRole("button", { name: "Tab action" })
  act(() => parts[1].focus())
  await user.keyboard("{ArrowRight}")
  expect(document.activeElement).toBe(programmatic)
  await user.keyboard("{ArrowRight}")
  expect(document.activeElement).toBe(tabbable)
  await user.keyboard("{ArrowLeft}")
  expect(document.activeElement).toBe(programmatic)
})

it("uses tab stops and first reading-order ties for physical RTL navigation", async () => {
  render(
    <>
      {content}
      <I18nProvider locale="ar-EG">
        <TimePicker
          value={new Time(13, 45)}
          aria-label="Clock"
          ComponentIcon={
            <>
              <button tabIndex={-1}>Programmatic action</button>
              <button>First tie</button>
              <button>Second tie</button>
            </>
          }
        />
      </I18nProvider>
    </>,
  )
  const parts = screen.getAllByRole("spinbutton"),
    programmatic = screen.getByRole("button", { name: "Programmatic action" }),
    first = screen.getByRole("button", { name: "First tie" }),
    second = screen.getByRole("button", { name: "Second tie" })
  const targets = [...parts, programmatic, first, second]
  const positions = [30, 80, 40, 50, 50]
  positions.forEach((left, index) =>
    vi.spyOn(targets[index], "getBoundingClientRect").mockReturnValue(new DOMRect(left, index * 30, 10, 20)),
  )
  act(() => parts[0].focus())
  await userEvent.setup().keyboard("{ArrowRight}")
  expect(document.activeElement).toBe(first)
})

it("keeps independently owned nested fields in the outer committed traversal", async () => {
  const outer = vi.fn(),
    inner = vi.fn()
  render(
    <>
      {content}
      <TimePicker
        value={new Time(13, 45)}
        aria-label="Outer clock"
        onKeyDown={outer}
        ComponentIcon={<TimePicker value={new Time(8, 15)} aria-label="Inner clock" onKeyDown={inner} />}
      />
    </>,
  )
  const parts = screen.getAllByRole("spinbutton"),
    user = userEvent.setup()
  act(() => parts[1].focus())
  await user.keyboard("{ArrowRight}")
  expect(document.activeElement).toBe(parts[2])
  expect(outer).toHaveBeenCalledTimes(1)
  expect(inner).not.toHaveBeenCalled()
  outer.mockClear()
  await user.keyboard("{ArrowRight}")
  expect(document.activeElement).toBe(parts[3])
  expect(inner).toHaveBeenCalledTimes(1)
  expect(outer).not.toHaveBeenCalled()
})

it("selects the final contiguous placeholder run at mouse start", async () => {
  render(
    <>
      {content}
      <TimePicker aria-label="Clock" />
    </>,
  )
  const user = userEvent.setup(),
    outside = screen.getByRole("button", { name: "Outside field" }),
    group = screen.getByRole("group", { name: "TimePicker Input Icon Group" }),
    parts = screen.getAllByRole("spinbutton")
  act(() => outside.focus())
  await user.pointer({ target: group, keys: "[MouseLeft>]" })
  expect(document.activeElement).toBe(parts[0])
  await user.pointer({ target: group, keys: "[/MouseLeft]" })
})

it("waits for touch release before selecting the placeholder run", async () => {
  render(
    <>
      {content}
      <TimePicker aria-label="Clock" />
    </>,
  )
  const user = userEvent.setup(),
    outside = screen.getByRole("button", { name: "Outside field" }),
    group = screen.getByRole("group", { name: "TimePicker Input Icon Group" }),
    parts = screen.getAllByRole("spinbutton")
  act(() => outside.focus())
  await user.pointer({ target: group, keys: "[TouchA>]" })
  expect(document.activeElement).toBe(outside)
  await user.pointer({ target: group, keys: "[/TouchA]" })
  expect(document.activeElement).toBe(parts[0])
})

it("retains modified group navigation after the segment declines its own modified editing action", async () => {
  render(
    <>
      {content}
      <TimePicker value={new Time(13, 45)} aria-label="Clock" ComponentIcon={icon} />
    </>,
  )
  const parts = screen.getAllByRole("spinbutton"),
    user = userEvent.setup()
  act(() => parts[1].focus())
  await user.keyboard("{Control>}{Shift>}{ArrowRight}{/Shift}{/Control}")
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Icon action" }))
})

it("preserves controlled veto and readonly entry while retaining the original focused segment", async () => {
  const change = vi.fn(),
    down = vi.fn(),
    up = vi.fn()
  const node = (readonly: boolean) => (
    <>
      {content}
      <TimePicker
        value={new Time(13, 45)}
        aria-label="Clock"
        isReadOnly={readonly}
        onChange={change}
        onKeyDown={down}
        onKeyUp={up}
      />
    </>
  )
  const view = render(node(false)),
    original = screen.getAllByRole("spinbutton")[0],
    user = userEvent.setup()
  act(() => original.focus())
  await user.keyboard("{ArrowUp}")
  expect(change).toHaveBeenCalledTimes(1)
  expect(change.mock.calls[0][0].hour).toBe(14)
  expect(original).toHaveAttribute("aria-valuenow", "13")
  expect(down).toHaveBeenCalledTimes(2)
  expect(up).toHaveBeenCalledTimes(2)
  view.rerender(node(true))
  expect(screen.getAllByRole("spinbutton")[0]).toBe(original)
  expect(document.activeElement).toBe(original)
  await user.keyboard("{ArrowUp}")
  expect(change).toHaveBeenCalledTimes(1)
  expect(document.activeElement).toBe(original)
})

it("retains the actual focused original on a disabled transition while refusing entry changes", async () => {
  const change = vi.fn(),
    node = (disabled: boolean) => (
      <>
        {content}
        <TimePicker value={new Time(13, 45)} aria-label="Clock" isDisabled={disabled} onChange={change} />
      </>
    )
  const view = render(node(false)),
    original = screen.getAllByRole("spinbutton")[0]
  act(() => original.focus())
  view.rerender(node(true))
  expect(screen.getAllByRole("spinbutton")[0]).toBe(original)
  expect(document.activeElement).toBe(original)
  await userEvent.setup().keyboard("{ArrowUp}")
  expect(change).not.toHaveBeenCalled()
  expect(document.activeElement).toBe(original)
})
