import { act, render, screen } from "@testing-library/react-native"
import { AccessibilityInfo, Animated, PlatformColor, StyleSheet, processColor, type ViewStyle } from "react-native"

import { NativeThemeProvider, Tag, type NativeThemeTransition } from "../../.."

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})
it("retains current authored shadow paint at the start of the provider boxShadow transition", async () => {
  const shadow = (offsetX: number) => [{ offsetX, offsetY: 0, blurRadius: 4, color: "#000000" }]
  const node = (offsetX: number) => (
    <NativeThemeProvider overrides={{ transitions: { boxShadow: 1000 } }}>
      <Tag style={{ boxShadow: shadow(offsetX) }}>Authored shadow</Tag>
    </NativeThemeProvider>
  )
  const result = await render(node(0))
  await result.rerender(node(20))
  expect(screen.getByTestId("tag")).toHaveStyle({ boxShadow: shadow(0) })
  await act(() => jest.advanceTimersByTime(1100))
  expect(screen.getByTestId("tag")).toHaveStyle({ boxShadow: shadow(20) })
})

const node = (
  boxShadow: ViewStyle["boxShadow"],
  boxShadowTiming: NativeThemeTransition = { duration: 1000, easing: "linear" },
) => (
  <NativeThemeProvider overrides={{ transitions: { boxShadow: boxShadowTiming } }}>
    <Tag style={{ boxShadow }}>Shadow list</Tag>
  </NativeThemeProvider>
)
const paint = () =>
  StyleSheet.flatten(screen.getByTestId("tag").props.style).boxShadow as { offsetX: number; color?: string }[]

it("pads authored shadow lists and interpolates native string/array fields and alpha", async () => {
  const result = await render(node("0px 0px 4px red"))
  const destination = [
    { offsetX: 20, offsetY: 0, blurRadius: 8, color: "blue" },
    { offsetX: 40, offsetY: 0, blurRadius: 4, color: "green" },
  ]
  await result.rerender(node(destination))
  await act(() => jest.advanceTimersByTime(500))
  expect(paint()).toHaveLength(2)
  expect(paint()[0].offsetX).toBeGreaterThan(9)
  expect(paint()[0].offsetX).toBeLessThan(11)
  expect(paint()[1].offsetX).toBeGreaterThan(19)
  expect(paint()[1].offsetX).toBeLessThan(21)
  const color = processColor(paint()[1].color)
  expect(typeof color).toBe("number")
  expect((color as number) >>> 24).toBeGreaterThan(115)
  expect((color as number) >>> 24).toBeLessThan(140)
  await act(() => jest.advanceTimersByTime(600))
  expect(screen.getByTestId("tag")).toHaveStyle({ boxShadow: destination })
})

it("retargets authored shadows and live timing from the current paint without restarting equivalent styles", async () => {
  const shadow = (offsetX: number) => [{ offsetX, offsetY: 0, color: "red" }]
  const timing = jest.spyOn(Animated, "timing")
  const result = await render(node(shadow(0)))
  await result.rerender(node(shadow(20)))
  await act(() => jest.advanceTimersByTime(400))
  const before = paint()
  const calls = timing.mock.calls.length
  await result.rerender(node(shadow(20)))
  expect(timing).toHaveBeenCalledTimes(calls)
  expect(paint()).toEqual(before)
  await result.rerender(node(shadow(40), { duration: 2000, easing: "linear" }))
  expect(paint()).toEqual(before)
  await act(() => jest.advanceTimersByTime(2100))
  expect(screen.getByTestId("tag")).toHaveStyle({ boxShadow: shadow(40) })
})

