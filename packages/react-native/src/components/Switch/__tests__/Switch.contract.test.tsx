import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef, type RefAttributes } from "react"
import {
  AccessibilityInfo,
  Animated,
  Easing,
  PlatformColor,
  Pressable,
  type PressableProps,
  type View,
} from "react-native"

import { Switch } from "../../.."

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})
const part = (name: string) => screen.getByTestId(`switch-${name}`, { includeHiddenElements: true })

it("renders the original switch root/ref/events and owned slots after style without changing controlled ownership", async () => {
  const ref = createRef<View>()
  const trace: string[] = []
  const changed = jest.fn()
  const pressed = jest.fn()
  const renderer = jest.fn((props: PressableProps & RefAttributes<View>, state: unknown) => {
    trace.push("render")
    return <Pressable {...props} testID="rendered-switch" accessibilityHint={JSON.stringify(state)} />
  })
  const adapter = { render: renderer }
  const view = await render(
    <Switch
      {...adapter}
      ref={ref}
      aria-label="Setting"
      isSelected={false}
      onChange={changed}
      onPress={pressed}
      leftContent="Before"
      rightContent="After"
      showOnOffIcons
      iconOff={null}
      style={({ defaultStyle }) => {
        trace.push("style")
        return defaultStyle
      }}
    />,
  )
  expect(renderer).toHaveBeenCalled()
  expect(trace.slice(0, 2)).toEqual(["style", "render"])
  expect(renderer.mock.calls.at(-1)?.[0].ref).toBe(ref)
  const original = ref.current
  expect(original).not.toBeNull()
  expect(screen.getByText("Before")).toBeOnTheScreen()
  expect(screen.getByText("After")).toBeOnTheScreen()
  expect(screen.queryByText("×", { includeHiddenElements: true })).toBeNull()
  const event = { nativeEvent: { timestamp: 10 } }
  await fireEvent(screen.getByRole("switch"), "press", event)
  expect(changed.mock.calls).toEqual([[true]])
  expect(pressed.mock.calls[0][0]).toBe(event)
  expect(screen.getByRole("switch")).not.toBeChecked()
  await view.rerender(
    <Switch {...adapter} ref={ref} aria-label="Setting" isSelected isReadOnly onChange={changed} onPress={pressed} />,
  )
  expect(ref.current).toBe(original)
  expect(renderer.mock.calls.at(-1)?.[1]).toMatchObject({ isSelected: true, isReadOnly: true })
  await fireEvent(screen.getByRole("switch"), "press", { nativeEvent: { timestamp: 11 } })
  expect(changed).toHaveBeenCalledTimes(1)
  await view.unmount()
  expect(ref.current).toBeNull()
})

