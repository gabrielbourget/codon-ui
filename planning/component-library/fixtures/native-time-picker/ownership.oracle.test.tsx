import { writeFileSync } from "node:fs"

import { CalendarDateTime, Time, parseZonedDateTime } from "@internationalized/date"
import { act, cleanup, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { I18nProvider } from "react-aria-components"
import { afterAll, afterEach, expect, it, vi } from "vitest"

import TimePicker from "../../../../packages/react/src/components/TimePicker/TimePicker"

const records: unknown[] = []
afterEach(cleanup)
afterAll(() =>
  writeFileSync("/private/tmp/codon-native-time-picker-ownership-oracle.json", JSON.stringify(records, null, 2) + "\n"),
)
const hour = () => screen.getAllByRole("spinbutton")[0]
const examples = [
  { name: "Time", value: new Time(13, 45, 7), expected: "14:45:07" },
  { name: "CalendarDateTime", value: new CalendarDateTime(2024, 10, 1, 13, 45, 7), expected: "2024-10-01T14:45:07" },
  {
    name: "ZonedDateTime",
    value: parseZonedDateTime("2024-10-01T13:45:07[America/New_York]"),
    expected: "2024-10-01T14:45:07-04:00[America/New_York]",
  },
]
it.each(examples)("retains $name and repeated owner vetoes", async ({ name, value, expected }) => {
  const onChange = vi.fn()
  render(
    <I18nProvider locale="en-GB">
      <TimePicker aria-label="Clock" value={value} onChange={onChange} granularity="second" />
    </I18nProvider>,
  )
  const user = userEvent.setup()
  await user.click(hour())
  await user.keyboard("{ArrowUp}")
  await user.keyboard("{ArrowUp}")
  expect(onChange).toHaveBeenCalledTimes(2)
  for (const [requested] of onChange.mock.calls) {
    expect(requested).toBeInstanceOf(value.constructor)
    expect(requested.toString()).toBe(expected)
    expect(requested).not.toBe(value)
  }
  expect(value.hour).toBe(13)
  expect(hour()).toHaveAttribute("aria-valuenow", "13")
  records.push({
    name,
    requests: onChange.mock.calls.map(([requested]) => requested.toString()),
    ownerHeld: value.toString(),
  })
})
it("keeps defined null authoritative over defaultValue", () => {
  const onChange = vi.fn()
  render(<TimePicker aria-label="Clock" value={null} defaultValue={new Time(8, 15)} onChange={onChange} />)
  for (const segment of screen.getAllByRole("spinbutton")) {
    expect(segment).toHaveAttribute("data-placeholder", "true")
    expect(segment).not.toHaveAttribute("aria-valuenow")
  }
  expect(onChange).not.toHaveBeenCalled()
  records.push({ name: "defined null", placeholders: true, callbacks: 0 })
})
it("retains readonly segment focus while blocking change requests", async () => {
  const onChange = vi.fn()
  render(
    <>
      <button>Outside fixture</button>
      <TimePicker aria-label="Clock" value={new Time(13, 45)} onChange={onChange} isReadOnly />
    </>,
  )
  const user = userEvent.setup()
  await user.click(hour())
  expect(document.activeElement).toBe(hour())
  await user.keyboard("{ArrowUp}{Backspace}{Delete}")
  expect(onChange).not.toHaveBeenCalled()
  records.push({ name: "readonly focus", focused: true, callbacks: 0 })
  await user.click(screen.getByRole("button", { name: "Outside fixture" }))
})
it.each([{ icon: false }, { icon: null }, { icon: 0 }, { icon: "" }])(
  "preserves the canonical falsy clock-icon fallback: $icon",
  ({ icon }) => {
    render(<TimePicker aria-label="Clock" ComponentIcon={icon} />)
    expect(screen.getByTestId("time-picker").querySelector("svg circle")).not.toBeNull()
    records.push({ name: "falsy icon fallback", icon, fallback: true })
  },
)
it("keeps caller values and callbacks through locale/style replacement", async () => {
  const value = new Time(13, 45),
    onChange = vi.fn()
  const node = (locale: string) => (
    <I18nProvider locale={locale}>
      <TimePicker aria-label="Clock" value={value} onChange={onChange} customStyles={{ marginTop: 0 }} />
    </I18nProvider>
  )
  const result = render(node("en-GB"))
  await act(() => result.rerender(node("fr-FR")))
  expect(value.toString()).toBe("13:45:00")
  expect(onChange).not.toHaveBeenCalled()
  expect(hour()).toHaveAttribute("aria-valuenow", "13")
  records.push({ name: "locale and style", value: value.toString(), callbacks: 0 })
})
