import { CalendarDateTime } from "@internationalized/date"
import { render, screen } from "@testing-library/react"
import { DatePickerContext, DateRangePickerContext, I18nProvider } from "react-aria-components"
import { expect, it, vi } from "vitest"

import DateTimePicker from "../../../../packages/react/src/components/DateTimePicker/DateTimePicker"
import DateTimeRangePicker from "../../../../packages/react/src/components/DateTimeRangePicker/DateTimeRangePicker"

it("canonical single defaults precede picker context while explicit owner overrides retain original hosts", () => {
  const requests = vi.fn(),
    owner = new CalendarDateTime(2024, 10, 1, 3, 5)
  const node = (explicit: boolean) => (
    <I18nProvider locale="en-US">
      <DatePickerContext.Provider value={{ hourCycle: 12, shouldForceLeadingZeros: false }}>
        <DateTimePicker
          aria-label="When"
          value={owner}
          onChange={requests}
          isOpen={false}
          hourCycle={explicit ? 12 : undefined}
          shouldForceLeadingZeros={explicit ? false : undefined}
        />
      </DatePickerContext.Provider>
    </I18nProvider>
  )
  const view = render(node(false))
  expect(screen.getByText("03")).toBeInTheDocument()
  expect(screen.getByText("01")).toBeInTheDocument()
  expect(screen.queryAllByText("AM")).toHaveLength(0)
  const originalRoot = screen.getByTestId("datetime-picker"),
    originalHour = screen.getByText("03")
  view.rerender(node(true))
  expect(screen.getByTestId("datetime-picker")).toBe(originalRoot)
  expect(screen.getByText("3")).toBe(originalHour)
  expect(screen.getByText("1")).toBeInTheDocument()
  expect(screen.getAllByText("AM")).toHaveLength(1)
  view.rerender(node(false))
  expect(screen.getByTestId("datetime-picker")).toBe(originalRoot)
  expect(screen.getByText("03")).toBe(originalHour)
  expect(screen.getByText("01")).toBeInTheDocument()
  expect(requests).not.toHaveBeenCalled()
  view.unmount()
  expect(originalRoot).not.toBeInTheDocument()
})

it("canonical range defaults precede picker context while explicit owner overrides retain original hosts", () => {
  const requests = vi.fn(),
    owner = { start: new CalendarDateTime(2024, 10, 1, 3, 5), end: new CalendarDateTime(2024, 10, 2, 4, 6) }
  const node = (explicit: boolean) => (
    <I18nProvider locale="en-US">
      <DateRangePickerContext.Provider value={{ hourCycle: 12, shouldForceLeadingZeros: false }}>
        <DateTimeRangePicker
          aria-label="When"
          value={owner}
          onChange={requests}
          isOpen={false}
          hourCycle={explicit ? 12 : undefined}
          shouldForceLeadingZeros={explicit ? false : undefined}
        />
      </DateRangePickerContext.Provider>
    </I18nProvider>
  )
  const view = render(node(false))
  expect(screen.getByText("03")).toBeInTheDocument()
  expect(screen.getByText("01")).toBeInTheDocument()
  expect(screen.queryAllByText("AM")).toHaveLength(0)
  const originalRoot = screen.getByTestId("datetime-range-picker"),
    originalHour = screen.getByText("03")
  view.rerender(node(true))
  expect(screen.getByTestId("datetime-range-picker")).toBe(originalRoot)
  expect(screen.getByText("3")).toBe(originalHour)
  expect(screen.getByText("1")).toBeInTheDocument()
  expect(screen.getAllByText("AM")).toHaveLength(2)
  view.rerender(node(false))
  expect(screen.getByTestId("datetime-range-picker")).toBe(originalRoot)
  expect(screen.getByText("03")).toBe(originalHour)
  expect(screen.getByText("01")).toBeInTheDocument()
  expect(requests).not.toHaveBeenCalled()
  view.unmount()
  expect(originalRoot).not.toBeInTheDocument()
})
