import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { AccessibilityInfo } from "react-native"
// @ts-expect-error The pinned read-only RN feature-flag module publishes Flow types only.
import { enableImperativeFocus } from "react-native/src/private/featureflags/ReactNativeFeatureFlags"

import { focusNativeTarget, NativeOverlayProvider } from "@codon-ui/react-native"

import { Commands } from "../../../../../packages/react-native/src/input/specs/CUIFocusViewNativeComponent"
import { SelectG08Fixture, snapshotSelectEvent } from "../SelectG08Fixture"

let mockSelectRef: import("react-native").View | null = null
jest.mock("@codon-ui/react-native", () => {
  const actual = jest.requireActual("@codon-ui/react-native")
  const React = jest.requireActual("react")
  return {
    ...actual,
    Select: React.forwardRef((props: object, ref: import("react").ForwardedRef<import("react-native").View>) => {
      const bind = React.useCallback(
        (node: import("react-native").View | null) => {
          mockSelectRef = node
          if (typeof ref === "function") return ref(node)
          if (ref) ref.current = node
        },
        [ref],
      )
      return React.createElement(actual.Select, { ...props, ref: bind })
    }),
  }
})

jest.mock("react-native/src/private/featureflags/ReactNativeFeatureFlags", () => ({
  ...jest.requireActual("react-native/src/private/featureflags/ReactNativeFeatureFlags"),
  enableImperativeFocus: jest.fn(() => false),
}))

jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual("react-native")
  return {
    SafeAreaProvider: View,
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  }
})

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})
const press = (label: string) => fireEvent.press(screen.getByRole("button", { name: label }))
const state = () =>
  JSON.parse(screen.getByTestId("select-native-state", { includeHiddenElements: true }).props.accessibilityLabel)

it("preflights Select native ownership requests and ordered typed selection without changing owner veto", async () => {
  await render(<SelectG08Fixture />)
  await press("Case ownership")
  for (let count = 0; count < 3; count++) await press("Choose")
  expect(state().requests).toEqual({ opens: 3, closes: 0, values: 0 })
  for (let count = 0; count < 3; count++) await fireEvent.press(screen.getByRole("radio", { name: "String zero" }))
  expect(state()).toMatchObject({ value: "string:0", open: false, requests: { opens: 3, closes: 3, values: 3 } })
  expect(state().events.slice(-2)).toMatchObject([
    { phase: "value", value: "string:0", stale: false },
    { phase: "open", value: false, stale: false },
  ])
  await press("Clear controlled value")
  expect(state().value).toBe("null")
})

it("preflights Select trigger ref focus scalars separately from root, retirement and fresh ownership", async () => {
  await render(<SelectG08Fixture />)
  await press("Case collections")
  const original = screen.getByRole("button", { name: "Choose" })
  await press("Relabel selected")
  expect(screen.getByRole("button", { name: "Choose" })).toBe(original)
  const event = { target: 17, currentTarget: 17, nativeEvent: { target: 17 } }
  const snapshot = snapshotSelectEvent(event)
  event.target = 99
  event.nativeEvent.target = 99
  expect(snapshot).toEqual({ target: 17, currentTarget: 17, nativeTarget: 17 })
  await press("Retire Select owner")
  expect(state().ownerVisible).toBe(false)
  await press("Fresh Select owner")
  expect(state()).toMatchObject({ generation: 1, ownerVisible: true, value: "number:0", open: false })
})

it("preflights Select native style constraints and preserves the original default-only ownership route", async () => {
  await render(<SelectG08Fixture />)
  await press("Case styles")
  expect(state()).toMatchObject({ styleName: "baseline", width: 292 })
  for (const styleName of ["error", "warning", "success", "custom", "final", "narrow", "null-icon", "custom-icon"]) {
    await press("Next Select style")
    expect(state().styleName).toBe(styleName)
    expect(state().width).toBe(styleName === "narrow" ? 232 : 292)
  }
  await press("Reset fixture")
  await press("Case uncontrolled")
  await fireEvent.press(screen.getByRole("radio", { name: "String zero" }))
  await press("Change defaults")
  expect(screen.getByRole("button", { name: "Choose" }).props.accessibilityValue.text).toBe("String zero")
})

it("snapshots Select host-instance event and root-layout targets to immutable numeric native tags", async () => {
  const target = { _nativeTag: 17 }
  const payload = { target, currentTarget: target, nativeEvent: { target: 17 } }
  const scalar = snapshotSelectEvent(payload)
  target._nativeTag = 99
  payload.nativeEvent.target = 99
  expect(scalar).toEqual({ target: 17, currentTarget: 17, nativeTarget: 17 })
  await render(<SelectG08Fixture />)
  await press("Case collections")
  const root = { _nativeTag: 23 }
  const layout = { target: root, currentTarget: root, nativeEvent: { layout: { x: 1, y: 2, width: 292, height: 44 } } }
  await fireEvent(screen.getByTestId("lab-select"), "layout", layout)
  root._nativeTag = 100
  layout.nativeEvent.layout.width = 999
  expect(state().rootLayout).toMatchObject({
    target: 23,
    currentTarget: 23,
    x: 1,
    y: 2,
    width: 292,
    height: 44,
    generation: 0,
  })
})

