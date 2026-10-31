import "./temporalNativeModel"

import { CalendarDate, Time } from "@internationalized/date"
import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { AccessibilityInfo, Dimensions, type View } from "react-native"

import { DatePickerFixture } from "../picker/__tests__/fixtures/DatePickerFixture"

import { TimePickerFixture } from "./fixtures/TimePickerFixture"
import { admitTemporal, deliverTemporalKey, temporalKey, temporalPress, temporalTarget } from "./temporalNativeModel"

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
const owner = () => JSON.parse(screen.getByTestId("temporal-time-owner").props.children as string)
const press = async (name: string) => fireEvent.press(screen.getByRole("button", { name }))

it("composes the actual public TimePicker and real field binding with owner veto and echo", async () => {
  const root = createRef<View>()
  await render(<TimePickerFixture rootRef={root} />)
  await admitTemporal()
  const originalRoot = root.current
  expect(originalRoot).not.toBeNull()
  const hour = screen.getAllByTestId(/^temporal-time-segment-/).find((node) => node.props.segmentId?.endsWith(":hour"))!
  const originalHour = temporalTarget(hour.props.testID)
  await temporalKey("temporal-time", "hour")
  expect(owner()).toMatchObject({ value: "13:45:07", requests: ["14:45:07"], echo: false })
  await press("Toggle time echo")
  await admitTemporal()
  await temporalKey("temporal-time", "hour")
  expect(owner()).toMatchObject({ value: "14:45:07", requests: ["14:45:07", "14:45:07"], echo: true })
  expect(root.current).toBe(originalRoot)
  expect(temporalTarget(hour.props.testID)).toBe(originalHour)
})

it("retains the public TimePicker hosts through guard takeovers, live theme/window/fixture changes and normal reset", async () => {
  const root = createRef<View>()
  const view = await render(<TimePickerFixture rootRef={root} />)
  await admitTemporal()
  const hour = screen.getAllByTestId(/^temporal-time-segment-/).find((node) => node.props.segmentId?.endsWith(":hour"))!
  const originalRoot = root.current,
    originalHour = temporalTarget(hour.props.testID)
  expect(originalRoot).not.toBeNull()
  for (const guard of ["read only", "disabled"]) {
    const pending = await temporalKey("temporal-time", "hour", "ArrowUp", false)
    const requests = owner().requests
    await press(`Toggle time ${guard}`)
    expect(
      screen.getByTestId(hour.props.testID).props[guard === "disabled" ? "segmentDisabled" : "segmentReadOnly"],
    ).toBe(true)
    await deliverTemporalKey(pending)
    expect(owner().requests).toEqual(requests)
    expect(root.current).toBe(originalRoot)
    expect(temporalTarget(hour.props.testID)).toBe(originalHour)
    await press(`Toggle time ${guard}`)
    await admitTemporal()
    await temporalKey("temporal-time", "hour")
    expect(owner().requests).toHaveLength(requests.length + 1)
  }
  await press("Toggle time theme")
  await press("Toggle time large fixture")
  const window = Dimensions.get("window")
  try {
    await act(() => Dimensions.set({ window: { ...window, width: 844, height: 390, fontScale: 2 } }))
    await admitTemporal()
    expect(root.current).toBe(originalRoot)
    expect(temporalTarget(hour.props.testID)).toBe(originalHour)
    expect(owner()).toMatchObject({ value: "13:45:07", requests: ["14:45:07", "14:45:07"], dark: true, large: true })
    await press("Reset time scene")
    await admitTemporal()
    expect(owner()).toEqual({
      value: "13:45:07",
      requests: [],
      echo: false,
      dark: false,
      readOnly: false,
      disabled: false,
      large: false,
    })
    expect(root.current).toBe(originalRoot)
    expect(temporalTarget(hour.props.testID)).toBe(originalHour)
  } finally {
    await act(() => Dimensions.set({ window }))
  }
  await view.unmount()
  expect(root.current).toBeNull()
})

