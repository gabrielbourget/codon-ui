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

import { Radio, RadioGroup, type TNativeRadioStyleState } from "../../.."

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})
const hidden = { includeHiddenElements: true }

it("preserves the original radio root/ref/events and style-child-root order through controlled group echo", async () => {
  const ref = createRef<View>()
  const trace: string[] = []
  const changed = jest.fn()
  const pressed = jest.fn()
  const renderer = jest.fn((props: PressableProps & RefAttributes<View>, state: unknown) => {
    trace.push("render")
    return <Pressable {...props} testID="rendered-radio" accessibilityHint={JSON.stringify(state)} />
  })
  const adapter = { render: renderer }
  const children = ({ isSelected }: { isSelected: boolean }) => {
    trace.push("children")
    return isSelected ? "Chosen" : "Choice"
  }
  const view = await render(
    <RadioGroup aria-label="Choices" value={null} onChange={changed}>
      <Radio
        {...adapter}
        aria-label="Choice"
        value="one"
        ref={ref}
        onPress={pressed}
        style={({ defaultStyle }) => {
          trace.push("style")
          return defaultStyle
        }}
      >
        {children}
      </Radio>
    </RadioGroup>,
  )
  expect(renderer).toHaveBeenCalled()
  expect(trace.slice(0, 3)).toEqual(["style", "children", "render"])
  const original = ref.current
  expect(original).not.toBeNull()
  expect(renderer.mock.calls.at(-1)?.[0].ref).toBe(ref)
  const event = { nativeEvent: { timestamp: 10 } }
  await fireEvent(screen.getByRole("radio"), "press", event)
  expect(changed.mock.calls).toEqual([["one"]])
  expect(pressed.mock.calls[0][0]).toBe(event)
  expect(screen.getByRole("radio")).not.toBeChecked()
  await view.rerender(
    <RadioGroup aria-label="Choices" value="one" isReadOnly onChange={changed}>
      <Radio {...adapter} aria-label="Choice" value="one" ref={ref} onPress={pressed}>
        {children}
      </Radio>
    </RadioGroup>,
  )
  expect(ref.current).toBe(original)
  expect(renderer.mock.calls.at(-1)?.[1]).toMatchObject({ isSelected: true, isReadOnly: true })
  expect(screen.getByText("Chosen")).toBeOnTheScreen()
  await fireEvent(screen.getByRole("radio"), "press", { nativeEvent: { timestamp: 11 } })
  expect(changed).toHaveBeenCalledTimes(1)
  expect(pressed).toHaveBeenCalledTimes(1)
  await view.unmount()
  expect(ref.current).toBeNull()
})

it("transitions shape paint, dimensions, radius and opacity for250ms while border and outline remain immediate", async () => {
  const timing = jest.spyOn(Animated, "timing")
  const view = await render(
    <RadioGroup aria-label="Choices" value="one">
      <Radio aria-label="Choice" value="one" color="#000000" />
    </RadioGroup>,
  )
  timing.mockClear()
  await view.rerender(
    <RadioGroup aria-label="Choices" value="one">
      <Radio
        aria-label="Choice"
        value="one"
        color="#ffffff"
        geometry="round"
        customShapeStyles={{ width: 40, height: 30, opacity: 0.5, borderColor: "#ff0000", outlineWidth: 3 }}
      />
    </RadioGroup>,
  )
  const shape = () => screen.getByTestId("radio-shape", hidden)
  expect(shape()).toHaveStyle({
    backgroundColor: "#000000",
    width: 20,
    height: 20,
    borderRadius: 5,
    opacity: 1,
    borderColor: "#ff0000",
    outlineWidth: 3,
  })
  expect(timing.mock.calls.length).toBeGreaterThanOrEqual(5)
  for (const [, config] of timing.mock.calls) {
    expect(config.duration).toBe(250)
    for (const t of [0.1, 0.25, 0.5, 0.75, 0.9])
      expect(config.easing?.(t)).toBeCloseTo(Easing.bezier(0.42, 0, 0.58, 1)(t), 6)
  }
  await act(() => jest.advanceTimersByTime(125))
  expect(shape().props.style.backgroundColor).toMatch(/^rgba\(/)
  expect(shape().props.style.width).toBeGreaterThan(20)
  expect(shape().props.style.width).toBeLessThan(40)
  await act(() => jest.advanceTimersByTime(150))
  expect(shape()).toHaveStyle({ backgroundColor: "#ffffff", width: 40, height: 30, borderRadius: 10000, opacity: 0.5 })
})

it("interrupts shape paint from its current value, follows live Reduce Motion and cleans up owned clocks", async () => {
  const events = jest.spyOn(AccessibilityInfo, "addEventListener")
  const animate = Animated.timing
  const stops: Array<jest.SpyInstance> = []
  const timing = jest.spyOn(Animated, "timing").mockImplementation((value, config) => {
    const animation = animate(value, config)
    stops.push(jest.spyOn(animation, "stop"))
    return animation
  })
  const style = jest.fn(({ defaultStyle }: TNativeRadioStyleState) => defaultStyle)
  const view = await render(
    <RadioGroup aria-label="Choices" value="one">
      <Radio aria-label="Choice" value="one" color="#000000" style={style} />
    </RadioGroup>,
  )
  await view.rerender(
    <RadioGroup aria-label="Choices" value="one">
      <Radio aria-label="Choice" value="one" color="#ffffff" customShapeStyles={{ width: 40 }} style={style} />
    </RadioGroup>,
  )
  await act(() => jest.advanceTimersByTime(125))
  const current = screen.getByTestId("radio-shape", hidden).props.style.backgroundColor
  expect(current).toMatch(/^rgba\(/)
  await view.rerender(
    <RadioGroup aria-label="Choices" value="one">
      <Radio aria-label="Choice" value="one" color="#ff0000" customShapeStyles={{ width: 50 }} style={style} />
    </RadioGroup>,
  )
  expect(screen.getByTestId("radio-shape", hidden).props.style.backgroundColor).toBe(current)
  const calls = events.mock.calls as unknown as Array<[string, (value: boolean) => void]>
  const callbacks = calls.filter(([name]) => name === "reduceMotionChanged").map(([, callback]) => callback)
  expect(callbacks.length).toBeGreaterThan(0)
  await act(() => callbacks.forEach((callback) => callback(true)))
  expect(screen.getByTestId("radio-shape", hidden)).toHaveStyle({ backgroundColor: "#ff0000", width: 50 })
  await view.unmount()
  for (const stop of stops) expect(stop).toHaveBeenCalled()
  const last = timing.mock.calls.length
  await act(() => {
    callbacks.forEach((callback) => callback(false))
    jest.advanceTimersByTime(300)
  })
  expect(timing).toHaveBeenCalledTimes(last)
})

it("preserves opaque native colors and percentage dimensions without coercing the authored mark", async () => {
  const color = PlatformColor("native-radio-shape")
  await render(
    <RadioGroup aria-label="Choices" value="one">
      <Radio aria-label="Choice" value="one" color={color} customShapeStyles={{ width: "60%" }} />
    </RadioGroup>,
  )
  expect(screen.getByTestId("radio-shape", hidden).props.style.backgroundColor).toBe(color)
  expect(screen.getByTestId("radio-shape", hidden)).toHaveStyle({ width: "60%", borderColor: color })
})
