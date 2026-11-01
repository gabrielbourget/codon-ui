import "../../../collection/__tests__/nativeReceipts"

import { CalendarDateTime } from "@internationalized/date"
import { act, cleanup, within } from "@testing-library/react-native"
import { createRef, type ReactElement, type Ref, type RefAttributes } from "react"
import { AccessibilityInfo, StyleSheet, type StyleProp, type TextStyle, type View } from "react-native"

import { renderWithNativeCollections as render, screen } from "../../../collection/__tests__/nativeReceipts"
import { DateTimePicker, DateTimeRangePicker } from "../../../index"
import { NativeFocusView } from "../../../input/NativeFocusView"
import type { TNativeFocusViewProps } from "../../../input/types"
import { NativeLocaleProvider } from "../../../locale/NativeLocaleProvider"
import { NativeThemeProvider } from "../../../theme"
import type { TNativeDateTimePickerProps } from "../types"

const mockSegmentTargets = new Map<string, View>()
jest.mock("../../../input/specs/CUIDateSegmentNativeComponent", () => {
  const React = jest.requireActual<typeof import("react")>("react")
  const Native = jest.requireActual<typeof import("react-native")>("react-native")
  return {
    __esModule: true,
    default: React.forwardRef<View, { testID: string }>((props, ref) => {
      const bind = React.useCallback(
        (target: View | null) => {
          if (target) mockSegmentTargets.set(props.testID, target)
          else mockSegmentTargets.delete(props.testID)
          if (typeof ref === "function") return ref(target)
          if (ref) ref.current = target
        },
        [props.testID, ref],
      )
      return React.createElement(Native.View, { ...props, ref: bind })
    }),
    Commands: { requestSegmentFocus: jest.fn(), requestSegmentBlur: jest.fn() },
  }
})
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
  mockSegmentTargets.clear()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(async () => {
  await cleanup()
  jest.restoreAllMocks()
})

const hidden = { includeHiddenElements: true }
const date = new CalendarDateTime(2024, 10, 1, 13, 45)
type TFamilyProps = Pick<
  TNativeDateTimePickerProps<CalendarDateTime>,
  "accessible" | "onTouchStart" | "textSize" | "isOpen" | "customCalendarHeaderStyles"
> & {
  render?: (props: TNativeFocusViewProps & RefAttributes<View>) => ReactElement
  style?: StyleProp<TextStyle>
}
const node = (kind: "single" | "range", root: Ref<View>, props: TFamilyProps) => (
  <NativeThemeProvider>
    <NativeLocaleProvider locale="en-GB">
      {kind === "single" ? (
        <DateTimePicker {...props} ref={root} value={date} />
      ) : (
        <DateTimeRangePicker {...props} ref={root} value={{ start: date, end: date.add({ days: 2 }) }} />
      )}
    </NativeLocaleProvider>
  </NativeThemeProvider>
)

it.each(["single", "range"] as const)(
  "honors authored accessible on the public %s original root while retaining defaults, segments and events",
  async (kind) => {
    const root = createRef<View>()
    const onTouchStart = jest.fn()
    const prefix = kind === "single" ? "datetime-picker" : "datetime-range-picker"
    const view = await render(node(kind, root, { onTouchStart }))
    const original = root.current
    const originalFocus = original?.focus
    const segments = new Map(mockSegmentTargets)
    expect(original).not.toBeNull()
    expect(segments.size).toBeGreaterThan(0)
    expect(screen.getByTestId(prefix, hidden).props.accessible).toBe(false)

    await view.rerender(node(kind, root, { accessible: true, onTouchStart }))
    expect(screen.getByTestId(prefix, hidden).props.accessible).toBe(true)
    const renderer: NonNullable<TFamilyProps["render"]> = (props) => <NativeFocusView {...props} />
    await view.rerender(node(kind, root, { accessible: true, onTouchStart, render: renderer }))
    expect(screen.getByTestId(prefix, hidden).props.accessible).toBe(true)
    expect(root.current).toBe(original)
    expect(root.current?.focus).toBe(originalFocus)
    for (const [id, segment] of segments) expect(mockSegmentTargets.get(id)).toBe(segment)
    expect(screen.getByTestId(`${prefix}-group`, hidden).props.accessible).toBe(false)
    const inputs = screen.getAllByTestId(new RegExp(`^${prefix}-input.*-segment-`), hidden)
    expect(
      inputs.filter((segment) => segment.props.ownerId).every((segment) => segment.props.ordinaryInputEvents),
    ).toBe(true)
    const event = { nativeEvent: { identifier: 1 } }
    await act(() => screen.getByTestId(prefix, hidden).props.onTouchStart(event))
    expect(onTouchStart).toHaveBeenCalledWith(event)
    expect(onTouchStart.mock.calls[0][0]).toBe(event)

    for (const accessible of [false, undefined]) {
      await view.rerender(node(kind, root, { accessible, render: renderer }))
      expect(screen.getByTestId(prefix, hidden).props.accessible).toBe(false)
      expect(root.current).toBe(original)
    }
    await view.rerender(
      node(kind, root, {
        accessible: true,
        render: (props) => <NativeFocusView {...props} accessible={false} style={{ opacity: 0 }} />,
      }),
    )
    expect(screen.getByTestId(prefix, hidden).props.accessible).toBe(false)
    expect(screen.getByTestId(prefix, hidden)).toHaveStyle({ opacity: 0 })
    expect(root.current).toBe(original)
    await view.unmount()
    expect(root.current).toBeNull()
  },
)

it.each(["single", "range"] as const)(
  "keeps the public %s canonical string size fallback across field and calendar text with authored precedence",
  async (kind) => {
    const root = createRef<View>()
    const prefix = kind === "single" ? "datetime-picker" : "datetime-range-picker"
    const view = await render(node(kind, root, { textSize: "canonical-custom", isOpen: true }))
    const original = root.current
    for (const textSize of ["canonical-custom", "", undefined, "medium", "small", "large"]) {
      await view.rerender(node(kind, root, { textSize, isOpen: true }))
      const fontSize = textSize === "small" ? 12 : textSize === "large" ? 16 : 14
      for (const year of screen.getAllByText("2024", hidden))
        expect(StyleSheet.flatten(year.props.style).fontSize).toBe(fontSize)
      expect(screen.getByTestId(`${prefix}-calendar-heading`, hidden)).toHaveStyle({ fontSize })
      expect(within(screen.getAllByRole("columnheader", hidden)[0]).getByText(/./, hidden)).toHaveStyle({ fontSize })
      expect(root.current).toBe(original)
    }
    await view.rerender(
      node(kind, root, {
        textSize: "another-custom-size",
        isOpen: true,
        customCalendarHeaderStyles: { fontSize: 23 },
        style: { opacity: 0 },
      }),
    )
    expect(screen.getByTestId(`${prefix}-calendar-heading`, hidden)).toHaveStyle({ fontSize: 23 })
    expect(screen.getByTestId(prefix, hidden)).toHaveStyle({ opacity: 0 })
    expect(root.current).toBe(original)
  },
)
