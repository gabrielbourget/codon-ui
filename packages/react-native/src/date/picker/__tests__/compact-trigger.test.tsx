import "../../../collection/__tests__/nativeReceipts"

import { cleanup } from "@testing-library/react-native"
import { createRef, type Ref } from "react"
import { AccessibilityInfo, Platform, View } from "react-native"

import {
  fireEventWithNativeCollections as fireEvent,
  renderWithNativeCollections as render,
  screen,
} from "../../../collection/__tests__/nativeReceipts"
import { DateTimePicker } from "../../../components/DateTimePicker/DateTimePicker"
import { DateTimeRangePicker } from "../../../components/DateTimeRangePicker/DateTimeRangePicker"
import { NativeLocaleProvider } from "../../../locale/NativeLocaleProvider"
import { NativeThemeProvider } from "../../../theme"

jest.mock("../../../input/specs/CUIDateSegmentNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
  Commands: { requestSegmentFocus: jest.fn(), requestSegmentBlur: jest.fn() },
}))
jest.mock("../../../components/ClickPopover/ClickPopover", () => ({
  NativeFloatingSurface: () => null,
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
afterEach(async () => {
  await cleanup()
  jest.restoreAllMocks()
})

it.each([
  ["single", "ios"],
  ["single", "android"],
  ["range", "ios"],
  ["range", "android"],
] as const)("renders the compact %s calendar trigger with measured hit slop on %s", async (kind, platform) => {
  const platformSpy = jest.replaceProperty(Platform, "OS", platform)
  const root = createRef<View>()
  const onOpenChange = jest.fn()
  const Picker = kind === "single" ? DateTimePicker : DateTimeRangePicker
  const prefix = kind === "single" ? "datetime-picker" : "datetime-range-picker"
  try {
    const node = (disabled = false) => (
      <NativeThemeProvider>
        <NativeLocaleProvider locale="en-US">
          <Picker ref={root} isOpen={false} isDisabled={disabled} onOpenChange={onOpenChange} />
        </NativeLocaleProvider>
      </NativeThemeProvider>
    )
    const result = await render(node())
    const originalRoot = root.current
    const trigger = screen.getByTestId(`${prefix}-trigger`)
    const label = trigger.props.accessibilityLabel
    expect(screen.getByRole("button", { name: label })).toBe(trigger)
    expect(trigger).toHaveStyle({ width: "auto", height: "auto", minWidth: undefined, minHeight: undefined })
    expect(trigger.props.accessibilityState.disabled).toBe(false)
    const target = platform === "ios" ? 44 : 48
    // This is a supplied layout receipt, not a native measurement or unclipped-target claim.
    await fireEvent(trigger, "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 15, height: 15 } } })
    expect(trigger.props.hitSlop).toEqual({
      left: (target - 15) / 2,
      right: (target - 15) / 2,
      top: (target - 15) / 2,
      bottom: (target - 15) / 2,
    })
    await fireEvent.press(trigger)
    expect(onOpenChange.mock.calls).toEqual([[true]])
    await result.rerender(node(true))
    expect(root.current).toBe(originalRoot)
    expect(screen.getByTestId(`${prefix}-trigger`)).toBe(trigger)
    expect(trigger.props.accessibilityLabel).toBe(label)
    expect(trigger.props.accessibilityState.disabled).toBe(true)
    await fireEvent.press(trigger)
    expect(onOpenChange.mock.calls).toEqual([[true]])
  } finally {
    platformSpy.restore()
  }
})

it.each(["single", "range"] as const)(
  "retains a caller-sized %s calendar icon and authoritative trigger dimensions",
  async (kind) => {
    const Picker = kind === "single" ? DateTimePicker : DateTimeRangePicker
    const prefix = kind === "single" ? "datetime-picker" : "datetime-range-picker"
    const root = createRef<View>()
    const node = (custom = false) => (
      <NativeThemeProvider>
        <NativeLocaleProvider locale="en-US">
          <Picker
            ref={root}
            ComponentIcon={<View testID="caller-calendar-icon" style={{ width: 31, height: 21 }} />}
            customButtonStyles={custom ? { width: 37, height: 29, padding: 3 } : undefined}
          />
        </NativeLocaleProvider>
      </NativeThemeProvider>
    )
    const result = await render(node())
    const originalRoot = root.current
    const originalIcon = screen.getByTestId("caller-calendar-icon")
    const trigger = screen.getByTestId(`${prefix}-trigger`)
    expect(trigger).toHaveStyle({ width: "auto", height: "auto", minWidth: undefined, minHeight: undefined })
    expect(originalIcon).toHaveStyle({ width: 31, height: 21 })
    await result.rerender(node(true))
    expect(root.current).toBe(originalRoot)
    expect(screen.getByTestId("caller-calendar-icon")).toBe(originalIcon)
    expect(screen.getByTestId(`${prefix}-trigger`)).toBe(trigger)
    expect(trigger).toHaveStyle({ width: 37, height: 29, padding: 3 })
  },
)
