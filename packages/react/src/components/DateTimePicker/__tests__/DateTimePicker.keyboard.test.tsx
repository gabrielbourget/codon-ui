import { CalendarDate } from "@internationalized/date"
import { fireEvent, render } from "@testing-library/react"
import { expect, it, vi } from "vitest"

import DateTimeRangePicker from "../../DateTimeRangePicker/DateTimeRangePicker"
import DateTimePicker from "../DateTimePicker"

it.each([false, true])(
  "keeps original public key bubbling separate from the date group defaults (range=%s)",
  (range) => {
    const onKeyDown = vi.fn(),
      onKeyUp = vi.fn(),
      open = vi.fn()
    const common = { "aria-label": "Dates", isOpen: false, onOpenChange: open, onKeyDown, onKeyUp }
    const view = render(
      range ? (
        <DateTimeRangePicker
          {...common}
          value={{ start: new CalendarDate(2024, 10, 1), end: new CalendarDate(2024, 10, 3) }}
        />
      ) : (
        <DateTimePicker {...common} value={new CalendarDate(2024, 10, 1)} />
      ),
    )
    const segment = view.getAllByRole("spinbutton")[0]
    fireEvent.keyDown(segment, { key: "ArrowLeft" })
    expect(onKeyDown).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(segment, { key: "p" })
    expect(onKeyDown).toHaveBeenCalledTimes(2)
    fireEvent.keyUp(segment, { key: "p" })
    expect(onKeyUp).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(segment, { key: "ArrowDown", altKey: true })
    expect(open).toHaveBeenCalledWith(true)
    expect(onKeyDown).toHaveBeenCalledTimes(3)
    fireEvent.keyDown(view.getByRole("button"), { key: "ArrowDown", altKey: true })
    expect(open).toHaveBeenCalledTimes(2)
    expect(onKeyDown).toHaveBeenCalledTimes(4)
  },
)

it("runs range Escape through the calendar and the original popover close handling", async () => {
  const { userEvent } = await import("@testing-library/user-event")
  const { waitFor } = await import("@testing-library/react")
  const open = vi.fn()
  const view = render(
    <DateTimeRangePicker aria-label="Interval" placeholderValue={new CalendarDate(2024, 11, 1)} onOpenChange={open} />,
  )
  const user = userEvent.setup()
  await user.click(view.getByRole("button"))
  const day = view.getByRole("button", { name: /Friday, November 1, 2024/ })
  await user.click(day)
  fireEvent.keyDown(day, { key: "Escape" })
  await waitFor(() => expect(view.queryByTestId("datetime-range-picker-popover")).toBeNull())
  expect(open.mock.calls).toEqual([[true], [false]])
})
