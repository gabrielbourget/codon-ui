import { Time } from "@internationalized/date"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { userEvent } from "@testing-library/user-event"
import { createPortal } from "react-dom"
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

it("preserves a held arrow's repeat flag while navigating original authored controls", async () => {
  const repeats: boolean[] = []
  render(
    <TimePicker
      aria-label="Clock"
      onKeyDown={(event) => repeats.push(event.repeat)}
      ComponentIcon={
        <>
          <button>Repeat start</button>
          <button>Repeat next</button>
          <button>Repeat end</button>
        </>
      }
    />,
  )
  act(() => screen.getByRole("button", { name: "Repeat start" }).focus())
  fireEvent.keyDown(screen.getByRole("button", { name: "Repeat start" }), { key: "ArrowRight", repeat: false })
  fireEvent.keyDown(screen.getByRole("button", { name: "Repeat next" }), { key: "ArrowRight", repeat: true })
  fireEvent.keyUp(screen.getByRole("button", { name: "Repeat end" }), { key: "ArrowRight" })
  expect(repeats).toEqual([false, true])
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Repeat end" }))
})

it("delivers field key callers through an authored portal outside its physical group", async () => {
  const calls: unknown[][] = []
  const portal = document.createElement("div")
  document.body.append(portal)
  try {
    render(
      <TimePicker
        value={new Time(13, 45)}
        aria-label="Clock"
        ComponentIcon={createPortal(<button>Portaled action</button>, portal)}
        onKeyDown={(event) => calls.push(["down", event.key, event.currentTarget.contains(event.target as Node)])}
        onKeyUp={(event) => calls.push(["up", event.key, event.currentTarget.contains(event.target as Node)])}
      />,
    )
    const button = screen.getByRole("button", { name: "Portaled action" })
    expect(screen.getByTestId("time-picker").contains(button)).toBe(false)
    const user = userEvent.setup()
    await user.click(button)
    expect(document.activeElement).toBe(button)
    await user.keyboard("p")
    expect(calls).toEqual([
      ["down", "p", false],
      ["up", "p", false],
    ])
    expect(document.activeElement).toBe(button)
    calls.length = 0
    await user.keyboard("{ArrowRight}")
    expect(document.activeElement).toBe(button)
    expect(calls).toEqual([
      ["down", "ArrowRight", false],
      ["up", "ArrowRight", false],
    ])
  } finally {
    cleanup()
    portal.remove()
  }
})

it.each(Array.from({ length: 16 }, (_, mask) => mask))(
  "preserves original group navigation and key-up with modifier mask %i",
  async (mask) => {
    const down = vi.fn(),
      up = vi.fn(),
      change = vi.fn()
    render(
      <>
        {content}
        <TimePicker
          value={new Time(13, 45)}
          aria-label="Clock"
          onChange={change}
          onKeyDown={down}
          onKeyUp={up}
          ComponentIcon={
            <>
              <button>Authored action</button>
              <button tabIndex={-1}>Programmatic action</button>
              <input aria-label="Original core editor" />
            </>
          }
        />
      </>,
    )
    const authored = screen.getByRole("button", { name: "Authored action" }),
      next = screen.getByRole("button", { name: "Programmatic action" })
    const modifiers = { shiftKey: !!(mask & 1), altKey: !!(mask & 2), ctrlKey: !!(mask & 4), metaKey: !!(mask & 8) }
    act(() => authored.focus())
    const keys = ["Shift", "Alt", "Control", "Meta"].filter((_, bit) => mask & (1 << bit))
    await userEvent.setup().keyboard(
      keys.map((key) => `{${key}>}`).join("") +
        "{ArrowRight}" +
        [...keys]
          .reverse()
          .map((key) => `{/${key}}`)
          .join(""),
    )
    expect(document.activeElement).toBe(next)
    const downs = down.mock.calls.filter(([event]) => event.key === "ArrowRight")
    const ups = up.mock.calls.filter(([event]) => event.key === "ArrowRight")
    expect(downs).toHaveLength(1)
    expect(ups).toHaveLength(1)
    expect(downs[0][0].target).toBe(authored)
    expect(ups[0][0].target).toBe(next)
    for (const [flag, value] of Object.entries(modifiers)) {
      expect(downs[0][0][flag]).toBe(value)
      expect(ups[0][0][flag]).toBe(value)
    }
    expect(change).not.toHaveBeenCalled()
  },
)

