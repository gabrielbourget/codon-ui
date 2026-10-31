import { act, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { AccessibilityInfo, Animated, Easing, processColor, StyleSheet } from "react-native"

import { Counter, Link, NativeThemeProvider, Text, type TNativeTextRef } from "../../.."

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

const colorOf = (identity: string) => processColor(StyleSheet.flatten(screen.getByTestId(identity).props.style).color)

it("transitions the original Text color for250ms with canonical easing and interrupts at the current frame", async () => {
  const ref = createRef<TNativeTextRef>()
  const timing = jest.spyOn(Animated, "timing")
  const remove = jest.spyOn(Animated.Value.prototype, "removeListener")
  const view = await render(
    <Text ref={ref} color="black">
      Original
    </Text>,
  )
  const original = ref.current
  expect(original).not.toBeNull()
  await view.rerender(
    <Text ref={ref} color="white">
      Original
    </Text>,
  )
  expect(ref.current).toBe(original)
  const transition = timing.mock.calls.at(-1)?.[1]
  expect(transition?.duration).toBe(250)
  const ease = Easing.bezier(0.42, 0, 0.58, 1)
  for (const fraction of [0.25, 0.5, 0.75]) expect(transition?.easing?.(fraction)).toBeCloseTo(ease(fraction), 6)
  await act(async () => jest.advanceTimersByTime(64))
  const current = colorOf("text") as number
  expect(current & 255).toBeGreaterThan(0)
  expect(current & 255).toBeLessThan(128)
  await view.rerender(
    <Text ref={ref} style={{ color: "red" }}>
      Original
    </Text>,
  )
  expect(colorOf("text")).toBe(current)
  await act(async () => jest.advanceTimersByTime(300))
  expect(colorOf("text")).toBe(processColor("red"))
  await view.unmount()
  expect(ref.current).toBeNull()
  expect(remove).toHaveBeenCalled()
})

it("inherits each original parent frame once while an explicitly colored child retains its own transition", async () => {
  const timing = jest.spyOn(Animated, "timing")
  const tree = (color: "black" | "white", child: "red" | "blue") => (
    <Text testID="parent" color={color}>
      <Text testID="inherited">Inherited</Text>
      <Text testID="authored" color={child}>
        Authored
      </Text>
    </Text>
  )
  const view = await render(tree("black", "red"))
  timing.mockClear()
  await view.rerender(tree("white", "blue"))
  expect(timing).toHaveBeenCalledTimes(2)
  for (const elapsed of [32, 64, 160]) {
    await act(async () => jest.advanceTimersByTime(elapsed))
    expect(colorOf("inherited")).toBe(colorOf("parent"))
  }
  expect(colorOf("authored")).toBe(processColor("blue"))
})

it("does not start a second Text clock for an already animated Link or Counter phrase", async () => {
  const timing = jest.spyOn(Animated, "timing")
  const tree = (color: "black" | "white") => (
    <>
      <Link href="https://example.com" color={color}>
        Link phrase
      </Link>
      <Counter value={0} style={{ color }} />
    </>
  )
  const view = await render(tree("black"))
  timing.mockClear()
  await view.rerender(tree("white"))
  expect(timing.mock.calls.map(([, options]) => options.duration).sort()).toEqual([125, 250, 250])
  await act(async () => jest.advanceTimersByTime(300))
  expect(colorOf("counter-value")).toBe(processColor("white"))
})

it("keeps mounted theme changes current and cancels color work on live Reduce Motion", async () => {
  const subscribe = jest.spyOn(AccessibilityInfo, "addEventListener")
  const tree = (mode: "light" | "dark") => (
    <NativeThemeProvider mode={mode}>
      <Text>Theme</Text>
    </NativeThemeProvider>
  )
  const view = await render(tree("light"))
  await view.rerender(tree("dark"))
  await act(async () => jest.advanceTimersByTime(32))
  expect(colorOf("text")).not.toBe(processColor("#ffffff"))
  const calls = subscribe.mock.calls as unknown as [string, (enabled: boolean) => void][]
  const listeners = calls.filter(([name]) => name === "reduceMotionChanged").map(([, listener]) => listener)
  expect(listeners.length).toBeGreaterThan(0)
  await act(async () => listeners.forEach((listener) => listener(true)))
  expect(screen.getByTestId("text")).toHaveStyle({ color: "#ffffff" })
  await view.unmount()
})
