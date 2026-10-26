import { CalendarDate, CalendarDateTime, Time } from "@internationalized/date"
import { render } from "@testing-library/react"
import { Children, type ReactElement, type ReactNode } from "react"
import { expect, it, vi } from "vitest"

import InputArgument from "../InternalComponents/InputTypeFilterArgument/InputTypeFilterArgument"
import RangeArgument from "../InternalComponents/RangeTypeFilterArgument/RangeTypeFilterArgument"
import {
  parseFilterDateArgument,
  parseFilterDateTimeArgument,
  parseFilterTimeArgument,
} from "../InternalComponents/temporalValues"

const cases = [
  { dataType: "date", text: "2026-10-25", next: new CalendarDate(2026, 10, 26), parse: parseFilterDateArgument },
  {
    dataType: "date-time",
    text: "2026-10-25T13:45:07",
    next: new CalendarDateTime(2026, 10, 26, 19, 15, 3),
    parse: parseFilterDateTimeArgument,
  },
  { dataType: "time", text: "00:00:00", next: new Time(23, 59, 59), parse: parseFilterTimeArgument },
] as const
type TPickerProps = { value: { toString(): string } | null; onChange: (value: unknown) => void; granularity: string }
const picker = (field: ReactNode) =>
  (field as ReactElement<{ children: ReactElement<TPickerProps> }>).props.children.props

it.each(cases)("round-trips $dataType ISO values, blanks and strict rejections", ({ parse, text }) => {
  expect(parse(text)?.toString()).toBe(text)
  for (const blank of [null, undefined, ""]) expect(parse(blank)).toBeNull()
  for (const invalid of [0, false, [], "invalid", "2026-99-99"]) expect(() => parse(invalid)).toThrow()
})
it.each(cases)("mounts $dataType scalar, blank and partial range forms", ({ dataType, text }) => {
  const change = vi.fn()
  for (const argument of [null, "", text]) {
    const view = render(<InputArgument dataType={dataType} argument={argument} onArgumentChange={change} />)
    expect(view.getAllByRole("spinbutton").length).toBeGreaterThan(0)
    view.unmount()
  }
  for (const argument of [undefined, ["", ""], [text, undefined], [null, text]]) {
    const view = render(<RangeArgument dataType={dataType} argument={argument} onArgumentChange={change} />)
    expect(view.getAllByRole("spinbutton").length).toBeGreaterThan(1)
    view.unmount()
  }
  expect(change).not.toHaveBeenCalled()
})
it.each(cases)("emits $dataType clear requests and preserves each untouched raw bound", ({ dataType, text, next }) => {
  const change = vi.fn()
  const scalar = picker(InputArgument({ dataType, argument: text, onArgumentChange: change }) as ReactNode)
  expect(scalar.value?.toString()).toBe(text)
  scalar.onChange(null)
  scalar.onChange(next)
  expect(change.mock.calls).toEqual([[{ argument: null }], [{ argument: next.toString() }]])
  const range = RangeArgument({ dataType, argument: [undefined, text], onArgumentChange: change }) as ReactElement<{
    children: ReactNode
  }>
  const [minimum, maximum] = Children.toArray(range.props.children).map(picker)
  change.mockClear()
  minimum.onChange(next)
  maximum.onChange(null)
  expect(change.mock.calls).toEqual([[{ argument: [next.toString(), text] }], [{ argument: [undefined, null] }]])
  expect(maximum.value?.toString()).toBe(text)
})
