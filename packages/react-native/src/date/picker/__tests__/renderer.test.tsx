import "../../../collection/__tests__/nativeReceipts"

import { CalendarDate, CalendarDateTime, parseZonedDateTime } from "@internationalized/date"
import { act as rawAct, cleanup, userEvent } from "@testing-library/react-native"
import { createRef, type Ref } from "react"
import type { View } from "react-native"
import { AccessibilityInfo } from "react-native"

import { renderWithNativeCollections as render, screen } from "../../../collection/__tests__/nativeReceipts"
import { DateTimePicker, DateTimeRangePicker } from "../../../index"
import type { TNativeFieldInputScope } from "../../../input/fieldInput"
import { NativeFocusView } from "../../../input/NativeFocusView"
import { NativeLocaleProvider } from "../../../locale/NativeLocaleProvider"
import { NativeThemeProvider } from "../../../theme"
import { NativeDatePickerContext } from "../context"

import { DatePickerFixture } from "./fixtures/DatePickerFixture"

jest.unmock("react-native/Libraries/Components/TextInput/TextInput")
jest.mock("../../../input/specs/CUIDateSegmentNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
  Commands: { requestSegmentFocus: jest.fn(), requestSegmentBlur: jest.fn() },
}))
jest.mock("../../../input/useFieldInputBinding", () => ({
  useNativeFieldInputBinding: () => ({
    scope: null as TNativeFieldInputScope | null,
    metadata: { binding: () => "", commit: () => {}, receive: () => {} },
    status: { ready: false },
  }),
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

it.each([
  new CalendarDate(2024, 10, 1),
  new CalendarDateTime(2024, 10, 1, 13, 45, 7),
  parseZonedDateTime("2024-10-01T13:45[America/New_York]"),
])("renders complete original date/time segment types without replacing the root: %s", async (value) => {
  const ref = createRef<View>()
  const view = await render(
    <NativeThemeProvider>
      <NativeLocaleProvider locale="en-US">
        <DateTimePicker ref={ref} value={value} />
      </NativeLocaleProvider>
    </NativeThemeProvider>,
  )
  const original = ref.current
  expect(screen.getAllByTestId(/^datetime-picker-input-segment-/).some((segment) => segment.props.ownerId)).toBe(true)
  expect(screen.getByText("2024")).toBeTruthy()
  await view.rerender(
    <NativeThemeProvider>
      <NativeLocaleProvider locale="en-US">
        <DateTimePicker ref={ref} value={value} render={(props) => <NativeFocusView {...props} focusable={false} />} />
      </NativeLocaleProvider>
    </NativeThemeProvider>,
  )
  expect(ref.current === original).toBe(true)
})

it("renders independent start/end groups and complete leading-zero/24-hour defaults", async () => {
  await render(
    <NativeThemeProvider>
      <NativeLocaleProvider locale="en-US">
        <DateTimeRangePicker
          value={{ start: new CalendarDateTime(2024, 10, 1, 3, 5), end: new CalendarDateTime(2024, 10, 3, 18, 20) }}
        />
      </NativeLocaleProvider>
    </NativeThemeProvider>,
  )
  expect(screen.getByTestId("datetime-range-picker-input-start")).toBeTruthy()
  expect(screen.getByTestId("datetime-range-picker-input-end")).toBeTruthy()
  expect(screen.getAllByText("2024")).toHaveLength(2)
  expect(screen.getByText("18")).toBeTruthy()
})

it("renders two locale weeks grids by default for single and one for range", async () => {
  const view = await render(
    <NativeThemeProvider>
      <NativeLocaleProvider locale="en-US">
        <DateTimePicker isOpen value={new CalendarDate(2024, 10, 1)} />
      </NativeLocaleProvider>
    </NativeThemeProvider>,
  )
  expect(screen.getAllByTestId("datetime-picker-calendar-grid")).toHaveLength(2)
  expect(screen.getAllByRole("columnheader")).toHaveLength(14)
  expect(screen.getByTestId("datetime-picker-calendar-heading")).toHaveTextContent(/October.*November.*2024/)
  await view.unmount()
  await render(
    <NativeThemeProvider>
      <NativeLocaleProvider locale="en-US">
        <DateTimeRangePicker
          isOpen
          value={{ start: new CalendarDate(2024, 10, 1), end: new CalendarDate(2024, 10, 3) }}
        />
      </NativeLocaleProvider>
    </NativeThemeProvider>,
  )
  expect(screen.getAllByTestId("datetime-range-picker-calendar-grid")).toHaveLength(1)
  expect(screen.getAllByRole("columnheader")).toHaveLength(7)
})

it("merges named/default/null picker context without losing false and zero styles", async () => {
  await render(
    <NativeThemeProvider>
      <NativeDatePickerContext.Provider value={{ isDisabled: true, style: { opacity: 0.4 } }}>
        <DateTimePicker isDisabled={false} customStyles={{ opacity: 0 }} value={new CalendarDate(2024, 10, 1)} />
      </NativeDatePickerContext.Provider>
    </NativeThemeProvider>,
  )
  expect(screen.getByTestId("datetime-picker")).toHaveStyle({ opacity: 0 })
  expect(screen.getByTestId("datetime-picker-trigger").props.accessibilityState.disabled).toBe(false)
})

it("keeps the public owner fixture and held empty original editor through renderer, locale and value-class controls", async () => {
  const input = createRef<import("react-native").TextInput>()
  await render(<DatePickerFixture inputRef={input} />)
  const original = input.current
  const write = jest.spyOn(original!, "setNativeProps")
  for (const ready of [false, true]) {
    const host = screen.getByTestId("date-fixture-host").props
    await rawAct(() =>
      host.onNativeScopeStatus({
        nativeEvent: {
          ownerId: host.ownerId,
          windowId: "date-window",
          epoch: 1,
          policyRevision: host.policyRevision,
          ready,
          windowActive: true,
        },
      }),
    )
  }
  const user = userEvent.setup()
  await user.press(screen.getByRole("button", { name: "Toggle date root renderer" }))
  await user.press(screen.getByRole("button", { name: "Next date locale/calendar" }))
  await user.press(screen.getByRole("button", { name: "Next date class" }))
  expect(screen.getByTestId("date-fixture-state")).toHaveTextContent(/Class CalendarDateTime.*Locale ar-EG/)
  expect(input.current === original).toBe(true)
  expect(screen.getByLabelText("Held empty date-scene editor").props).toMatchObject({
    value: "",
    selection: { start: 0, end: 0 },
  })
  expect(write).not.toHaveBeenCalled()
})
