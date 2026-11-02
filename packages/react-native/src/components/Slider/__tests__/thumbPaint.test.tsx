import { act, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { AccessibilityInfo, Animated, PlatformColor, processColor, StyleSheet } from "react-native"

import {
  NativeThemeProvider,
  Slider,
  type NativeThemeOverrides,
  type TNativeSliderRef,
  type TNativeSliderStyleState,
} from "../../.."

jest.mock("../../../input/specs/CUIFocusViewNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
  Commands: {
    requestKeyboardFocus: jest.fn(),
    requestKeyboardBlur: jest.fn(),
    requestContainerFocus: jest.fn(),
    inspectAccessibility: jest.fn(),
  },
}))

let state: TNativeSliderStyleState
const observe = (current: TNativeSliderStyleState) => {
  state = current
  return {}
}
const paint = () => StyleSheet.flatten(screen.getByTestId("slider-thumb-1").props.style).backgroundColor
const drag = (value: boolean) => act(() => state.state.setThumbDragging(0, value))
beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

it("uses the canonical 250ms ease-in-out background clock without changing the original root ref or owner value", async () => {
  const ref = createRef<TNativeSliderRef>()
  const onChange = jest.fn()
  const timing = jest.spyOn(Animated, "timing")
  const result = await render(<Slider label="Value" ref={ref} value={25} style={observe} onChange={onChange} />)
  const original = ref.current
  const resting = processColor(paint())
  await drag(true)
  expect(timing).toHaveBeenCalledTimes(4)
  for (const [, config] of timing.mock.calls) {
    expect(config).toMatchObject({ duration: 250, delay: 0, useNativeDriver: false, isInteraction: false })
    expect(config.easing!(0.25)).toBeCloseTo(0.12916, 4)
  }
  await act(() => jest.advanceTimersByTime(125))
  expect(processColor(paint())).not.toBe(resting)
  expect(processColor(paint())).not.toBe(processColor("#474747"))
  await act(() => jest.advanceTimersByTime(200))
  expect(processColor(paint())).toBe(processColor("#474747"))
  expect(ref.current).toBe(original)
  expect(state.state.values).toEqual([25])
  expect(onChange).not.toHaveBeenCalled()
  await result.unmount()
  expect(ref.current).toBeNull()
})

it("retargets a live provider timing change from current paint and restores the default after override removal", async () => {
  const node = (duration?: number, mode: "light" | "dark" = "light") => (
    <NativeThemeProvider mode={mode} overrides={{ transitions: { backgroundColor: duration } }}>
      <Slider label="Value" style={observe} />
    </NativeThemeProvider>
  )
  const timing = jest.spyOn(Animated, "timing")
  const result = await render(node(1000))
  await drag(true)
  await act(() => jest.advanceTimersByTime(500))
  const before = processColor(paint())
  await result.rerender(node(2000, "dark"))
  expect(processColor(paint())).toBe(before)
  expect(timing.mock.calls.at(-1)![1].duration).toBe(2000)
  await act(() => jest.advanceTimersByTime(2100))
  expect(processColor(paint())).toBe(processColor("#9e9e9e"))
  await result.rerender(node(undefined, "light"))
  expect(timing.mock.calls.at(-1)![1].duration).toBe(250)
  await act(() => jest.advanceTimersByTime(350))
  expect(processColor(paint())).toBe(processColor("#474747"))
})

it("honors theme delay/easing and final custom-thumb paint over explicit color and dragging", async () => {
  const overrides: NativeThemeOverrides = {
    transitions: { backgroundColor: { duration: "1s", delay: "100ms", easing: "linear" } },
  }
  const node = (color: "red" | "blue") => (
    <NativeThemeProvider overrides={overrides}>
      <Slider label="Value" style={observe} thumbColor="green" customThumbStyles={{ backgroundColor: color }} />
    </NativeThemeProvider>
  )
  const result = await render(node("red"))
  await drag(true)
  await result.rerender(node("blue"))
  await act(() => jest.advanceTimersByTime(90))
  expect(processColor(paint())).toBe(processColor("red"))
  await act(() => jest.advanceTimersByTime(510))
  expect(processColor(paint())).not.toBe(processColor("red"))
  expect(processColor(paint())).not.toBe(processColor("blue"))
  await act(() => jest.advanceTimersByTime(600))
  expect(processColor(paint())).toBe(processColor("blue"))
})

it("snaps an active transition on live Reduce Motion and retires subscriptions and clocks on unmount", async () => {
  const subscriptions = jest.spyOn(AccessibilityInfo, "addEventListener").mockClear()
  const actualTiming = Animated.timing
  const clocks: jest.SpyInstance[] = []
  jest.spyOn(Animated, "timing").mockImplementation((...args) => {
    const clock = actualTiming(...args)
    clocks.push(jest.spyOn(clock, "stop"))
    return clock
  })
  const result = await render(<Slider label="Value" style={observe} />)
  await drag(true)
  await act(() => jest.advanceTimersByTime(80))
  const calls = subscriptions.mock.calls as unknown as readonly (readonly [string, (value: boolean) => void])[]
  const listeners = calls.filter(([event]) => event === "reduceMotionChanged")
  const removals = subscriptions.mock.results.map(({ value }) => jest.spyOn(value, "remove"))
  await act(() => {
    for (const [, listener] of listeners) listener(true)
  })
  expect(paint()).toBe("#474747")
  await result.unmount()
  expect(removals).toHaveLength(listeners.length)
  for (const remove of removals) expect(remove).toHaveBeenCalledTimes(1)
  expect(clocks).toHaveLength(4)
  for (const stop of clocks) expect(stop).toHaveBeenCalled()
  await act(() => jest.advanceTimersByTime(500))
})

it("keeps Reduce Motion conservative when its query fails and preserves opaque native colors without interpolation", async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockRejectedValue(new Error("preference unavailable"))
  const timing = jest.spyOn(Animated, "timing")
  const color = PlatformColor("labelColor")
  const result = await render(<Slider label="Value" style={observe} />)
  await drag(true)
  expect(paint()).toBe("#474747")
  await result.rerender(<Slider label="Value" thumbColor={color} style={observe} />)
  expect(paint()).toBe(color)
  expect(timing).not.toHaveBeenCalled()
})