it("hydrates an asynchronous public TimePicker owner value without replacing the original root or native hour host", async () => {
  let complete!: (value: Time) => void
  const response = new Promise<Time>((resolve) => {
    complete = resolve
  })
  const root = createRef<View>()
  const view = await render(<TimePickerFixture rootRef={root} response={response} />)
  await admitTemporal()
  const hour = screen.getAllByTestId(/^temporal-time-segment-/).find((node) => node.props.segmentId?.endsWith(":hour"))!
  const originalRoot = root.current,
    originalHour = temporalTarget(hour.props.testID)
  expect(originalRoot).not.toBeNull()
  await act(async () => {
    complete(new Time(16, 30, 5))
    await response
  })
  await admitTemporal()
  expect(owner()).toMatchObject({ value: "16:30:05", requests: [] })
  expect(screen.getByTestId(hour.props.testID).props.displayText).toBe("16")
  expect(root.current).toBe(originalRoot)
  expect(temporalTarget(hour.props.testID)).toBe(originalHour)
  await view.unmount()
  expect(root.current).toBeNull()
})

it("composes actual single and range date fields with owner veto, current ancestor binding and later echo", async () => {
  await render(<DatePickerFixture />)
  await admitTemporal()
  await temporalPress("Toggle date owner veto")
  await admitTemporal()
  await temporalKey("datetime-picker-input", "day")
  expect(screen.getByTestId("date-fixture-events")).toHaveTextContent(/single:2024-11-02/)
  expect(screen.getByTestId("date-fixture-state")).toHaveTextContent(/Date 2024-11-01/)
  await temporalKey("datetime-range-picker-input-end", "day")
  expect(screen.getByTestId("date-fixture-events")).toHaveTextContent(/range:2024-11-01\/2024-11-05/)
  expect(screen.getByTestId("date-fixture-state")).toHaveTextContent(/Range 2024-11-01 \/ 2024-11-04/)
  await temporalPress("Toggle date owner veto")
  await admitTemporal()
  await temporalKey("datetime-picker-input", "day")
  await admitTemporal()
  expect(screen.getByTestId("date-fixture-state")).toHaveTextContent(/Date 2024-11-02/)
  await temporalKey("datetime-range-picker-input-end", "day")
  expect(screen.getByTestId("date-fixture-state")).toHaveTextContent(/Range 2024-11-01 \/ 2024-11-05/)
})

it("selects from the actual maintained single-date calendar through the original trigger and native collection actions", async () => {
  const host = createRef<View>()
  await render(<DatePickerFixture hostRef={host} />)
  host.current!.measureInWindow = (receive) => receive(0, 0, 390, 844)
  await fireEvent(screen.getByTestId("date-fixture-host"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } },
  })
  await admitTemporal()
  const trigger = screen.getByTestId("datetime-picker-trigger")
  await temporalPress(trigger.props.accessibilityLabel)
  await admitTemporal()
  const day = screen.getByTestId("datetime-picker-day-2024-11-07", { includeHiddenElements: true })
  await temporalPress(day.props.accessibilityLabel)
  await admitTemporal()
  expect(screen.getByTestId("date-fixture-state")).toHaveTextContent(/Date 2024-11-07/)
  expect(screen.getByTestId("date-fixture-events")).toHaveTextContent(/single:2024-11-07/)
})

it("selects actual maintained range-calendar endpoints through original day actions", async () => {
  const host = createRef<View>()
  await render(<DatePickerFixture hostRef={host} />)
  host.current!.measureInWindow = (receive) => receive(0, 0, 390, 844)
  await fireEvent(screen.getByTestId("date-fixture-host"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } },
  })
  await admitTemporal()
  await temporalPress(screen.getByTestId("datetime-range-picker-trigger").props.accessibilityLabel)
  await admitTemporal()
  for (const date of ["2024-11-06", "2024-11-09"]) {
    const day = screen.getByTestId(`datetime-range-picker-day-${date}`, { includeHiddenElements: true })
    await temporalPress(day.props.accessibilityLabel)
    await admitTemporal()
  }
  expect(screen.getByTestId("date-fixture-state")).toHaveTextContent(/Range 2024-11-06 \/ 2024-11-09/)
  expect(screen.getByTestId("date-fixture-events")).toHaveTextContent(/range:2024-11-06\/2024-11-09/)
})

