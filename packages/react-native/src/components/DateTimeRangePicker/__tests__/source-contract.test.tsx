import "../../../collection/__tests__/nativeReceipts"

import { CalendarDateTime } from "@internationalized/date"
import { cleanup } from "@testing-library/react-native"
import { createRef, type Ref } from "react"
import { AccessibilityInfo, type View } from "react-native"

import { renderWithNativeCollections as render, screen } from "../../../collection/__tests__/nativeReceipts"
import { NativeDateRangePickerContext } from "../../../date/picker/context"
import { DateTimeRangePicker } from "../../../index"
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
