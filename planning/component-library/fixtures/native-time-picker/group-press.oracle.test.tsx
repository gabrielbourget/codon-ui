import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import TimePicker from "../../../../packages/react/src/components/TimePicker/TimePicker"

// Exercise the production PointerEvent branch rather than JSDOM's mouse/touch fallback.
class SourcePointerEvent extends MouseEvent {
  readonly pointerId: number
  readonly pointerType: string
  readonly isPrimary: boolean
  readonly width = 1
  readonly height = 1
  readonly pressure = 0.5
  constructor(type: string, options: PointerEventInit = {}) {
    super(type, options)
    this.pointerId = options.pointerId ?? 1
    this.pointerType = options.pointerType ?? "mouse"
    this.isPrimary = options.isPrimary ?? true
  }
}
beforeEach(() => vi.stubGlobal("PointerEvent", SourcePointerEvent))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
const pointer = (target: Element, type: string, pointerType: string) =>
  fireEvent(
    target,
    new SourcePointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType,
      isPrimary: true,
      button: 0,
      buttons: type === "pointerdown" ? 1 : 0,
      detail: 1,
    }),
  )

it("keeps field-root pointer callers outside the two context groups' internal start/click stops", async () => {
  const down = vi.fn(),
    up = vi.fn(),
    click = vi.fn()
  render(<TimePicker aria-label="Clock" onPointerDown={down} onPointerUp={up} onClick={click} />)
  const group = screen.getByRole("group", { name: "TimePicker Input Icon Group" })
  pointer(group, "pointerdown", "mouse")
  expect(document.activeElement).toBe(screen.getAllByRole("spinbutton")[0])
  expect(down).not.toHaveBeenCalled()
  pointer(group, "pointerup", "mouse")
  pointer(group, "click", "mouse")
  expect(up).toHaveBeenCalledTimes(1)
  expect(click).not.toHaveBeenCalled()
})

it("focuses touch only after the original click, after the field-root up caller", async () => {
  const trace: string[] = []
  render(
    <>
      <button>Outside</button>
      <TimePicker aria-label="Clock" onPointerUp={() => trace.push("root-up")} onFocus={() => trace.push("focus")} />
    </>,
  )
  act(() => screen.getByRole("button").focus())
  const group = screen.getByRole("group", { name: "TimePicker Input Icon Group" })
  pointer(group, "pointerdown", "touch")
  expect(trace).toEqual([])
  pointer(group, "pointerup", "touch")
  expect(trace[0]).toBe("root-up")
  expect(trace).not.toContain("focus")
  pointer(group, "click", "touch")
  expect(trace).toContain("focus")
  expect(document.activeElement).toBe(screen.getAllByRole("spinbutton")[0])
})

it("honors a child's original pointer stop before field press state and focus", async () => {
  render(
    <>
      <button>Outside</button>
      <TimePicker
        aria-label="Clock"
        ComponentIcon={<span onPointerDown={(event) => event.stopPropagation()}>Stopped icon</span>}
      />
    </>,
  )
  const outside = screen.getByRole("button")
  act(() => outside.focus())
  const icon = screen.getByText("Stopped icon")
  pointer(icon, "pointerdown", "touch")
  pointer(icon, "pointerup", "touch")
  pointer(icon, "click", "touch")
  expect(document.activeElement).toBe(outside)
})