it("resets actual single and range owners through the maintained original native form action", async () => {
  await render(<DatePickerFixture />)
  await admitTemporal()
  await temporalKey("datetime-picker-input", "day")
  await admitTemporal()
  await temporalKey("datetime-range-picker-input-end", "day")
  await admitTemporal()
  expect(screen.getByTestId("date-fixture-state")).toHaveTextContent(/Date 2024-11-02/)
  await temporalPress("Reset date form")
  await admitTemporal()
  expect(screen.getByTestId("date-fixture-form")).toHaveTextContent(/"status":"reset"/)
  expect(screen.getByTestId("date-fixture-state")).toHaveTextContent(/Date 2024-11-01/)
  expect(screen.getByTestId("date-fixture-state")).toHaveTextContent(/Range 2024-11-01 \/ 2024-11-04/)
})

it("keeps actual date roots and segment hosts through read-only/disabled takeovers, theme, window and fixture changes", async () => {
  const view = await render(<DatePickerFixture />)
  await admitTemporal()
  const identities = [
    "datetime-picker",
    "datetime-range-picker",
    "datetime-picker-input-segment-2",
    "datetime-range-picker-input-end-segment-2",
  ].map((id) => [id, temporalTarget(id)] as const)
  for (const guard of ["read only", "disabled"]) {
    const pending = await temporalKey("datetime-picker-input", "day", "ArrowUp", false)
    const pair = await temporalKey("datetime-range-picker-input-end", "day", "ArrowUp", false)
    await temporalPress(`Toggle date ${guard}`)
    await deliverTemporalKey(pending)
    await deliverTemporalKey(pair)
    expect(screen.getByTestId("date-fixture-events")).toHaveTextContent("")
    await temporalPress(`Toggle date ${guard}`)
    await admitTemporal()
  }
  await temporalPress("Toggle date theme")
  await temporalPress("Toggle date large text fixture")
  await temporalPress("Toggle date root renderer")
  const window = Dimensions.get("window")
  try {
    await act(() => Dimensions.set({ window: { ...window, width: 844, height: 390, fontScale: 2 } }))
    await admitTemporal()
    expect(screen.getByTestId("date-fixture-state")).toHaveTextContent(/Date 2024-11-01/)
    expect(screen.getByTestId("date-fixture-state")).toHaveTextContent(/Range 2024-11-01 \/ 2024-11-04/)
    for (const [id, original] of identities) expect(temporalTarget(id)).toBe(original)
  } finally {
    await act(() => Dimensions.set({ window }))
  }
  await view.unmount()
})

it("hydrates deferred single and range owner values without requests or replacing original public hosts", async () => {
  let complete!: (value: { value: CalendarDate; range: { start: CalendarDate; end: CalendarDate } }) => void
  const response = new Promise<{ value: CalendarDate; range: { start: CalendarDate; end: CalendarDate } }>(
    (resolve) => {
      complete = resolve
    },
  )
  const view = await render(<DatePickerFixture response={response} />)
  await admitTemporal()
  const identities = [
    "datetime-picker",
    "datetime-range-picker",
    "datetime-picker-input-segment-2",
    "datetime-range-picker-input-end-segment-2",
  ].map((id) => [id, temporalTarget(id)] as const)
  await act(async () => {
    complete({
      value: new CalendarDate(2025, 3, 5),
      range: { start: new CalendarDate(2025, 3, 6), end: new CalendarDate(2025, 3, 9) },
    })
    await response
  })
  await admitTemporal()
  expect(screen.getByTestId("date-fixture-state")).toHaveTextContent(/Date 2025-03-05/)
  expect(screen.getByTestId("date-fixture-state")).toHaveTextContent(/Range 2025-03-06 \/ 2025-03-09/)
  expect(screen.getByTestId("date-fixture-events")).toHaveTextContent("")
  for (const [id, original] of identities) expect(temporalTarget(id)).toBe(original)
  await view.unmount()
})
