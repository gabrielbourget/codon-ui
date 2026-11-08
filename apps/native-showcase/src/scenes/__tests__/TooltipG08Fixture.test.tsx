import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import { AccessibilityInfo, StyleSheet, type View } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"

import { NativeShowcase } from "../NativeShowcase"
import { TOOLTIP_STYLE_CASES } from "../TooltipG08Fixture"

const ReactNative = jest.requireActual<typeof import("react-native")>("react-native")

beforeEach(() => {
  jest.useFakeTimers()
  jest
    .spyOn(ReactNative, "findNodeHandle")
    .mockImplementation((value) => (value == null ? null : typeof value === "number" ? value : 81))
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})
const state = () => JSON.parse(screen.getByTestId("tooltip-native-state").props.accessibilityLabel)
const enter = async () => {
  await render(
    <SafeAreaInsetsContext.Provider value={{ top: 20, bottom: 10, left: 0, right: 0 }}>
      <NativeShowcase />
    </SafeAreaInsetsContext.Provider>,
  )
  const user = userEvent.setup(),
    press = (name: string) => user.press(screen.getByRole("button", { name }))
  await press("Tooltip scene")
  await press("Prepare standalone Tooltip checks")
  return press
}
it("prepares Tooltip cold delay, owner veto, original anchor action and retirement through public controllers", async () => {
  const press = await enter()
  await press("Open delayed")
  const command = state().commands.at(-1)
  await act(() => jest.advanceTimersByTime(Math.max(0, command.epochMs + 1499 - Date.now())))
  expect(state().open).toBe(false)
  await act(() => jest.advanceTimersByTime(1))
  expect(state().open).toBe(true)
  expect(state().requests.at(-1).epochMs - command.epochMs).toBeGreaterThanOrEqual(1500)
  await press("Veto owner")
  await press("Original action")
  expect(state()).toMatchObject({ open: true, actions: 1 })
  expect(state().requests.at(-1).value).toBe(false)
  await press("Veto owner")
  await press("Original action")
  expect(state()).toMatchObject({ open: false, actions: 2 })
  await press("Open now")
  expect(state().open).toBe(true)
  await press("Retire tooltip")
  expect(state()).toMatchObject({ open: true, mounted: false })
  expect(screen.queryByTestId("tooltip-native-anchor")).toBeNull()
  expect(screen.queryByTestId("tooltip-native-surface", { includeHiddenElements: true })).toBeNull()
  await press("Fresh tooltip")
  expect(screen.getByTestId("tooltip-native-anchor")).toBeOnTheScreen()
})
it("preflights Tooltip owner styles, zero arrow, narrow text and current provider colors", async () => {
  const press = await enter()
  await press("Tooltip styles")
  for (const name of TOOLTIP_STYLE_CASES) {
    expect(state().case).toBe(name)
    const node = screen.getByTestId("tooltip-native-surface", { includeHiddenElements: true }),
      style = StyleSheet.flatten(node.props.style)
    expect(style.width).toBe(name === "narrow" ? 128 : 220)
    if (name === "custom") expect(style).toMatchObject({ padding: 7, borderWidth: 3, backgroundColor: "#ddeeff" })
    if (name === "final") expect(style).toMatchObject({ padding: 3, borderWidth: 1, backgroundColor: "#ffeedd" })
    expect(screen.getByTestId("tooltip-native-canvas")).toHaveStyle({
      height: 340,
      paddingTop: 200,
      backgroundColor: "#808080",
    })
    if (name !== TOOLTIP_STYLE_CASES.at(-1)) await press("Next Tooltip style")
  }
})
it("prepares Tooltip native motion epochs and snapshots transient original event fields", async () => {
  const press = await enter()
  const event = { target: 79, currentTarget: 81, nativeEvent: { timestamp: Date.now() } }
  await fireEvent(screen.getByTestId("tooltip-native-anchor"), "press", event)
  event.currentTarget = 0
  expect(state().events.at(-1)).toMatchObject({ target: 79, currentTarget: 81, phase: "press" })
  await press("Tooltip motion")
  for (const [id, rect] of [
    ["showcase-floating-host", [0, 0, 400, 700]],
    ["tooltip-native-anchor", [100, 300, 80, 44]],
    ["tooltip-native-surface", [0, 0, 220, 60]],
  ] as const) {
    let fiber = screen.getByTestId(id, { includeHiddenElements: true }).unstable_fiber
    let native: View | null = null
    while (fiber) {
      const instance = fiber.stateNode as View | null
      if (typeof instance?.measureInWindow === "function") {
        native = instance
        break
      }
      fiber = fiber.return
    }
    expect(native).not.toBeNull()
    Object.defineProperty(native, "measureInWindow", {
      configurable: true,
      value: jest.fn((callback: Parameters<View["measureInWindow"]>[0]) =>
        callback(rect[0], rect[1], rect[2], rect[3]),
      ),
    })
  }
  await fireEvent(screen.getByTestId("showcase-floating-host"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 700 } },
  })
  await fireEvent(screen.getByTestId("tooltip-native-surface", { includeHiddenElements: true }), "layout", {
    target: 81,
    currentTarget: 81,
    nativeEvent: { layout: { width: 220, height: 60 } },
  })
  expect(state()).toMatchObject({
    layouts: [{ target: 81, currentTarget: 81, width: 220, height: 60 }],
    rendered: { isEntering: false },
  })
  await press("Arm Tooltip motion")
  await act(() => jest.advanceTimersByTime(6900))
  expect(state().forceEntering).toBe(false)
  await act(() => jest.advanceTimersByTime(600))
  expect(state().forceEntering).toBe(true)
  expect(state().commands.at(-1)).toMatchObject({
    name: "entry-acknowledged",
    rootLayout: { target: 81, currentTarget: 81, width: 220, height: 60 },
    rendered: { isEntering: true },
  })
  await act(() => jest.advanceTimersByTime(1499))
  expect(state().forceEntering).toBe(true)
  await act(() => jest.advanceTimersByTime(1))
  expect(state().mounted).toBe(false)
  expect(state().forceEntering).toBe(false)
  await act(() => jest.advanceTimersByTime(2000))
  expect(state().mounted).toBe(true)
  expect(state().commands.map((row: { name: string }) => row.name)).toEqual([
    ...Array.from({ length: 40 }, (_, i) => `retarget-${i}`),
    "settle",
    "entry-acknowledged",
    "retire",
    "fresh",
  ])
})
it("observes the original hidden arrow layout without adding an accessibility target or replacing its callback", async () => {
  const press = await enter()
  await press("Open now")
  const arrow = screen.getByTestId("tooltip-native-surface-overlay-arrow", { includeHiddenElements: true })
  expect(arrow.props).toMatchObject({
    accessible: false,
    accessibilityElementsHidden: true,
    importantForAccessibility: "no-hide-descendants",
  })
  const event = { target: 79, currentTarget: 83, nativeEvent: { layout: { x: 110, y: 44, width: 18, height: 10 } } }
  await fireEvent(arrow, "layout", event)
  event.currentTarget = 0
  expect(state().arrowLayout).toMatchObject({
    target: 79,
    currentTarget: 83,
    parentTag: 81,
    x: 110,
    y: 44,
    width: 18,
    height: 10,
  })
  expect(screen.getByTestId("tooltip-native-surface-overlay-arrow", { includeHiddenElements: true })).toHaveStyle({
    transform: [{ translateX: -9 }],
  })
})
