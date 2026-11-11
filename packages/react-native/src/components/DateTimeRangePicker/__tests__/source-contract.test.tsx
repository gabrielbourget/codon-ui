import "../../../collection/__tests__/nativeReceipts"

import { CalendarDate, CalendarDateTime } from "@internationalized/date"
import { act, cleanup, within } from "@testing-library/react-native"
import { createRef, type Ref } from "react"
import { AccessibilityInfo, type View } from "react-native"
import { Text } from "react-native"

import {
  fireEventWithNativeCollections as fireEvent,
  renderWithNativeCollections as render,
  screen,
} from "../../../collection/__tests__/nativeReceipts"
import { NATIVE_DEFAULT_SLOT } from "../../../collection/context"
import { NativeDateRangePickerContext } from "../../../date/picker/context"
import { DateTimeRangePicker, type TNativeDateTimeRangePickerProps } from "../../../index"
import { NativeFocusView } from "../../../input/NativeFocusView"
import { NativeLocaleProvider } from "../../../locale/NativeLocaleProvider"
import { NativeThemeProvider } from "../../../theme"

jest.unmock("react-native/Libraries/Components/TextInput/TextInput")
jest.mock("../../../input/specs/CUIDateSegmentNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
  Commands: { requestSegmentFocus: jest.fn(), requestSegmentBlur: jest.fn() },
}))
jest.mock("../../../components/ClickPopover/ClickPopover", () => ({
  NativeFloatingSurface: ({ children, isOpen }: { children: React.ReactNode; isOpen?: boolean }) =>
    isOpen ? children : null,
}))
jest.mock("../../../input/specs/CUIFieldBindingNativeComponent", () => ({
  __esModule: true,
  default: jest
    .requireActual("react")
    .forwardRef((props: object, ref: Ref<View>) =>
      jest.requireActual("react").createElement(jest.requireActual("react-native").View, { ...props, ref }),
    ),
}))
beforeEach(() => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => {
  jest.restoreAllMocks()
  cleanup()
})

it("keeps canonical range wrapper defaults ahead of context and preserves explicit owner overrides", async () => {
  const root = createRef<View>(),
    requests = jest.fn(),
    owner = { start: new CalendarDateTime(2024, 10, 1, 3, 5), end: new CalendarDateTime(2024, 10, 2, 4, 6) }
  const node = (explicit: boolean) => (
    <NativeThemeProvider>
      <NativeLocaleProvider locale="en-US">
        <NativeDateRangePickerContext.Provider value={{ hourCycle: 12, shouldForceLeadingZeros: false }}>
          <DateTimeRangePicker
            ref={root}
            value={owner}
            onChange={requests}
            isOpen={false}
            hourCycle={explicit ? 12 : undefined}
            shouldForceLeadingZeros={explicit ? false : undefined}
          />
        </NativeDateRangePickerContext.Provider>
      </NativeLocaleProvider>
    </NativeThemeProvider>
  )
  const view = await render(node(false))
  expect(screen.getByText("03")).toBeTruthy()
  expect(screen.getByText("01")).toBeTruthy()
  expect(screen.queryAllByText("AM")).toHaveLength(0)
  const originalRoot = root.current,
    originalSegments = screen
      .getAllByTestId(/^datetime-range-picker-input-(start|end)-segment-/)
      .filter((segment) => segment.props.ownerId)
  expect(originalRoot).not.toBeNull()
  expect(originalSegments.length).toBeGreaterThan(0)
  await view.rerender(node(true))
  expect(root.current).toBe(originalRoot)
  const explicitSegments = screen
    .getAllByTestId(/^datetime-range-picker-input-(start|end)-segment-/)
    .filter((segment) => segment.props.ownerId)
  for (const original of originalSegments) expect(explicitSegments.some((current) => current === original)).toBe(true)
  expect(screen.getByText("3")).toBeTruthy()
  expect(screen.getByText("1")).toBeTruthy()
  expect(screen.getAllByText("AM")).toHaveLength(2)
  await view.rerender(node(false))
  expect(root.current).toBe(originalRoot)
  expect(screen.getByText("03")).toBeTruthy()
  expect(screen.getByText("01")).toBeTruthy()
  expect(screen.queryAllByText("AM")).toHaveLength(0)
  expect(requests).not.toHaveBeenCalled()
  await view.unmount()
  expect(root.current).toBeNull()
})

