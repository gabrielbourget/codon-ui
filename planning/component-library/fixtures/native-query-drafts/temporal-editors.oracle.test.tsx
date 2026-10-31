import { writeFileSync } from "node:fs"

import { CalendarDate, CalendarDateTime, Time } from "@internationalized/date"
import { cleanup, render } from "@testing-library/react"
import React, { Children, isValidElement, type ReactElement, type ReactNode } from "react"
import { afterAll, expect, it, vi } from "vitest"

import InputArgument from "../../../../packages/react/src/components/Filtering/DynamicFilterArgumentInput/InternalComponents/InputTypeFilterArgument/InputTypeFilterArgument"
import RangeArgument from "../../../../packages/react/src/components/Filtering/DynamicFilterArgumentInput/InternalComponents/RangeTypeFilterArgument/RangeTypeFilterArgument"
import type { TFilterArgumentInputContext } from "../../../../packages/react/src/components/Filtering/DynamicFilterArgumentInput/helpers"

const observations: unknown[] = []
afterAll(() =>
  writeFileSync(
    "/private/tmp/codon-temporal-filter-original-oracle.json",
    JSON.stringify(
      { scope: "Actual unchanged React editor observations; failures are not conformance", observations },
      null,
      2,
    ) + "\n",
  ),
)

const cases: {
  name: string
  range?: boolean
  dataType: TFilterArgumentInputContext["dataType"]
  argument: TFilterArgumentInputContext["argument"]
  renders: boolean
}[] = [
  { name: "blank date", dataType: "date", argument: "", renders: true },
  { name: "calendar date", dataType: "date", argument: "2026-10-25", renders: true },
  { name: "blank date-time", dataType: "date-time", argument: "", renders: true },
  { name: "emitted local date-time", dataType: "date-time", argument: "2026-10-25T13:45:07", renders: false },
  { name: "date-only in date-time", dataType: "date-time", argument: "2026-10-25", renders: false },
  { name: "midnight time", dataType: "time", argument: "00:00:00", renders: true },
  { name: "factory empty date range", range: true, dataType: "date", argument: ["", ""], renders: false },
  { name: "partial date range", range: true, dataType: "date", argument: ["2026-10-25", undefined], renders: false },
  { name: "complete date range", range: true, dataType: "date", argument: ["2026-10-25", "2026-10-26"], renders: true },
  { name: "factory empty time range", range: true, dataType: "time", argument: ["", ""], renders: false },
  { name: "complete time range", range: true, dataType: "time", argument: ["00:00:00", "23:59:59"], renders: true },
  {
    name: "emitted date-time range",
    range: true,
    dataType: "date-time",
    argument: ["2026-10-25T13:45:07", "2026-10-26T19:15:03"],
    renders: false,
  },
]
it.each(cases)("records original $name", ({ name, range, dataType, argument, renders }) => {
  const change = vi.fn()
  let error: string | null = null
  try {
    const Component = range ? RangeArgument : InputArgument
    render(<Component dataType={dataType} argument={argument} onArgumentChange={change} />)
  } catch (failure) {
    error = failure instanceof Error ? failure.message : String(failure)
  } finally {
    cleanup()
  }
  observations.push({ name, range: !!range, dataType, argument, error, requests: change.mock.calls })
  expect(error === null).toBe(renders)
  expect(change).not.toHaveBeenCalled()
})

type TFieldElement = ReactElement<{ children: ReactElement<{ onChange: (value: unknown) => void }> }>
const childChange = (node: ReactNode) => {
  if (!isValidElement<TFieldElement["props"]>(node)) throw new Error("Expected original FormField")
  return node.props.children.props.onChange
}
it("records original null suppression and emitted ISO payloads from the actual leaf callbacks", () => {
  const values = [
    { dataType: "date", text: "2026-10-25", value: new CalendarDate(2026, 10, 26) },
    { dataType: "date-time", text: "2026-10-25", value: new CalendarDateTime(2026, 10, 26, 13, 45, 7) },
    { dataType: "time", text: "00:00:00", value: new Time(19, 15, 3) },
  ] as const
  for (const { dataType, text, value } of values) {
    const change = vi.fn()
    const scalar = InputArgument({ dataType, argument: text, onArgumentChange: change })
    const request = childChange(scalar as ReactNode)
    request(null)
    expect(change).not.toHaveBeenCalled()
    request(value)
    expect(change).toHaveBeenCalledWith({ argument: value.toString() })
    const range = RangeArgument({ dataType, argument: [text, text], onArgumentChange: change })
    if (!isValidElement<{ children: ReactNode }>(range)) throw new Error("Expected original range root")
    change.mockClear()
    const lower = childChange(Children.toArray(range.props.children)[0])
    lower(null)
    expect(change).not.toHaveBeenCalled()
    lower(value)
    expect(change).toHaveBeenCalledWith({ argument: [value.toString(), text] })
    observations.push({ dataType, clearing: "No request", emitted: value.toString(), untouchedSibling: text })
  }
})