it("keeps distinct250ms colour and225ms thumb clocks with canonical easing and immediate outline/shadow geometry", async () => {
  const timing = jest.spyOn(Animated, "timing")
  const view = await render(
    <Switch aria-label="Setting" isSelected={false} trackColor="#000000" indicatorColor="#000000" />,
  )
  timing.mockClear()
  await view.rerender(
    <Switch
      aria-label="Setting"
      isSelected
      trackColor="#ffffff"
      indicatorColor="#ffffff"
      showBorder
      geometry="rounded"
      raised={false}
    />,
  )
  expect(part("track")).toHaveStyle({ backgroundColor: "#000000", borderWidth: 1.5, borderRadius: 5 })
  expect(part("indicator")).toHaveStyle({ left: 0, backgroundColor: "#000000", borderRadius: 5 })
  expect(part("indicator").props.style.shadowOpacity).toBeUndefined()
  expect(timing.mock.calls.some(([, config]) => config.duration === 225)).toBe(true)
  expect(timing.mock.calls.some(([, config]) => config.duration === 250)).toBe(true)
  for (const [, config] of timing.mock.calls) {
    expect([225, 250]).toContain(config.duration)
    for (const t of [0.1, 0.25, 0.5, 0.75, 0.9])
      expect(config.easing?.(t)).toBeCloseTo(Easing.bezier(0.42, 0, 0.58, 1)(t), 6)
  }
  await fireEvent(screen.getByRole("switch"), "focus", { nativeEvent: { timestamp: 1 } })
  expect(part("indicator")).toHaveStyle({ outlineWidth: 2, outlineOffset: 3.5 })
  await act(() => jest.advanceTimersByTime(100))
  expect(part("indicator").props.style.left).toBeGreaterThan(0)
  expect(part("track").props.style.backgroundColor).toMatch(/^rgba\(/)
  await act(() => jest.advanceTimersByTime(175))
  expect(part("track")).toHaveStyle({ backgroundColor: "#ffffff" })
  expect(part("indicator")).toHaveStyle({ backgroundColor: "#ffffff", left: 18 })
})

it("retargets measured custom bounds from current position and clamps owned movement after a smaller layout", async () => {
  const view = await render(
    <Switch
      aria-label="Setting"
      isSelected={false}
      customTrackStyles={{ width: 90, height: 25 }}
      customIndicatorStyles={{ width: 17 }}
    />,
  )
  await fireEvent(part("track-content"), "layout", { nativeEvent: { layout: { width: 90, height: 25 } } })
  await fireEvent(part("indicator"), "layout", { nativeEvent: { layout: { width: 17, height: 25 } } })
  await view.rerender(
    <Switch
      aria-label="Setting"
      isSelected
      customTrackStyles={{ width: 90, height: 25 }}
      customIndicatorStyles={{ width: 17 }}
    />,
  )
  expect(part("indicator").props.style.left).toBe(0)
  await act(() => jest.advanceTimersByTime(275))
  expect(part("indicator")).toHaveStyle({ left: 73, width: 17, height: 25 })
  await view.rerender(
    <Switch
      aria-label="Setting"
      isSelected={false}
      customTrackStyles={{ width: 90, height: 25 }}
      customIndicatorStyles={{ width: 17 }}
    />,
  )
  await act(() => jest.advanceTimersByTime(80))
  const current = part("indicator").props.style.left
  expect(current).toBeGreaterThan(0)
  expect(current).toBeLessThan(73)
  await view.rerender(
    <Switch
      aria-label="Setting"
      isSelected
      customTrackStyles={{ width: 90, height: 25 }}
      customIndicatorStyles={{ width: 17 }}
    />,
  )
  expect(part("indicator").props.style.left).toBe(current)
  await fireEvent(part("track-content"), "layout", { nativeEvent: { layout: { width: 20, height: 25 } } })
  expect(part("indicator").props.style.left).toBeLessThanOrEqual(3)
  await act(() => jest.advanceTimersByTime(275))
  expect(part("indicator").props.style.left).toBe(3)
})

it("retains explicit authored positions/opaque colours and follows live Reduce Motion with owned cleanup", async () => {
  const events = jest.spyOn(AccessibilityInfo, "addEventListener")
  const animate = Animated.timing
  const stops: Array<jest.SpyInstance> = []
  const timing = jest.spyOn(Animated, "timing").mockImplementation((value, config) => {
    const animation = animate(value, config)
    stops.push(jest.spyOn(animation, "stop"))
    return animation
  })
  const view = await render(
    <Switch aria-label="Setting" isSelected={false} trackColor="#000000" customIndicatorStyles={{ left: -4 }} />,
  )
  const color = PlatformColor("native-switch-track")
  await view.rerender(
    <Switch aria-label="Setting" isSelected trackColor={color} customIndicatorStyles={{ left: -4 }} />,
  )
  expect(part("track").props.style.backgroundColor).toBe(color)
  expect(part("indicator").props.style.left).toBe(-4)
  await view.rerender(<Switch aria-label="Setting" isSelected={false} trackColor="#000000" />)
  await view.rerender(<Switch aria-label="Setting" isSelected trackColor="#ffffff" />)
  await act(() => jest.advanceTimersByTime(80))
  const calls = events.mock.calls as unknown as Array<[string, (value: boolean) => void]>
  const callbacks = calls.filter(([name]) => name === "reduceMotionChanged").map(([, callback]) => callback)
  expect(callbacks.length).toBeGreaterThan(0)
  await act(() => callbacks.forEach((callback) => callback(true)))
  expect(part("track")).toHaveStyle({ backgroundColor: "#ffffff" })
  expect(part("indicator").props.style.left).toBe(15)
  await view.unmount()
  for (const stop of stops) expect(stop).toHaveBeenCalled()
  const last = timing.mock.calls.length
  await act(() => {
    callbacks.forEach((callback) => callback(false))
    jest.advanceTimersByTime(300)
  })
  expect(timing).toHaveBeenCalledTimes(last)
})
