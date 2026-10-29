import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef, type RefAttributes } from "react"
import { AccessibilityInfo, Animated, Easing, processColor, StyleSheet, type View } from "react-native"

import { Button, NativeFocusView, Text, type TNativeButtonChildrenState, type TNativeFocusViewProps } from "../../.."

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

it("passes the original focus host props, ref, children and current state through its inherited renderer", async () => {
  const ref = createRef<View>()
  const onLayout = jest.fn()
  const renderer = jest.fn((props: TNativeFocusViewProps & RefAttributes<View>, state: unknown) => (
    <NativeFocusView {...props} testID="rendered-button" accessibilityHint={JSON.stringify(state)} />
  ))
  const adapter = { render: renderer }
  const view = await render(
    <Button {...adapter} ref={ref} onLayout={onLayout}>
      Original content
    </Button>,
  )
  expect(renderer).toHaveBeenCalled()
  const original = ref.current
  expect(original).not.toBeNull()
  expect(renderer.mock.calls.at(-1)?.[0].ref).toBeDefined()
  expect(screen.getByRole("button")).toBe(screen.getByTestId("rendered-button"))
  expect(screen.getByText("Original content")).toBeOnTheScreen()
  expect(renderer.mock.calls.at(-1)?.[1]).toMatchObject({ isDisabled: false, isPending: false })
  await view.rerender(
    <Button {...adapter} ref={ref} isPending onLayout={onLayout}>
      Updated content
    </Button>,
  )
  expect(ref.current).toBe(original)
  expect(renderer.mock.calls.at(-1)?.[1]).toMatchObject({ isDisabled: false, isPending: true })
  const event = { nativeEvent: { layout: { x: 1, y: 2, width: 80, height: 44 } } }
  await fireEvent(screen.getByRole("button"), "layout", event)
  expect(onLayout.mock.calls).toEqual([[event]])
  expect(onLayout.mock.calls[0][0]).toBe(event)
  await view.unmount()
  expect(ref.current).toBeNull()
})

it("retains canonical250ms color and450ms shadow clocks from current native paint", async () => {
  const timing = jest.spyOn(Animated, "timing")
  const view = await render(
    <Button colorMode="outline" color="#000000" raised={false} style={{ backgroundColor: "#000000" }}>
      Paint
    </Button>,
  )
  timing.mockClear()
  await view.rerender(
    <Button colorMode="outline" color="#ffffff" raised style={{ backgroundColor: "#ffffff" }}>
      Paint
    </Button>,
  )
  const colors = timing.mock.calls.filter(([, config]) => config.duration === 250)
  const shadows = timing.mock.calls.filter(([, config]) => config.duration === 450)
  expect(colors.length).toBeGreaterThanOrEqual(3)
  expect(shadows.length).toBeGreaterThan(0)
  for (const [, config] of [...colors, ...shadows]) {
    for (const fraction of [0.125, 0.25, 0.5, 0.75, 0.875])
      expect(config.easing?.(fraction)).toBeCloseTo(Easing.bezier(0.42, 0, 0.58, 1)(fraction), 6)
  }
  const style = () => StyleSheet.flatten(screen.getByRole("button").props.style)
  expect(processColor(style().backgroundColor)).toBe(processColor("#000000"))
  await act(() => jest.advanceTimersByTime(125))
  expect(processColor(style().backgroundColor)).not.toBe(processColor("#000000"))
  expect(processColor(style().backgroundColor)).not.toBe(processColor("#ffffff"))
  await act(() => jest.advanceTimersByTime(400))
  expect(processColor(style().backgroundColor)).toBe(processColor("#ffffff"))
  expect(style().shadowOpacity).toBeCloseTo(0.24)
  const stops = timing.mock.results.map(({ value }) => jest.spyOn(value as Animated.CompositeAnimation, "stop"))
  await view.unmount()
  for (const stop of stops) expect(stop).toHaveBeenCalled()
})

it("interrupts from the current paint, follows live Reduce Motion and retires retained callbacks", async () => {
  const events = jest.spyOn(AccessibilityInfo, "addEventListener")
  const timing = jest.spyOn(Animated, "timing")
  const view = await render(<Button style={{ backgroundColor: "#000000" }}>Motion</Button>)
  await view.rerender(<Button style={{ backgroundColor: "#ffffff" }}>Motion</Button>)
  await act(() => jest.advanceTimersByTime(125))
  const currentPaint = processColor(StyleSheet.flatten(screen.getByRole("button").props.style).backgroundColor)
  expect(currentPaint).not.toBe(processColor("#000000"))
  expect(currentPaint).not.toBe(processColor("#ffffff"))
  await view.rerender(<Button style={{ backgroundColor: "#ff0000" }}>Motion</Button>)
  expect(processColor(StyleSheet.flatten(screen.getByRole("button").props.style).backgroundColor)).toBe(currentPaint)
  const calls = events.mock.calls as unknown as [event: string, callback: (value: boolean) => void][]
  const callbacks = calls.filter(([event]) => event === "reduceMotionChanged").map(([, callback]) => callback)
  expect(callbacks.length).toBeGreaterThan(0)
  await act(() => callbacks.forEach((callback) => callback(true)))
  expect(screen.getByRole("button")).toHaveStyle({ backgroundColor: "#ff0000" })
  await view.unmount()
  const finalAnimations = timing.mock.calls.length
  await act(() => {
    callbacks.forEach((callback) => callback(false))
    jest.advanceTimersByTime(500)
  })
  expect(timing).toHaveBeenCalledTimes(finalAnimations)
})

it("keeps callback foreground authoritative while inherited and authored text follow their own paint clocks", async () => {
  const states: TNativeButtonChildrenState[] = []
  const children = (state: TNativeButtonChildrenState) => {
    states.push(state)
    return <Text color={state.foregroundColor}>Authored text</Text>
  }
  const view = await render(
    <Button colorMode="outline" color="#000000">
      {children}
    </Button>,
  )
  await view.rerender(
    <Button colorMode="outline" color="#ffffff">
      {children}
    </Button>,
  )
  await act(() => jest.advanceTimersByTime(125))
  expect(states.at(-1)?.foregroundColor).toBe("#ffffff")
  const color = () => processColor(StyleSheet.flatten(screen.getByText("Authored text").props.style).color)
  expect(color()).not.toBe(processColor("#000000"))
  expect(color()).not.toBe(processColor("#ffffff"))
  await act(() => jest.advanceTimersByTime(150))
  expect(color()).toBe(processColor("#ffffff"))
})
