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

import { Checkbox, CheckboxGroup, NativeThemeProvider } from "../../.."

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})
const hidden = { includeHiddenElements: true }

it("preserves Checkbox root/ref/native events and style-child-root order through group veto, echo and mixed state", async () => {
  const ref = createRef<View>()
  const trace: string[] = []
  const groupChange = jest.fn()
  const memberChange = jest.fn()
  const pressed = jest.fn()
  const renderer = jest.fn((props: PressableProps & RefAttributes<View>, state: unknown) => {
    trace.push("render")
    return <Pressable {...props} testID="rendered-checkbox" accessibilityHint={JSON.stringify(state)} />
  })
  const adapter = { render: renderer }
  const view = await render(
    <CheckboxGroup value={[]} onChange={groupChange}>
      <Checkbox
        {...adapter}
        aria-label="Choice"
        value="one"
        ref={ref}
        onChange={memberChange}
        onPress={pressed}
        style={({ defaultStyle }) => {
          trace.push("style")
          return defaultStyle
        }}
      >
        {({ isSelected }) => {
          trace.push("children")
          return isSelected ? "Chosen" : "Choice"
        }}
      </Checkbox>
    </CheckboxGroup>,
  )
  expect(renderer).toHaveBeenCalled()
  expect(trace.slice(0, 3)).toEqual(["style", "children", "render"])
  const original = ref.current
  expect(original).not.toBeNull()
  expect(renderer.mock.calls.at(-1)?.[0].ref).toBe(ref)
  const event = { nativeEvent: { timestamp: 10 } }
  await fireEvent(screen.getByRole("checkbox"), "press", event)
  expect(groupChange.mock.calls).toEqual([[["one"]]])
  expect(memberChange.mock.calls).toEqual([[true]])
  expect(pressed.mock.calls[0][0]).toBe(event)
  expect(screen.getByRole("checkbox")).not.toBeChecked()
  await view.rerender(
    <CheckboxGroup value={["one"]} isReadOnly onChange={groupChange}>
      <Checkbox
        {...adapter}
        aria-label="Choice"
        value="one"
        ref={ref}
        isIndeterminate
        onChange={memberChange}
        onPress={pressed}
      >
        Chosen
      </Checkbox>
    </CheckboxGroup>,
  )
  expect(ref.current).toBe(original)
  expect(renderer.mock.calls.at(-1)?.[1]).toMatchObject({ isSelected: true, isIndeterminate: true, isReadOnly: true })
  expect(screen.getByRole("checkbox").props.accessibilityState.checked).toBe("mixed")
  await fireEvent(screen.getByRole("checkbox"), "press", { nativeEvent: { timestamp: 11 } })
  expect(groupChange).toHaveBeenCalledTimes(1)
  expect(pressed).toHaveBeenCalledTimes(1)
  await view.unmount()
  expect(ref.current).toBeNull()
})

it("uses175ms ease-in-out for mark dimensions, radius, background and raised shadow while border and outline stay immediate", async () => {
  const timing = jest.spyOn(Animated, "timing")
  const view = await render(<Checkbox aria-label="Choice" isSelected showIcon={false} color="#000000" />)
  timing.mockClear()
  await view.rerender(
    <Checkbox
      aria-label="Choice"
      isSelected
      showIcon={false}
      color="#ffffff"
      geometry="round"
      width={40}
      height={30}
      raised
    />,
  )
  const mark = () => screen.getByTestId("checkbox-shape", hidden)
  expect(mark()).toHaveStyle({
    width: 20,
    height: 20,
    borderRadius: 5,
    backgroundColor: "#000000",
    borderColor: "#ffffff",
    shadowOpacity: 0,
    cursor: "pointer",
  })
  expect(timing.mock.calls.length).toBeGreaterThanOrEqual(5)
  for (const [, config] of timing.mock.calls) {
    expect(config.duration).toBe(175)
    for (const t of [0.1, 0.25, 0.5, 0.75, 0.9])
      expect(config.easing?.(t)).toBeCloseTo(Easing.bezier(0.42, 0, 0.58, 1)(t), 6)
  }
  await fireEvent(screen.getByRole("checkbox"), "focus", { nativeEvent: { timestamp: 1 } })
  expect(mark()).toHaveStyle({ outlineWidth: 1.5, outlineOffset: 1.5 })
  await act(() => jest.advanceTimersByTime(80))
  expect(mark().props.style.width).toBeGreaterThan(20)
  expect(mark().props.style.width).toBeLessThan(40)
  await act(() => jest.advanceTimersByTime(125))
  expect(mark()).toHaveStyle({
    width: 40,
    height: 30,
    borderRadius: 10000,
    backgroundColor: "#ffffff",
    shadowOpacity: 0.24,
    shadowRadius: 3,
    elevation: 2,
  })
})

it("keeps the independent250ms ease check-ink clock through selection and reversed deselection", async () => {
  const timing = jest.spyOn(Animated, "timing")
  const view = await render(<Checkbox aria-label="Choice" isSelected={false} />)
  timing.mockClear()
  await view.rerender(<Checkbox aria-label="Choice" isSelected />)
  expect(screen.getByRole("checkbox")).toBeChecked()
  expect(screen.getByTestId("checkbox-ink", hidden)).toHaveStyle({ width: 0, overflow: "hidden" })
  const glyph = timing.mock.calls.find(([, config]) => config.duration === 250)?.[1]
  expect(glyph).toBeDefined()
  for (const t of [0.1, 0.25, 0.5, 0.75, 0.9])
    expect(glyph?.easing?.(t)).toBeCloseTo(Easing.bezier(0.25, 0.1, 0.25, 1)(t), 6)
  await act(() => jest.advanceTimersByTime(100))
  const partial = screen.getByTestId("checkbox-ink", hidden).props.style.width
  expect(partial).toBeGreaterThan(0)
  await act(() => jest.advanceTimersByTime(175))
  const full = screen.getByTestId("checkbox-ink", hidden).props.style.width
  expect(full).toBeGreaterThan(partial)
  await view.rerender(<Checkbox aria-label="Choice" isSelected={false} />)
  expect(screen.getByRole("checkbox")).not.toBeChecked()
  expect(screen.getByTestId("checkbox-ink", hidden).props.style.width).toBe(full)
  await act(() => jest.advanceTimersByTime(100))
  expect(screen.getByTestId("checkbox-ink", hidden).props.style.width).toBeLessThan(full)
  await act(() => jest.advanceTimersByTime(175))
  expect(screen.queryByTestId("checkbox-check", hidden)).toBeNull()
})

