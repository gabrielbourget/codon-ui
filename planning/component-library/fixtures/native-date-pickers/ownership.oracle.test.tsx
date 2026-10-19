import { writeFileSync } from "node:fs"

import { CalendarDate, CalendarDateTime, parseZonedDateTime } from "@internationalized/date"
import { act, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import {
  I18nProvider,
  type DatePickerRenderProps,
  type DateRangePickerRenderProps,
  type DateValue,
} from "react-aria-components"
import { afterAll, expect, it, vi } from "vitest"

import DateTimePicker from "../../../../packages/react/src/components/DateTimePicker/DateTimePicker"
import DateTimeRangePicker from "../../../../packages/react/src/components/DateTimeRangePicker/DateTimeRangePicker"

const records: unknown[] = []
afterAll(() =>
  writeFileSync(
    "/private/tmp/codon-native-date-family-ownership-oracle.json",
    JSON.stringify({ scope: "actual canonical component/state; no native input", nativeActions: 0, records }, null, 2) +
      "\n",
  ),
)

const examples = [
  { name: "CalendarDate", value: new CalendarDate(2024, 10, 1), expected: "2024-10-03" },
  {
    name: "CalendarDateTime",
    value: new CalendarDateTime(2024, 10, 1, 13, 45, 7),
    expected: "2024-10-03T13:45:07",
  },
  {
    name: "ZonedDateTime",
    value: parseZonedDateTime("2024-10-01T13:45:07[America/New_York]"),
    expected: "2024-10-03T13:45:07-04:00[America/New_York]",
  },
]

it.each(examples)("single calendar preserves $name and the held owner", async ({ name, value, expected }) => {
  let current!: DatePickerRenderProps["state"]
  const calls: string[] = []
  const onChange = vi.fn<(value: DateValue | null) => void>(() => calls.push("change"))
  render(
    <I18nProvider locale="en-GB">
      <DateTimePicker
        aria-label="When"
        value={value}
        isOpen={false}
        onChange={onChange}
        onOpenChange={(open) => calls.push(`open:${open}`)}
        style={({ state }) => {
          current = state
          return {}
        }}
      />
    </I18nProvider>,
  )
  for (let index = 0; index < 2; index++) await act(() => current.setDateValue(new CalendarDate(2024, 10, 3)))
  expect(onChange).toHaveBeenCalledTimes(2)
  for (const [requested] of onChange.mock.calls) {
    expect(requested).toBeInstanceOf(value.constructor)
    expect(requested?.toString()).toBe(expected)
  }
  expect(current.value).toBe(value)
  expect(value.day).toBe(1)
  expect(calls).toEqual(["change", "change"])
  records.push({ family: "single", name, expected, requests: 2, held: value.toString() })
})

it.each(examples)("range calendar preserves each $name endpoint and held owner", async ({ name, value }) => {
  let current!: DateRangePickerRenderProps["state"]
  const end = "hour" in value ? value.add({ days: 4, hours: 4, minutes: 5 }) : value.add({ days: 4 })
  const owner = { start: value, end }
  const onChange = vi.fn<(value: { start: DateValue; end: DateValue } | null) => void>()
  render(
    <I18nProvider locale="en-GB">
      <DateTimeRangePicker
        aria-label="Interval"
        value={owner}
        isOpen={false}
        onChange={onChange}
        style={({ state }) => {
          current = state
          return {}
        }}
      />
    </I18nProvider>,
  )
  const range = { start: new CalendarDate(2024, 10, 3), end: new CalendarDate(2024, 10, 8) }
  for (let index = 0; index < 2; index++) await act(() => current.setDateRange(range))
  expect(onChange).toHaveBeenCalledTimes(2)
  for (const [requested] of onChange.mock.calls) {
    expect(requested?.start).toBeInstanceOf(value.constructor)
    expect(requested?.end).toBeInstanceOf(value.constructor)
    expect(requested?.start.toString()).toBe(value.set({ day: 3 }).toString())
    expect(requested?.end.toString()).toBe(owner.end.set({ day: 8 }).toString())
  }
  expect(current.value).toBe(owner)
  records.push({ family: "range", name, requests: 2, start: value.toString(), end: owner.end.toString() })
})

const families = [
  { name: "single", Component: DateTimePicker, months: 2, testID: "datetime-picker" },
  { name: "range", Component: DateTimeRangePicker, months: 1, testID: "datetime-range-picker" },
] as const

it.each(families)("$name retains its distinct default month count", async ({ name, Component, months }) => {
  render(
    <I18nProvider locale="en-GB">
      <Component aria-label="Dates" placeholderValue={new CalendarDate(2024, 10, 1)} />
    </I18nProvider>,
  )
  await userEvent.setup().click(screen.getByRole("button"))
  expect(screen.getAllByRole("grid")).toHaveLength(months)
  records.push({ family: name, defaultMonths: months })
})

it.each(families)("$name never acknowledges a declined open request", async ({ name, Component, testID }) => {
  const onOpenChange = vi.fn()
  render(<Component aria-label="Dates" isOpen={false} onOpenChange={onOpenChange} />)
  const user = userEvent.setup()
  await user.click(screen.getByRole("button"))
  await user.click(screen.getByRole("button"))
  expect(onOpenChange.mock.calls).toEqual([[true], [true]])
  expect(screen.getByTestId(testID)).not.toHaveAttribute("data-open")
  records.push({ family: name, declinedOpen: onOpenChange.mock.calls })
})

it("single defined null remains authoritative over defaultValue", () => {
  const onChange = vi.fn()
  render(
    <DateTimePicker aria-label="Date" value={null} defaultValue={new CalendarDate(2024, 10, 1)} onChange={onChange} />,
  )
  for (const segment of screen.getAllByRole("spinbutton")) expect(segment).toHaveAttribute("data-placeholder", "true")
  expect(onChange).not.toHaveBeenCalled()
  records.push({ family: "single", definedNull: true, callbacks: 0 })
})

it("range defined null remains authoritative over complete defaultValue", () => {
  const onChange = vi.fn()
  const defaultValue = { start: new CalendarDate(2024, 10, 1), end: new CalendarDate(2024, 10, 5) }
  render(<DateTimeRangePicker aria-label="Dates" value={null} defaultValue={defaultValue} onChange={onChange} />)
  for (const segment of screen.getAllByRole("spinbutton")) expect(segment).toHaveAttribute("data-placeholder", "true")
  expect(onChange).not.toHaveBeenCalled()
  records.push({ family: "range", definedNull: true, callbacks: 0 })
})

it("range retains an incomplete endpoint but does not acknowledge a complete vetoed range", async () => {
  let current!: DateRangePickerRenderProps["state"]
  const onChange = vi.fn()
  render(
    <DateTimeRangePicker
      aria-label="Dates"
      value={null}
      onChange={onChange}
      style={({ state }) => {
        current = state
        return {}
      }}
    />,
  )
  const start = new CalendarDate(2024, 10, 1),
    end = new CalendarDate(2024, 10, 5)
  await act(() => current.setDateTime("start", start))
  expect(current.value).toEqual({ start, end: null })
  expect(onChange).not.toHaveBeenCalled()
  await act(() => current.setDateTime("end", end))
  expect(onChange.mock.calls).toEqual([[{ start, end }]])
  expect(current.value).toEqual({ start: null, end: null })
  records.push({ family: "range", partialStartRetained: true, completeRequests: 1, heldNull: true })
})

it("single deferred date selection commits placeholder time before requesting closure", async () => {
  let current!: DatePickerRenderProps["state"]
  const order: string[] = [],
    placeholder = new CalendarDateTime(2024, 10, 1, 9, 30)
  const onChange = vi.fn<(value: DateValue | null) => void>(() => order.push("change"))
  render(
    <DateTimePicker
      aria-label="When"
      value={null}
      placeholderValue={placeholder}
      shouldCloseOnSelect={false}
      isOpen
      onChange={onChange}
      onOpenChange={(open) => order.push(`open:${open}`)}
      style={({ state }) => {
        current = state
        return {}
      }}
    />,
  )
  await act(() => current.setDateValue(new CalendarDate(2024, 10, 3)))
  expect(onChange).not.toHaveBeenCalled()
  expect(current.dateValue?.toString()).toBe("2024-10-03")
  await act(() => current.setOpen(false))
  expect(onChange.mock.calls[0][0]?.toString()).toBe("2024-10-03T09:30:00")
  expect(order).toEqual(["change", "open:false"])
  expect(current.isOpen).toBe(true)
  expect(current.value).toBeNull()
  records.push({ family: "single", deferredCommit: "2024-10-03T09:30:00", order, heldOpen: true, heldNull: true })
})

it("calendar date replacement recalculates the zone offset while retaining wall-clock time", async () => {
  let current!: DatePickerRenderProps["state"]
  const value = parseZonedDateTime("2024-10-01T13:45:07[America/New_York]")
  const onChange = vi.fn<(value: DateValue | null) => void>()
  render(
    <DateTimePicker
      aria-label="When"
      value={value}
      onChange={onChange}
      style={({ state }) => {
        current = state
        return {}
      }}
    />,
  )
  await act(() => current.setDateValue(new CalendarDate(2024, 11, 4)))
  const requested = onChange.mock.calls[0][0]
  expect(requested).toBeInstanceOf(value.constructor)
  expect(requested?.toString()).toBe("2024-11-04T13:45:07-05:00[America/New_York]")
  expect(current.value).toBe(value)
  records.push({ family: "single", daylightSavingRequest: requested?.toString(), held: value.toString() })
})

it.each(families.flatMap((family) => [false, null, 0, ""].map((icon) => ({ ...family, icon }))))(
  "$name retains the falsy calendar-icon fallback: $icon",
  ({ name, Component, icon }) => {
    render(<Component aria-label="Dates" ComponentIcon={icon} />)
    expect(screen.getByRole("button").querySelector('svg[viewBox="0 0 1024 1024"] path')).not.toBeNull()
    records.push({ family: name, falsyIcon: icon, fallback: true })
  },
)

it("single form serializes the exact owner value", () => {
  const value = parseZonedDateTime("2024-10-01T13:45:07[America/New_York]")
  const { container } = render(
    <form>
      <DateTimePicker aria-label="When" name="when" value={value} />
    </form>,
  )
  expect(Array.from(new FormData(container.querySelector("form")!).entries())).toEqual([["when", value.toString()]])
  records.push({ family: "single", form: [["when", value.toString()]] })
})

it("range form preserves duplicate endpoint names and order", () => {
  const value = { start: new CalendarDate(2024, 10, 1), end: new CalendarDate(2024, 10, 5) }
  const { container } = render(
    <form>
      <DateTimeRangePicker aria-label="Dates" startName="when" endName="when" value={value} />
    </form>,
  )
  const entries = Array.from(new FormData(container.querySelector("form")!).entries())
  expect(entries).toEqual([
    ["when", value.start.toString()],
    ["when", value.end.toString()],
  ])
  records.push({ family: "range", form: entries })
})
