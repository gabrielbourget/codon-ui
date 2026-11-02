import { act, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { AccessibilityInfo, Animated, Easing, PlatformColor, StyleSheet, type View } from "react-native"

import { ToggleButton } from "../ToggleButton"

const root = () => screen.getByRole("button")
const paint = () => StyleSheet.flatten(root().props.style)
const foreground = () => StyleSheet.flatten(screen.getByText("Owned phrase").props.style).color
beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

it("owns exact250ms root and phrase color clocks after authoritative echo while veto and semantic callbacks remain immediate", async () => {
  const ref = createRef<View>(),
    trace: unknown[] = [],
    timing = jest.spyOn(Animated, "timing")
  const node = (selected: boolean) => (
    <ToggleButton
      ref={ref}
      isSelected={selected}
      onChange={(next) => trace.push(next)}
      onPress={(event) => trace.push(event)}
      raised={selected}
      width={selected ? 0 : 100}
      style={{
        backgroundColor: selected ? "#ffffff" : "#000000",
        borderColor: selected ? "#ffffff" : "#000000",
        color: selected ? "#ffffff" : "#000000",
        opacity: selected ? 0.5 : 1,
      }}
    >
      Owned phrase
    </ToggleButton>
  )
  await render(node(false))
  const original = ref.current
  timing.mockClear()
  const activation = {
    persist: jest.fn(),
    nativeEvent: {
      kind: "activation",
      ownerId: root().props.ownerId,
      target: 17,
      source: "ios-accessibility-activate",
      observedAt: 0,
      activationId: 1,
      scopeOwnerId: "",
      windowId: "window",
      epoch: 0,
    },
  }
  await act(() => root().props.onNativeActivation(activation))
  expect(trace).toEqual([true, activation])
  expect(trace[1]).toBe(activation)
  expect(root().props.accessibilityState.checked).toBe(false)
  expect(timing).not.toHaveBeenCalled()
  await screen.rerender(node(true))
  expect(root().props.accessibilityState.checked).toBe(true)
  expect(paint()).toMatchObject({
    backgroundColor: "#000000",
    borderColor: "#000000",
    opacity: 0.5,
    width: 0,
    shadowOpacity: 0.24,
  })
  expect(foreground()).toBe("#000000")
  expect(timing).toHaveBeenCalledTimes(3)
  for (const [, config] of timing.mock.calls) {
    expect(config.duration).toBe(250)
    for (const t of [0.1, 0.25, 0.5, 0.75, 0.9])
      expect(config.easing?.(t)).toBeCloseTo(Easing.bezier(0.42, 0, 0.58, 1)(t), 6)
  }
  await act(() => jest.advanceTimersByTime(100))
  expect(paint().backgroundColor).toMatch(/^rgba\(/)
  expect(paint().borderColor).toBe(paint().backgroundColor)
  expect(foreground()).toBe(paint().backgroundColor)
  await act(() => jest.advanceTimersByTime(200))
  expect(paint()).toMatchObject({ backgroundColor: "#ffffff", borderColor: "#ffffff" })
  expect(foreground()).toBe("#ffffff")
  expect(ref.current).toBe(original)
  expect(trace).toHaveLength(2)
})

it("retargets each color from its current paint while preserving final style and one original root", async () => {
  const ref = createRef<View>(),
    changed = jest.fn()
  const node = (color: string) => (
    <ToggleButton
      ref={ref}
      isSelected={false}
      onChange={changed}
      customStyles={{ backgroundColor: "#654321", marginTop: 3 }}
      style={({ defaultStyle }) => {
        expect(defaultStyle.backgroundColor).toBe("#654321")
        return { backgroundColor: color, borderColor: color, color }
      }}
    >
      Owned phrase
    </ToggleButton>
  )
  await render(node("#000000"))
  const original = ref.current
  await screen.rerender(node("#ffffff"))
  await act(() => jest.advanceTimersByTime(80))
  const current = paint().backgroundColor
  expect(current).toMatch(/^rgba\(/)
  await screen.rerender(node("#abcdef"))
  expect(paint().backgroundColor).toBe(current)
  expect(foreground()).toBe(current)
  await act(() => jest.advanceTimersByTime(100))
  expect(paint().backgroundColor).not.toBe("#abcdef")
  await act(() => jest.advanceTimersByTime(200))
  expect(paint()).toMatchObject({ backgroundColor: "#abcdef", borderColor: "#abcdef", marginTop: 3 })
  expect(foreground()).toBe("#abcdef")
  expect(ref.current).toBe(original)
  expect(changed).not.toHaveBeenCalled()
})

it("retires paint on Reduce Motion changes, opaque colors and teardown without fabricating owner requests", async () => {
  const events = jest.spyOn(AccessibilityInfo, "addEventListener"),
    ref = createRef<View>(),
    changed = jest.fn()
  const node = (opaque = false, white = false) => (
    <ToggleButton
      ref={ref}
      isSelected={false}
      onChange={changed}
      style={{
        backgroundColor: opaque ? PlatformColor("toggle-surface") : white ? "#ffffff" : "#000000",
        borderColor: opaque ? PlatformColor("toggle-border") : white ? "#ffffff" : "#000000",
        color: opaque ? PlatformColor("toggle-foreground") : white ? "#ffffff" : "#000000",
      }}
    >
      Owned phrase
    </ToggleButton>
  )
  await render(node())
  const original = ref.current
  await screen.rerender(node(false, true))
  await act(() => jest.advanceTimersByTime(80))
  expect(paint().backgroundColor).toMatch(/^rgba\(/)
  const callbacks = (events.mock.calls as unknown as Array<[string, (value: boolean) => void]>)
    .filter(([name]) => name === "reduceMotionChanged")
    .map(([, cb]) => cb)
  await act(() => callbacks.forEach((cb) => cb(true)))
  expect(paint().backgroundColor).toBe("#ffffff")
  expect(foreground()).toBe("#ffffff")
  await screen.rerender(node(true))
  expect(paint().backgroundColor).toEqual(PlatformColor("toggle-surface"))
  expect(paint().borderColor).toEqual(PlatformColor("toggle-border"))
  expect(foreground()).toEqual(PlatformColor("toggle-foreground"))
  expect(ref.current).toBe(original)
  await screen.unmount()
  await act(() => {
    callbacks.forEach((cb) => cb(false))
    jest.advanceTimersByTime(300)
  })
  expect(ref.current).toBeNull()
  expect(changed).not.toHaveBeenCalled()
})
