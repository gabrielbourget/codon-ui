import { Time, CalendarDateTime, parseZonedDateTime } from "@internationalized/date"
import { cleanup, render } from "@testing-library/react"
import { afterEach, it, expect } from "vitest"
import TimePicker from "../../../../packages/react/src/components/TimePicker/TimePicker"
const values = [
  new Time(13, 45, 7),
  new CalendarDateTime(2024, 10, 1, 13, 45, 7),
  parseZonedDateTime("2024-10-01T13:45:07[America/New_York]"),
]
afterEach(cleanup)
it.each(values)("records actual source form serialization for %s", (value) => {
  const { container } = render(
    <form>
      <TimePicker aria-label="Clock" name="clock" value={value} granularity="second" validationBehavior="native" />
    </form>,
  )
  const form = container.querySelector("form")!,
    input = form.querySelector("input")!
  const row = {
    owner: value.toString(),
    entries: [...new FormData(form)],
    type: input.type,
    readOnly: input.readOnly,
    willValidate: input.willValidate,
  }
  console.log("TIME_FORM_SOURCE", JSON.stringify(row))
  expect(row.entries).toEqual([["clock", "13:45:07"]])
})
it.each([
  { isReadOnly: false, isDisabled: false },
  { isReadOnly: true, isDisabled: false },
  { isReadOnly: false, isDisabled: true },
])("records required empty native-validation source %j", (props) => {
  const { container } = render(
    <form>
      <TimePicker aria-label="Clock" name="clock" value={null} isRequired validationBehavior="native" {...props} />
    </form>,
  )
  const form = container.querySelector("form")!,
    input = form.querySelector("input")!
  const row = {
    ...props,
    entries: [...new FormData(form)],
    type: input.type,
    readOnly: input.readOnly,
    willValidate: input.willValidate,
    valueMissing: input.validity.valueMissing,
  }
  console.log("TIME_REQUIRED_SOURCE", JSON.stringify(row))
  expect(input.value).toBe("")
  expect(input.readOnly).toBe(false)
  expect(input.willValidate).toBe(!props.isDisabled)
  expect(input.validity.valueMissing).toBe(!props.isDisabled)
  expect(row.entries).toEqual(props.isDisabled ? [] : [["clock", ""]])
})