it("retains range label defaults, explicit empty labels and original custom icon content", async () => {
  const root = createRef<View>(),
    owner = new CalendarDateTime(2024, 10, 1, 3, 5),
    requests = jest.fn()
  const icon = <Text testID="authored-calendar-icon">Calendar owner</Text>
  const node = (
    labels?: TNativeDateTimeRangePickerProps["labels"],
    ComponentIcon?: TNativeDateTimeRangePickerProps["ComponentIcon"],
  ) => (
    <NativeThemeProvider>
      <NativeLocaleProvider locale="en-US">
        <DateTimeRangePicker
          ref={root}
          value={{ start: owner, end: owner.add({ days: 2 }) }}
          onChange={requests}
          isOpen
          labels={labels}
          ComponentIcon={ComponentIcon}
        />
      </NativeLocaleProvider>
    </NativeThemeProvider>
  )
  const view = await render(node())
  const original = root.current
  const hidden = { includeHiddenElements: true }
  expect(screen.getByTestId("datetime-range-picker-group", hidden).props.accessibilityLabel).toBe(
    "DateTimeRangePicker Input Icon Group",
  )
  expect(screen.getByTestId("datetime-range-picker-trigger", hidden).props.accessibilityLabel).toBe(
    "DateTimeRangePicker Trigger Button DateTimeRangePicker Input Icon Group",
  )
  expect(screen.getByTestId("datetime-range-picker-calendar", hidden).props.accessibilityLabel).toBe(
    "Datetime Range Picker Calendar",
  )
  await view.rerender(
    node({ inputButtonGroupAriaLabel: "", triggerButtonAriaLabel: "Open date", calendarAriaLabel: "" }, icon),
  )
  expect(screen.getByTestId("datetime-range-picker-group", hidden).props.accessibilityLabel).toBe("")
  expect(screen.getByTestId("datetime-range-picker-trigger", hidden).props.accessibilityLabel).toBe("Open date")
  expect(screen.getByTestId("datetime-range-picker-calendar", hidden).props.accessibilityLabel).toBe("")
  expect(screen.getByTestId("authored-calendar-icon", hidden)).toHaveTextContent("Calendar owner")
  expect(root.current).toBe(original)
  await view.rerender(
    node({ triggerButtonAriaLabel: "", inputButtonGroupAriaLabel: "", calendarAriaLabel: "Dates" }, false),
  )
  expect(screen.getByTestId("datetime-range-picker-trigger", hidden).props.accessibilityLabel).toBe("")
  expect(screen.queryByTestId("authored-calendar-icon", hidden)).toBeNull()
  expect(screen.getByTestId("datetime-range-picker-calendar", hidden).props.accessibilityLabel).toBe("Dates")
  expect(root.current).toBe(original)
  expect(requests).not.toHaveBeenCalled()
})