it("preserves mixed and showIcon switching without restarting filled glyph progress", async () => {
  const view = await render(<Checkbox aria-label="Choice" isIndeterminate showIcon={false} />)
  expect(screen.getByTestId("checkbox-mixed", hidden)).toBeOnTheScreen()
  await view.rerender(<Checkbox aria-label="Choice" isSelected />)
  expect(screen.queryByTestId("checkbox-mixed", hidden)).toBeNull()
  expect(screen.getByTestId("checkbox-ink", hidden).props.style.width).toBeGreaterThan(0)
  const full = screen.getByTestId("checkbox-ink", hidden).props.style.width
  await view.rerender(<Checkbox aria-label="Choice" isSelected showIcon={false} />)
  expect(screen.queryByTestId("checkbox-check", hidden)).toBeNull()
  await view.rerender(<Checkbox aria-label="Choice" isSelected />)
  expect(screen.getByTestId("checkbox-ink", hidden).props.style.width).toBe(full)
})

it("interrupts current paint, follows live Reduce Motion and cleans up both clocks with opaque native colors intact", async () => {
  const animate = Animated.timing
  const stops: Array<jest.SpyInstance> = []
  const timing = jest.spyOn(Animated, "timing").mockImplementation((value, config) => {
    const animation = animate(value, config)
    stops.push(jest.spyOn(animation, "stop"))
    return animation
  })
  const events = jest.spyOn(AccessibilityInfo, "addEventListener")
  const view = await render(<Checkbox aria-label="Choice" isSelected color="#000000" />)
  await view.rerender(<Checkbox aria-label="Choice" isSelected color="#ffffff" raised width={40} />)
  await act(() => jest.advanceTimersByTime(80))
  const current = screen.getByTestId("checkbox-shape", hidden).props.style.backgroundColor
  expect(current).toMatch(/^rgba\(/)
  await view.rerender(<Checkbox aria-label="Choice" isSelected color="#ff0000" />)
  expect(screen.getByTestId("checkbox-shape", hidden).props.style.backgroundColor).toBe(current)
  const calls = events.mock.calls as unknown as Array<[string, (value: boolean) => void]>
  const callbacks = calls.filter(([name]) => name === "reduceMotionChanged").map(([, callback]) => callback)
  expect(callbacks.length).toBeGreaterThan(0)
  await act(() => callbacks.forEach((callback) => callback(true)))
  expect(screen.getByTestId("checkbox-shape", hidden)).toHaveStyle({
    width: 20,
    backgroundColor: "#ff0000",
    shadowOpacity: 0,
  })
  const color = PlatformColor("native-checkbox-mark")
  await view.rerender(<Checkbox aria-label="Choice" isSelected color={color} />)
  expect(screen.getByTestId("checkbox-shape", hidden).props.style.backgroundColor).toBe(color)
  await view.unmount()
  for (const stop of stops) expect(stop).toHaveBeenCalled()
  const count = timing.mock.calls.length
  await act(() => {
    callbacks.forEach((callback) => callback(false))
    jest.advanceTimersByTime(300)
  })
  expect(timing).toHaveBeenCalledTimes(count)
})

it("uses the separate250ms ease foreground clock for native mixed and check glyph paint", async () => {
  const timing = jest.spyOn(Animated, "timing")
  const view = await render(
    <NativeThemeProvider overrides={{ colors: { controlSelectedForeground: "#000000" } }}>
      <Checkbox isIndeterminate aria-label="Choice" />
    </NativeThemeProvider>,
  )
  timing.mockClear()
  await view.rerender(
    <NativeThemeProvider overrides={{ colors: { controlSelectedForeground: "#ffffff" } }}>
      <Checkbox isIndeterminate aria-label="Choice" />
    </NativeThemeProvider>,
  )
  expect(screen.getByTestId("checkbox-mixed", hidden)).toHaveStyle({ backgroundColor: "#000000" })
  const glyph = timing.mock.calls.find(([, config]) => config.duration === 250)?.[1]
  expect(glyph).toBeDefined()
  for (const t of [0.1, 0.25, 0.5, 0.75, 0.9])
    expect(glyph?.easing?.(t)).toBeCloseTo(Easing.bezier(0.25, 0.1, 0.25, 1)(t), 6)
  await act(() => jest.advanceTimersByTime(100))
  expect(screen.getByTestId("checkbox-mixed", hidden).props.style.backgroundColor).toMatch(/^rgba\(/)
  await act(() => jest.advanceTimersByTime(175))
  expect(screen.getByTestId("checkbox-mixed", hidden)).toHaveStyle({ backgroundColor: "#ffffff" })
  await view.rerender(
    <NativeThemeProvider overrides={{ colors: { controlSelectedForeground: "#ffffff" } }}>
      <Checkbox isSelected aria-label="Choice" />
    </NativeThemeProvider>,
  )
  expect(screen.getByTestId("checkbox-check", hidden)).toHaveStyle({ borderColor: "#ffffff" })
})
