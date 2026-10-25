import { fireEvent, render } from "@testing-library/react"
import { createRef } from "react"
import { expect, it, vi } from "vitest"

import Card from "../Card"

const pointer = (type: string, x: number) => {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: 20,
    button: 0,
    buttons: type === "pointerup" ? 0 : 1,
  })
  Object.defineProperties(event, {
    pointerType: { value: "mouse" },
    isPrimary: { value: true },
    pointerId: { value: 1 },
  })
  return event
}
it.each([false, true])("retains original pan callbacks when pointer default prevention is%s", async (prevent) => {
  const ref = createRef<HTMLDivElement>(),
    session = vi.fn(),
    start = vi.fn(),
    move = vi.fn(),
    end = vi.fn(),
    query = vi.fn()
  const view = render(
    <Card
      ref={ref}
      data-testid="card"
      onPointerDown={(event) => {
        if (prevent) event.preventDefault()
      }}
      onPanSessionStart={session}
      onPanStart={start}
      onPan={move}
      onPanEnd={end}
    >
      <input data-testid="held" value="" onChange={query} />
    </Card>,
  )
  const root = ref.current!,
    editor = view.getByTestId("held"),
    down = pointer("pointerdown", 10),
    shifted = pointer("pointermove", 30),
    released = pointer("pointerup", 40)
  fireEvent(root, down)
  expect(down.defaultPrevented).toBe(prevent)
  await vi.waitFor(() => expect(session).toHaveBeenCalledTimes(1))
  fireEvent(window, shifted)
  await vi.waitFor(() => expect(move).toHaveBeenCalled())
  fireEvent(window, released)
  await vi.waitFor(() => expect(end).toHaveBeenCalledTimes(1))
  expect(session.mock.calls[0][0]).toBe(down)
  expect(start).toHaveBeenCalledTimes(1)
  expect(start.mock.calls[0][0]).toBe(shifted)
  expect(move.mock.calls[0][0]).toBe(shifted)
  expect(move.mock.calls.every(([event]) => event === shifted)).toBe(true)
  expect(end.mock.calls[0][0]).toBe(released)
  expect(session.mock.calls[0][0].defaultPrevented).toBe(prevent)
  expect(ref.current).toBe(root)
  expect(view.getByTestId("held")).toBe(editor)
  expect(editor).toHaveValue("")
  expect(query).not.toHaveBeenCalled()
  view.unmount()
})
it.each([
  [false, false],
  [true, false],
  [false, true],
  [true, true],
])("retains original tap callbacks with prevented down=%s/up=%s", async (preventDown, preventUp) => {
  const start = vi.fn(),
    tap = vi.fn(),
    cancel = vi.fn()
  const view = render(
    <Card
      data-testid="card"
      onPointerDown={(event) => {
        if (preventDown) event.preventDefault()
      }}
      onPointerUp={(event) => {
        if (preventUp) event.preventDefault()
      }}
      onTapStart={start}
      onTap={tap}
      onTapCancel={cancel}
    />,
  )
  const root = view.getByTestId("card"),
    down = pointer("pointerdown", 10),
    up = pointer("pointerup", 20)
  fireEvent(root, down)
  fireEvent(root, up)
  await vi.waitFor(() => expect(tap).toHaveBeenCalledTimes(1))
  expect(start).toHaveBeenCalledTimes(1)
  expect(start.mock.calls[0][0]).toBe(down)
  expect(tap.mock.calls[0][0]).toBe(up)
  expect(down.defaultPrevented).toBe(preventDown)
  expect(up.defaultPrevented).toBe(preventUp)
  expect(cancel).not.toHaveBeenCalled()
  view.unmount()
})