it("preflights Select live metadata replacement during veto and a single disabled held-open closure request", async () => {
  await render(<SelectG08Fixture />)
  await press("Case ownership")
  for (let count = 0; count < 3; count++) await press("Choose")
  await fireEvent.press(screen.getByRole("radio", { name: "String zero" }))
  expect(screen.getByRole("radio", { name: "Renamed zero" }).props.accessibilityState.checked).toBe(true)
  await fireEvent.press(screen.getByRole("radio", { name: "String zero" }))
  expect(screen.queryByRole("radio", { name: "Renamed zero" })).toBeNull()
  expect(state()).toMatchObject({ value: "number:0", open: true, requests: { values: 2, closes: 2 } })
  await fireEvent.press(screen.getByRole("radio", { name: "String zero" }))
  expect(state()).toMatchObject({ value: "string:0", open: false, requests: { values: 3, closes: 3 } })
  await press("Reset fixture")
  await press("Case disabled-held")
  await press("Choose")
  expect(state()).toMatchObject({ disabled: true, open: true, requests: { opens: 1, closes: 1, values: 0 } })
  await press("Close choices")
  expect(state().requests.closes).toBe(2)
  await press("Close choices")
  expect(state()).toMatchObject({ open: false, requests: { opens: 1, closes: 3, values: 0 } })
})

it("preflights Select visible trigger interruption controls and cancels the existing owned frame on unmount", async () => {
  const view = await render(<SelectG08Fixture />)
  await press("Case lifetime")
  await press("First Select border")
  expect(state().styleName).toBe("error")
  await press("Second Select border")
  expect(state().styleName).toBe("success")
  await press("Interrupt Select border")
  expect(state().styleName).toBe("error")
  await act(() => jest.advanceTimersByTime(20))
  expect(state().styleName).toBe("success")
  const cancel = jest.spyOn(globalThis, "cancelAnimationFrame")
  await press("Interrupt Select border")
  await view.unmount()
  expect(cancel).toHaveBeenCalled()
})

it("composes Select nested window inside the existing showcase overlay provider without a duplicate provider", async () => {
  await render(
    <NativeOverlayProvider>
      <SelectG08Fixture />
    </NativeOverlayProvider>,
  )
  await press("Case nested")
  expect(screen.getByRole("button", { name: "Open parent" })).toBeOnTheScreen()
  await press("Open parent")
  expect(screen.getByRole("button", { name: "Choose" })).toBeOnTheScreen()
  expect(screen.getByTestId("parent-draft")).toBeOnTheScreen()
  expect(state()).toMatchObject({ scenario: "nested", ownerVisible: true, draft: "Draft" })
})

it("routes fixture focus and blur through public helpers on original registered Select targets", async () => {
  const getter = jest.mocked(enableImperativeFocus)
  getter.mockClear().mockReturnValue(false)
  const focusCommand = jest.spyOn(Commands, "requestKeyboardFocus").mockImplementation(() => {})
  const blurCommand = jest.spyOn(Commands, "requestKeyboardBlur").mockImplementation(() => {})
  await render(<SelectG08Fixture />)
  await press("Case ownership")
  const original = mockSelectRef!
  const focus = jest.spyOn(original, "focus").mockImplementation(() => {})
  const originalTag = state().triggerTag
  const owner = screen.getByRole("button", { name: "Choose" }).props.ownerId
  await press("Focus Select trigger")
  expect(focusCommand).toHaveBeenCalledTimes(1)
  expect(focusCommand).toHaveBeenLastCalledWith(original, owner)
  expect(focus).not.toHaveBeenCalled()
  await press("Blur Select trigger")
  expect(blurCommand).toHaveBeenCalledTimes(1)
  expect(blurCommand).toHaveBeenLastCalledWith(original, owner)
  const first = state().focusRequest
  expect(first).toEqual({ sequence: 1, enabled: false, triggerTag: originalTag, generation: 0 })
  await press("Retire Select owner")
  expect(focusNativeTarget(original)).toBe(false)
  expect(focusCommand).toHaveBeenCalledTimes(1)
  await press("Fresh Select owner")
  const fresh = mockSelectRef!
  expect(fresh).not.toBe(original)
  const freshFocus = jest.spyOn(fresh, "focus").mockImplementation(() => {})
  getter.mockReturnValue(true)
  await press("Focus Select trigger")
  expect(focus).not.toHaveBeenCalled()
  expect(freshFocus).not.toHaveBeenCalled()
  expect(focusCommand).toHaveBeenCalledTimes(2)
  expect(focusCommand).toHaveBeenLastCalledWith(fresh, screen.getByRole("button", { name: "Choose" }).props.ownerId)
  await press("Blur Select trigger")
  expect(blurCommand).toHaveBeenCalledTimes(2)
  expect(blurCommand).toHaveBeenLastCalledWith(fresh, screen.getByRole("button", { name: "Choose" }).props.ownerId)
  expect(state().focusRequest).toEqual({ sequence: 2, enabled: true, triggerTag: state().triggerTag, generation: 1 })
  expect(first).toEqual({ sequence: 1, enabled: false, triggerTag: originalTag, generation: 0 })
  expect(getter).toHaveBeenCalledTimes(2)
})