it.each(["callback", "disabled", "readonly", "layout", "unmount"])(
  "keeps the actual source ownership and callback lifetime across %s",
  async (mutation) => {
    const trace: { key: string; phase: string; revision: number; target: EventTarget | null }[] = [],
      change = vi.fn()
    const Scene = () => {
      const [state, setState] = useState({ revision: 0, disabled: false, readonly: false, layout: 0, visible: true })
      return (
        <>
          {content}
          <button onClick={() => setState((value) => ({ ...value, disabled: false, readonly: false, visible: true }))}>
            Restore scene
          </button>
          <span data-testid="mutation-source-state">{JSON.stringify(state)}</span>
          {state.visible && (
            <TimePicker
              value={new Time(13, 45)}
              aria-label="Clock"
              isDisabled={state.disabled}
              isReadOnly={state.readonly}
              customStyles={{ paddingLeft: state.layout }}
              onChange={change}
              onKeyDown={(event) => {
                trace.push({ key: event.key, phase: "down", revision: state.revision, target: event.target })
                if (event.key !== "m") return
                event.preventDefault()
                setState((value) => ({
                  ...value,
                  revision: value.revision + (mutation === "callback" ? 1 : 0),
                  disabled: mutation === "disabled",
                  readonly: mutation === "readonly",
                  layout: mutation === "layout" ? 16 : 0,
                  visible: mutation !== "unmount",
                }))
              }}
              onKeyUp={(event) =>
                trace.push({ key: event.key, phase: "up", revision: state.revision, target: event.target })
              }
              ComponentIcon={<button>Authored action</button>}
            />
          )}
        </>
      )
    }
    render(<Scene />)
    const original = screen.getByRole("button", { name: "Authored action" }),
      user = userEvent.setup()
    act(() => original.focus())
    await user.keyboard("m")
    expect(trace.filter((row) => row.key === "m" && row.phase === "down")).toHaveLength(1)
    expect(trace[0].target).toBe(original)
    const state = JSON.parse(screen.getByTestId("mutation-source-state").textContent!)
    expect(state.revision).toBe(mutation === "callback" ? 1 : 0)
    expect(state.visible).toBe(mutation !== "unmount")
    if (mutation === "unmount") {
      const length = trace.length
      fireEvent.keyDown(original, { key: "j" })
      expect(trace).toHaveLength(length)
    }
    await user.click(screen.getByRole("button", { name: "Restore scene" }))
    const current = screen.getByRole("button", { name: "Authored action" })
    expect(current === original).toBe(mutation !== "unmount")
    act(() => current.focus())
    await user.keyboard("j")
    const fresh = trace.filter((row) => row.key === "j")
    expect(fresh.map((row) => row.phase)).toEqual(["down", "up"])
    expect(fresh.every((row) => row.revision === state.revision && row.target === current)).toBe(true)
    expect(change).not.toHaveBeenCalled()
  },
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

it("keeps a nested owner veto while its edit bubbles through the actual inner and outer groups", async () => {
  const trace: string[] = [],
    outerChange = vi.fn()
  render(
    <TimePicker
      value={new Time(13, 45)}
      aria-label="Outer clock"
      onChange={outerChange}
      onKeyDown={() => trace.push("outer-down")}
      ComponentIcon={
        <TimePicker
          value={new Time(8, 15)}
          aria-label="Inner clock"
          onChange={(value) => trace.push("inner-change:" + value)}
          onKeyDown={() => trace.push("inner-down")}
        />
      }
    />,
  )
  const parts = screen.getAllByRole("spinbutton")
  act(() => parts[3].focus())
  await userEvent.setup().keyboard("{ArrowUp}")
  expect(trace).toEqual(["inner-change:08:16:00", "inner-down", "inner-down", "outer-down"])
  expect(outerChange).not.toHaveBeenCalled()
  expect(parts[1]).toHaveAttribute("aria-valuenow", "45")
  expect(parts[3]).toHaveAttribute("aria-valuenow", "15")
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
