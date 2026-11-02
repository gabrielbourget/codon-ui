import { CalendarDate } from "@internationalized/date"
import { render, screen } from "@testing-library/react"
import { I18nProvider } from "react-aria-components"
import { expect, it, vi } from "vitest"

import DateTimePicker from "../../../../packages/react/src/components/DateTimePicker/DateTimePicker"
import DateTimeRangePicker from "../../../../packages/react/src/components/DateTimeRangePicker/DateTimeRangePicker"
import textStyles from "../../../../packages/react/src/components/Text/TextStyles.module.css"

it("canonical single string fallback retains medium field/calendar classes and local style ownership", async () => {
  const requests = vi.fn(),
    owner = new CalendarDate(2024, 10, 1)
  const node = (textSize: string) => (
    <I18nProvider locale="en-US">
      <DateTimePicker
        aria-label="When"
        value={owner}
        onChange={requests}
        isOpen
        textSize={textSize}
        customCalendarHeaderStyles={{ fontSize: 28 }}
      />
    </I18nProvider>
  )
  const view = render(node("medium"))
  const originalHeading = await screen.findByTestId("datetime-picker-calendar-heading"),
    originalRoot = screen.getByTestId("datetime-picker"),
    originalSegment = screen.getAllByRole("spinbutton", { hidden: true })[0]
  const targets = [...document.querySelectorAll("[data-textsize-target]")]
  expect(targets.length).toBeGreaterThan(2)
  for (const target of targets) expect(target).toHaveClass(textStyles.b10)
  expect(originalHeading).toHaveStyle({ fontSize: "28px" })
  view.rerender(node("owner-defined-size"))
  expect(screen.getByTestId("datetime-picker")).toBe(originalRoot)
  expect(screen.getAllByRole("spinbutton", { hidden: true })[0]).toBe(originalSegment)
  expect(screen.getByTestId("datetime-picker-calendar-heading")).toBe(originalHeading)
  for (const target of document.querySelectorAll("[data-textsize-target]")) expect(target).toHaveClass(textStyles.b10)
  expect(originalHeading).toHaveStyle({ fontSize: "28px" })
  expect(requests).not.toHaveBeenCalled()
  view.unmount()
  expect(originalRoot).not.toBeInTheDocument()
})

it("canonical range string fallback retains medium field/calendar classes and local style ownership", async () => {
  const requests = vi.fn(),
    owner = { start: new CalendarDate(2024, 10, 1), end: new CalendarDate(2024, 10, 3) }
  const node = (textSize: string) => (
    <I18nProvider locale="en-US">
      <DateTimeRangePicker
        aria-label="When"
        value={owner}
        onChange={requests}
        isOpen
        textSize={textSize}
        customCalendarHeaderStyles={{ fontSize: 28 }}
      />
    </I18nProvider>
  )
  const view = render(node("medium"))
  const originalHeading = await screen.findByTestId("datetime-range-picker-calendar-heading"),
    originalRoot = screen.getByTestId("datetime-range-picker"),
    originalSegment = screen.getAllByRole("spinbutton", { hidden: true })[0]
  const targets = [...document.querySelectorAll("[data-textsize-target]")]
  expect(targets.length).toBeGreaterThan(2)
  for (const target of targets) expect(target).toHaveClass(textStyles.b10)
  expect(originalHeading).toHaveStyle({ fontSize: "28px" })
  view.rerender(node("owner-defined-size"))
  expect(screen.getByTestId("datetime-range-picker")).toBe(originalRoot)
  expect(screen.getAllByRole("spinbutton", { hidden: true })[0]).toBe(originalSegment)
  expect(screen.getByTestId("datetime-range-picker-calendar-heading")).toBe(originalHeading)
  for (const target of document.querySelectorAll("[data-textsize-target]")) expect(target).toHaveClass(textStyles.b10)
  expect(originalHeading).toHaveStyle({ fontSize: "28px" })
  expect(requests).not.toHaveBeenCalled()
  view.unmount()
  expect(originalRoot).not.toBeInTheDocument()
})
