import { Time, CalendarDateTime, parseZonedDateTime } from "@internationalized/date"
import { act, cleanup, render } from "@testing-library/react"
import { I18nProvider, TimeFieldContext, TimeFieldStateContext } from "react-aria-components"
import { useContext } from "react"
import { afterEach, expect, it } from "vitest"

import TimePicker from "../../../../packages/react/src/components/TimePicker/TimePicker"
import type { TimeFieldState } from "../../../../packages/react-native/src/date/state/useTimeFieldState"

const values = [
  new Time(13, 45, 7),
  new CalendarDateTime(2024, 10, 1, 13, 45, 7),
  parseZonedDateTime("2024-10-01T13:45:07[America/New_York]"),
]
afterEach(cleanup)
it.each(values)("retains actual field context ownership and callback chaining for %s", async (value) => {
  const requests: Array<[string, unknown]> = []
  const observed: { state: TimeFieldState | null } = { state: null }
  const Probe = () => {
    observed.state = useContext(TimeFieldStateContext)
    return null
  }
  render(
    <I18nProvider locale="en-GB">
      <TimeFieldContext.Provider value={{ value, onChange: (next) => requests.push(["context", next]) }}>
        <TimePicker
          aria-label="Clock"
          ComponentIcon={<Probe />}
          granularity="second"
          onChange={(next) => requests.push(["caller", next])}
        />
      </TimeFieldContext.Provider>
    </I18nProvider>,
  )
  await act(() => observed.state!.increment("hour"))
  await act(() => observed.state!.increment("hour"))
  expect(requests.map(([owner]) => owner)).toEqual(["context", "caller", "context", "caller"])
  expect(requests[0][1]).toBe(requests[1][1])
  expect(requests[0][1]).toBeInstanceOf(value.constructor)
  expect(String(requests[0][1])).toBe(String(requests[2][1]))
  expect(observed.state!.timeValue.toString()).toBe("13:45:07")
})
it("keeps actual defined null over context value/default and caller defaults over context display defaults", async () => {
  const observed: { state: TimeFieldState | null } = { state: null }
  const Probe = () => {
    observed.state = useContext(TimeFieldStateContext)
    return null
  }
  render(
    <I18nProvider locale="en-GB">
      <TimeFieldContext.Provider
        value={{
          value: new Time(13, 45),
          defaultValue: new Time(10, 20),
          hourCycle: 12,
          shouldForceLeadingZeros: false,
        }}
      >
        <TimePicker aria-label="Clock" value={null} ComponentIcon={<Probe />} />
      </TimeFieldContext.Provider>
    </I18nProvider>,
  )
  expect(observed.state!.value).toBeNull()
  expect(observed.state!.segments.some((segment) => segment.type === "dayPeriod")).toBe(false)
  await act(() => observed.state!.setSegment("hour", 3))
  expect(observed.state!.segments.find((segment) => segment.type === "hour")?.text).toBe("03")
})
it("uses the actual named source slot and preserves slot-null opt-out", () => {
  const observed: { state: TimeFieldState | null } = { state: null }
  const Probe = () => {
    observed.state = useContext(TimeFieldStateContext)
    return null
  }
  const renderField = (slot: string | null) => (
    <I18nProvider locale="en-GB">
      <TimeFieldContext.Provider value={{ slots: { alternate: { value: new Time(18, 40), isReadOnly: true } } }}>
        <TimePicker aria-label="Clock" slot={slot} ComponentIcon={<Probe />} defaultValue={new Time(9, 15)} />
      </TimeFieldContext.Provider>
    </I18nProvider>
  )
  const view = render(renderField("alternate"))
  expect(observed.state!.timeValue.toString()).toBe("18:40:00")
  expect(observed.state!.isReadOnly).toBe(true)
  view.unmount()
  render(renderField(null))
  expect(observed.state!.timeValue.toString()).toBe("09:15:00")
  expect(observed.state!.isReadOnly).toBe(false)
})