it("removes authored shadows through transparent list padding and preserves zero-duration endpoints", async () => {
  const result = await render(node([{ offsetX: 20, offsetY: 0, color: "red" }]))
  await result.rerender(node(undefined))
  await act(() => jest.advanceTimersByTime(500))
  expect(paint()).toHaveLength(1)
  expect(paint()[0].offsetX).toBeGreaterThan(9)
  expect(paint()[0].offsetX).toBeLessThan(11)
  await act(() => jest.advanceTimersByTime(600))
  expect(StyleSheet.flatten(screen.getByTestId("tag").props.style).boxShadow).toBeUndefined()
  const target = [{ offsetX: 30, offsetY: 0, color: "blue" }]
  await result.rerender(node(target))
  expect(StyleSheet.flatten(screen.getByTestId("tag").props.style).boxShadow).toBeUndefined()
  await act(() => jest.advanceTimersByTime(1100))
  expect(screen.getByTestId("tag")).toHaveStyle({ boxShadow: target })
  const immediate = [{ offsetX: 40, offsetY: 0, color: "green" }]
  await result.rerender(node(immediate, 0))
  expect(screen.getByTestId("tag")).toHaveStyle({ boxShadow: immediate })
})

it("keeps incompatible inset shadows and opaque native colors discrete without inventing channels", async () => {
  const timing = jest.spyOn(Animated, "timing")
  const result = await render(node([{ offsetX: 0, offsetY: 0, color: "red" }]))
  const inset = [{ offsetX: 20, offsetY: 0, color: "blue", inset: true }]
  await result.rerender(node(inset))
  expect(screen.getByTestId("tag")).toHaveStyle({ boxShadow: inset })
  const opaque = [{ offsetX: 30, offsetY: 0, color: PlatformColor("systemBlueColor") }]
  await result.rerender(node(opaque))
  expect(screen.getByTestId("tag")).toHaveStyle({ boxShadow: opaque })
  expect(timing).not.toHaveBeenCalled()
})

it("finishes authored shadows on live Reduce Motion and retires replacement/unmount completions", async () => {
  const subscriptions = jest.spyOn(AccessibilityInfo, "addEventListener")
  const shadow = (offsetX: number) => [{ offsetX, offsetY: 0, color: "red" }]
  const result = await render(node(shadow(0)))
  await result.rerender(node(shadow(20)))
  await act(() => jest.advanceTimersByTime(300))
  const callbacks = subscriptions.mock.calls
    .filter(([name]) => String(name) === "reduceMotionChanged")
    .map(([, callback]) => callback as unknown as (value: boolean) => void)
  await act(() => callbacks.forEach((callback) => callback(true)))
  expect(screen.getByTestId("tag")).toHaveStyle({ boxShadow: shadow(20) })
  await result.unmount()
  const finishes: ((result: { finished: boolean }) => void)[] = []
  jest.spyOn(Animated, "timing").mockImplementation(() => ({
    start: (callback) => {
      if (callback) finishes.push(callback)
    },
    stop: jest.fn(),
    reset: jest.fn(),
  }))
  const second = await render(node(shadow(0)))
  await second.rerender(node(shadow(20)))
  const stale = finishes[0]
  expect(stale).toBeDefined()
  await second.rerender(node(shadow(40)))
  await act(() => stale({ finished: true }))
  expect(screen.getByTestId("tag")).toHaveStyle({ boxShadow: shadow(0) })
  await second.unmount()
  await act(() => finishes.forEach((callback) => callback({ finished: true })))
})

it("forwards equivalent authored representations and explicit undefined without retaining a stale shadow override", async () => {
  const result = await render(node("none"))
  await result.rerender(node(undefined))
  expect(StyleSheet.flatten(screen.getByTestId("tag").props.style).boxShadow).toBeUndefined()
  await result.rerender(node("0px 0px red", 0))
  const equivalent = [{ offsetX: 0, offsetY: 0, color: "#ff0000" }]
  await result.rerender(node(equivalent))
  expect(screen.getByTestId("tag")).toHaveStyle({ boxShadow: equivalent })
})

it("keeps invalid colors and filter shadow colors rejected when the no-shadow keyword is allowed", async () => {
  await expect(render(node([{ offsetX: 0, offsetY: 0, color: "not-a-color" }]))).rejects.toThrow(/Tag:.*color/)
  await expect(
    render(<Tag style={{ boxShadow: "none", backgroundColor: "not-a-color" }}>Invalid background</Tag>),
  ).rejects.toThrow(/Tag:.*backgroundColor/)
  await expect(
    render(<Tag style={{ boxShadow: "none", filter: "drop-shadow(none)" }}>Invalid filter</Tag>),
  ).rejects.toThrow(/Tag:.*filter/)
})
