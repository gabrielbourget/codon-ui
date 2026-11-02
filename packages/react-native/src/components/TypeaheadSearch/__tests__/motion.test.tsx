import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { AccessibilityInfo, Animated, Easing, PlatformColor, processColor, type TextInput } from "react-native"

import { NativeThemeProvider, TypeaheadSearch } from "../../.."

beforeEach(() => {
  const targets = new WeakMap<object, number>()
  let nextTarget = 100
  jest.spyOn(jest.requireActual("react-native"), "findNodeHandle").mockImplementation((target: unknown) => {
    if (!target || typeof target !== "object") return null
    if (!targets.has(target)) targets.set(target, ++nextTarget)
    return targets.get(target)!
  })
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})
const query = { inputValue: "held", onInputChange: jest.fn() }
const row = () => screen.getByTestId("typeahead-search-input-row")
const input = () => screen.getByTestId("typeahead-search-input")

it("paints parent border for250ms and the focus shadow geometry for450ms without replacing its editor", async () => {
  const ref = createRef<TextInput>(),
    timing = jest.spyOn(Animated, "timing")
  await render(
    <NativeThemeProvider overrides={{ colors: { controlBorder: "#000000", focusRing: "#ffffff" } }}>
      <TypeaheadSearch {...query} inputRef={ref} />
    </NativeThemeProvider>,
  )
  const original = ref.current
  timing.mockClear()
  await fireEvent(input(), "focus", { nativeEvent: { target: 17 } })
  expect(processColor(row().props.style.borderColor)).toBe(processColor("#000000"))
  expect(row().props.style.boxShadow).toEqual([])
  const configs = timing.mock.calls.map((call) => call[1])
  expect(configs.some((config) => config.duration === 250)).toBe(true)
  expect(configs.some((config) => config.duration === 450)).toBe(true)
  for (const config of configs.filter((config) => config.duration === 250 || config.duration === 450))
    for (const fraction of [0.1, 0.25, 0.5, 0.75, 0.9])
      expect(config.easing?.(fraction)).toBeCloseTo(Easing.bezier(0.42, 0, 0.58, 1)(fraction), 6)
  await act(() => jest.advanceTimersByTime(125))
  expect(row().props.style.borderColor).toMatch(/^rgba\(/)
  expect(row().props.style.boxShadow[0].spreadDistance).toBeGreaterThan(0)
  expect(row().props.style.boxShadow[0].spreadDistance).toBeLessThan(1.5)
  await act(() => jest.advanceTimersByTime(150))
  expect(processColor(row().props.style.borderColor)).toBe(processColor("#ffffff"))
  expect(row().props.style.boxShadow[0].spreadDistance).toBeLessThan(1.5)
  await act(() => jest.advanceTimersByTime(200))
  expect(row().props.style.boxShadow).toEqual([
    { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1.5, color: "#ffffff" },
  ])
  expect(row().props.style.outlineWidth).toBeUndefined()
  expect(ref.current).toBe(original)
  expect(input()).toHaveStyle({ borderWidth: 0, outlineWidth: 0, boxShadow: [] })
})

it("retargets from current shadow paint, preserves authored zeros/opaque color and cleans up", async () => {
  const listeners = jest.spyOn(AccessibilityInfo, "addEventListener"),
    timing = jest.spyOn(Animated, "timing")
  const view = await render(<TypeaheadSearch {...query} />)
  await fireEvent(input(), "focus", { nativeEvent: { target: 17 } })
  await act(() => jest.advanceTimersByTime(225))
  const paint = row().props.style.boxShadow
  await fireEvent(input(), "blur", { nativeEvent: { target: 17 } })
  expect(row().props.style.boxShadow).toEqual(paint)
  await act(() => jest.advanceTimersByTime(500))
  expect(row().props.style.boxShadow).toEqual([])
  const color = PlatformColor("labelColor")
  await view.rerender(
    <TypeaheadSearch {...query} customInputRowStyles={{ borderColor: color, boxShadow: [], outlineWidth: 0 }} />,
  )
  await fireEvent(input(), "focus", { nativeEvent: { target: 17 } })
  expect(row()).toHaveStyle({ borderColor: color, boxShadow: [], outlineWidth: 0 })
  await view.rerender(<TypeaheadSearch {...query} />)
  const stop = jest.spyOn(timing.mock.results.at(-1)!.value, "stop")
  await act(() =>
    (listeners.mock.calls as unknown as [string, (value: boolean) => void][])
      .filter(([name]) => name === "reduceMotionChanged")
      .forEach(([, callback]) => callback(true)),
  )
  expect(row().props.style.boxShadow[0].spreadDistance).toBe(1.5)
  await view.unmount()
  expect(stop).toHaveBeenCalled()
})

it("transitions result background for250ms while keeping selection independent of paint", async () => {
  const selected = jest.fn()
  await render(<TypeaheadSearch {...query} items={[{ id: 0, name: "Alpha" }]} onSelectionChange={selected} />)
  const result = screen.getByRole("radio", { name: "Alpha" })
  await fireEvent.press(result)
  expect(selected.mock.calls).toEqual([["0"]])
  expect(processColor(result.props.style.backgroundColor)).toBe(0)
  await act(() => jest.advanceTimersByTime(125))
  expect(result.props.style.backgroundColor).toMatch(/^rgba\(/)
  await act(() => jest.advanceTimersByTime(150))
  expect(result.props.style.backgroundColor).not.toBe("transparent")
  expect(selected).toHaveBeenCalledTimes(1)
})

it("honors existing authored transition timing independently for border, shadow and result background", async () => {
  const timing = jest.spyOn(Animated, "timing")
  await render(
    <NativeThemeProvider
      overrides={{
        transitions: {
          borderColor: { duration: 80, delay: 10, easing: "linear" },
          boxShadow: { duration: 90, easing: "ease-in" },
          backgroundColor: { duration: 70, easing: "ease-out" },
        },
      }}
    >
      <TypeaheadSearch {...query} items={[{ name: "Alpha" }]} />
    </NativeThemeProvider>,
  )
  timing.mockClear()
  await fireEvent(input(), "focus", { nativeEvent: { target: 17 } })
  const configs = timing.mock.calls.map((call) => call[1])
  expect(configs).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ duration: 80, delay: 10 }),
      expect.objectContaining({ duration: 90 }),
    ]),
  )
  expect(configs.find((config) => config.duration === 80)!.easing!(0.25)).toBe(0.25)
  timing.mockClear()
  await fireEvent.press(screen.getByRole("radio", { name: "Alpha" }))
  expect(timing.mock.calls.map((call) => call[1].duration)).toContain(70)
})