it("forwards range weekday and page policies through the public two-month calendar", async () => {
  const owner = new CalendarDateTime(2024, 10, 1, 3, 5),
    requests = jest.fn(),
    root = createRef<View>()
  const node = (pageBehavior: "single" | "visible", firstDayOfWeek: "mon" | "sun", dayLength: "long" | "short") => (
    <NativeThemeProvider>
      <NativeLocaleProvider locale="en-US">
        <DateTimeRangePicker
          ref={root}
          value={{ start: owner, end: owner.add({ days: 2 }) }}
          onChange={requests}
          isOpen
          multiMonth
          pageBehavior={pageBehavior}
          firstDayOfWeek={firstDayOfWeek}
          dayLength={dayLength}
        />
      </NativeLocaleProvider>
    </NativeThemeProvider>
  )
  const view = await render(node("single", "mon", "long"))
  const original = root.current,
    hidden = { includeHiddenElements: true }
  const headers = () =>
    screen
      .getAllByRole("columnheader", hidden)
      .slice(0, 7)
      .map((header) => within(header).getByText(/./, hidden).props.children)
  expect(headers()).toEqual(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"])
  expect(screen.getAllByTestId("datetime-range-picker-calendar-grid", hidden)).toHaveLength(2)
  expect(screen.getByTestId("datetime-range-picker-calendar-heading", hidden)).toHaveTextContent(
    /October.*November.*2024/,
  )
  await fireEvent.press(screen.getByTestId("datetime-range-picker-next-btn", hidden))
  expect(screen.getByTestId("datetime-range-picker-calendar-heading", hidden)).toHaveTextContent(
    /November.*December.*2024/,
  )
  await view.rerender(node("visible", "sun", "short"))
  expect(headers()).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"])
  const before = screen.getByTestId("datetime-range-picker-calendar-heading", hidden).props.children
  await fireEvent.press(screen.getByTestId("datetime-range-picker-next-btn", hidden))
  expect(screen.getByTestId("datetime-range-picker-calendar-heading", hidden).props.children).not.toBe(before)
  expect(screen.getByTestId("datetime-range-picker-calendar-heading", hidden)).toHaveTextContent(
    /January.*February.*2025/,
  )
  expect(root.current).toBe(original)
  expect(requests).not.toHaveBeenCalled()
})

it.each(["light", "dark"] as const)(
  "retains range selected calendar palette and final day style precedence in %s mode",
  async (mode) => {
    const start = new CalendarDate(2024, 10, 10),
      root = createRef<View>(),
      requests = jest.fn()
    const node = (
      customCalendarGridBodyCellStyles?: TNativeDateTimeRangePickerProps["customCalendarGridBodyCellStyles"],
    ) => (
      <NativeThemeProvider
        mode={mode}
        overrides={{
          colors: { controlSelectedBackground: "#0000ff", background: mode === "light" ? "#ffffff" : "#000000" },
        }}
      >
        <NativeLocaleProvider locale="en-US">
          <DateTimeRangePicker
            ref={root}
            value={{ start, end: start.add({ days: 2 }) }}
            onChange={requests}
            isOpen
            multiMonth={false}
            customCalendarGridBodyCellStyles={customCalendarGridBodyCellStyles}
          />
        </NativeLocaleProvider>
      </NativeThemeProvider>
    )
    const view = await render(node()),
      original = root.current,
      hidden = { includeHiddenElements: true }
    const selected = screen.getByTestId("datetime-range-picker-day-2024-10-10", hidden)
    expect(selected.props.accessibilityState.selected).toBe(true)
    expect(selected).toHaveStyle({
      backgroundColor: mode === "light" ? "rgba(179, 179, 255, 1)" : "rgba(0, 0, 255, 1)",
    })
    expect(screen.getByTestId("datetime-range-picker-day-2024-10-11", hidden)).toHaveStyle({
      backgroundColor: mode === "light" ? "rgba(217, 217, 255, 1)" : "rgba(0, 0, 217, 1)",
    })
    expect(screen.getByTestId("datetime-range-picker-day-2024-10-12", hidden)).toHaveStyle({
      backgroundColor: mode === "light" ? "rgba(179, 179, 255, 1)" : "rgba(0, 0, 255, 1)",
    })
    expect(screen.getByTestId("datetime-range-picker-day-2024-10-15", hidden).props.accessibilityState.selected).toBe(
      false,
    )
    await view.rerender(node({ backgroundColor: "#ff0000", borderRadius: 0 }))
    expect(screen.getByTestId("datetime-range-picker-day-2024-10-10", hidden)).toHaveStyle({
      backgroundColor: "#ff0000",
      borderRadius: 0,
    })
    await view.rerender(node())
    expect(root.current).toBe(original)
    expect(requests).not.toHaveBeenCalled()
  },
)

it("keeps range default, named and null slots with ordered owner callbacks and original refs", async () => {
  const owner = new CalendarDateTime(2024, 10, 1, 3, 5),
    replacement = owner.add({ days: 5 }),
    root = createRef<View>()
  const calls: Array<[string, unknown]> = [],
    contextRef = jest.fn()
  let state!: Parameters<NonNullable<TNativeDateTimeRangePickerProps["render"]>>[1]["state"]
  const node = (slot?: string | null) => (
    <NativeThemeProvider>
      <NativeDateRangePickerContext.Provider
        value={{
          slots: {
            [NATIVE_DEFAULT_SLOT]: { isReadOnly: true, ref: contextRef },
            editable: { isReadOnly: false, ref: contextRef, onChange: (next) => calls.push(["context", next]) },
          },
        }}
      >
        <DateTimeRangePicker
          ref={root}
          slot={slot}
          value={{ start: owner, end: owner.add({ days: 2 }) }}
          onChange={(next) => calls.push(["owner", next])}
          isOpen={false}
          render={(native, current) => {
            state = current.state
            return <NativeFocusView {...native} />
          }}
        />
      </NativeDateRangePickerContext.Provider>
    </NativeThemeProvider>
  )
  const view = await render(node()),
    original = root.current
  expect(screen.getByTestId("datetime-range-picker-trigger")).toBeDisabled()
  expect(contextRef).toHaveBeenCalledWith(original)
  await view.rerender(node("editable"))
  expect(screen.getByTestId("datetime-range-picker-trigger")).toBeEnabled()
  await act(() => state.setValue({ start: replacement, end: replacement.add({ days: 2 }) }))
  expect(calls.map(([name]) => name)).toEqual(["context", "owner"])
  expect(calls[0][1]).toBe(calls[1][1])
  expect(state.value).toEqual({ start: owner, end: owner.add({ days: 2 }) })
  calls.length = 0
  await view.rerender(node(null))
  expect(screen.getByTestId("datetime-range-picker-trigger")).toBeEnabled()
  await act(() => state.setValue({ start: replacement, end: replacement.add({ days: 2 }) }))
  expect(calls.map(([name]) => name)).toEqual(["owner"])
  expect(root.current).toBe(original)
  await view.unmount()
  expect(root.current).toBeNull()
})

it("retains range uncontrolled defaultOpen and repeated controlled close vetoes on the public renderer", async () => {
  const owner = new CalendarDate(2024, 10, 10),
    change = jest.fn(),
    root = createRef<View>()
  let state!: Parameters<NonNullable<TNativeDateTimeRangePickerProps["render"]>>[1]["state"]
  const node = (controlled: boolean, defaultOpen = true) => (
    <NativeThemeProvider>
      <DateTimeRangePicker
        ref={root}
        value={{ start: owner, end: owner.add({ days: 2 }) }}
        defaultOpen={defaultOpen}
        isOpen={controlled ? true : undefined}
        onOpenChange={change}
        render={(native, current) => {
          state = current.state
          return <NativeFocusView {...native} />
        }}
      />
    </NativeThemeProvider>
  )
  const view = await render(node(false)),
    original = root.current
  expect(state.isOpen).toBe(true)
  await view.rerender(node(false, false))
  expect(state.isOpen).toBe(true)
  expect(change).not.toHaveBeenCalled()
  await act(() => state.close())
  expect(state.isOpen).toBe(false)
  await act(() => state.open())
  expect(state.isOpen).toBe(true)
  await act(() => state.toggle())
  expect(state.isOpen).toBe(false)
  expect(change.mock.calls.map(([open]) => open)).toEqual([false, true, false])
  await view.unmount()
  change.mockClear()
  const controlled = await render(node(true))
  const controlledRoot = root.current
  expect(controlledRoot).not.toBeNull()
  expect(controlledRoot).not.toBe(original)
  await act(() => state.close())
  await act(() => state.close())
  expect(state.isOpen).toBe(true)
  expect(change.mock.calls.map(([open]) => open)).toEqual([false, false])
  expect(root.current).toBe(controlledRoot)
  await controlled.unmount()
  expect(root.current).toBeNull()
})

it("exposes range unavailable calendar dates as disabled independently of selection and bounds", async () => {
  const start = new CalendarDate(2024, 10, 10),
    requests = jest.fn()
  await render(
    <NativeThemeProvider>
      <NativeLocaleProvider locale="en-US">
        <DateTimeRangePicker
          value={{ start, end: start.add({ days: 2 }) }}
          onChange={requests}
          isOpen
          multiMonth={false}
          minValue={new CalendarDate(2024, 10, 5)}
          maxValue={new CalendarDate(2024, 10, 20)}
          isDateUnavailable={(date) => date.day === 14}
        />
      </NativeLocaleProvider>
    </NativeThemeProvider>,
  )
  const hidden = { includeHiddenElements: true }
  expect(screen.getByTestId("datetime-range-picker-day-2024-10-04", hidden)).toBeDisabled()
  expect(screen.getByTestId("datetime-range-picker-day-2024-10-21", hidden)).toBeDisabled()
  expect(screen.getByTestId("datetime-range-picker-day-2024-10-10", hidden)).toBeEnabled()
  expect(screen.getByTestId("datetime-range-picker-day-2024-10-14", hidden)).toBeDisabled()
  expect(screen.getByTestId("datetime-range-picker-day-2024-10-14", hidden).props).not.toHaveProperty("aria-disabled")
  expect(screen.getByTestId("datetime-range-picker-day-2024-10-14", hidden).props).toMatchObject({
    accessibilityState: { disabled: true, selected: false },
    focusable: true,
    nativeTabStop: false,
  })
  expect(requests).not.toHaveBeenCalled()
})

it("consumes range wrapper props without replacing the fixed field scaffold or native layout event", async () => {
  const owner = new CalendarDate(2024, 10, 10),
    layout = jest.fn()
  const authored = {
    value: { start: owner, end: owner.add({ days: 2 }) },
    labels: { calendarAriaLabel: "Dates" },
    multiMonth: false,
    firstDayOfWeek: "mon" as const,
    dayLength: "long" as const,
    shouldCloseOnSelect: false,
    customInputStyles: { padding: 0 },
    customDialogStyles: { padding: 7 },
    geometry: "round" as const,
  }
  await render(
    <NativeThemeProvider>
      <DateTimeRangePicker {...authored} onLayout={layout}>
        <Text testID="ignored-scaffold-child">Ignored child</Text>
      </DateTimeRangePicker>
    </NativeThemeProvider>,
  )
  const root = screen.getByTestId("datetime-range-picker")
  for (const name of Object.keys(authored)) expect(root.props).not.toHaveProperty(name)
  expect(screen.queryByTestId("ignored-scaffold-child")).toBeNull()
  expect(screen.getByTestId("datetime-range-picker-trigger")).toBeOnTheScreen()
  const event = { nativeEvent: { layout: { x: 1, y: 2, width: 200, height: 30 } } }
  await fireEvent(root, "layout", event)
  expect(layout).toHaveBeenCalledTimes(1)
  expect(layout.mock.calls[0][0]).toBe(event)
})
