import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { AccessibilityInfo, Animated, Easing, PlatformColor, TextInput, View, type ViewProps } from "react-native"

import { NumberInput, type TNativeNumberInputRenderState } from "../../.."

const names = { accessibilityLabel: "Quantity", incrementLabel: "Add quantity", decrementLabel: "Reduce quantity" }
const input = () => screen.getByTestId("number-input-input")
const root = () => screen.getByTestId("number-input")
beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

it("renders the original numeric root after style while preserving editor ref, native events and controlled requests", async () => {
  const editor = createRef<TextInput>()
  const container = createRef<View>()
  const trace: string[] = []
  const changed = jest.fn()
  const layout = jest.fn()
  const renderer = jest.fn((props: ViewProps, state: TNativeNumberInputRenderState) => {
    trace.push("render")
    return <View {...props} ref={container} nativeID={String(state.value)} />
  })
  const adapter = { render: renderer }
  const view = await render(
    <NumberInput
      {...names}
      {...adapter}
      ref={editor}
      value={2}
      onChange={changed}
      onLayout={layout}
      style={({ defaultStyle }) => {
        trace.push("style")
        return defaultStyle
      }}
    />,
  )
  expect(renderer).toHaveBeenCalled()
  expect(trace.slice(0, 2)).toEqual(["style", "render"])
  expect(editor.current).toBeInstanceOf(TextInput)
  const originalEditor = editor.current
  const originalRoot = container.current
  expect(originalRoot).not.toBeNull()
  expect(root().props.accessible).toBe(false)
  expect(screen.getAllByRole("button")).toHaveLength(2)
  const event = { nativeEvent: { layout: { width: 240, height: 48 } } }
  await fireEvent(root(), "layout", event)
  expect(layout.mock.calls[0][0]).toBe(event)
  await fireEvent.changeText(input(), "007.25")
  expect(renderer.mock.calls.at(-1)?.[1]).toMatchObject({ value: 2, inputValue: "007.25" })
  await fireEvent(input(), "submitEditing", { nativeEvent: { text: "7.25" } })
  expect(changed.mock.calls).toEqual([[7.25]])
  expect(input()).toHaveDisplayValue("2")
  await view.rerender(<NumberInput {...names} {...adapter} ref={editor} value={7.25} isReadOnly onChange={changed} />)
  expect(editor.current).toBe(originalEditor)
  expect(container.current).toBe(originalRoot)
  expect(root().props.nativeID).toBe("7.25")
  expect(renderer.mock.calls.at(-1)?.[1]).toMatchObject({ value: 7.25, isReadOnly: true })
  await fireEvent(input(), "submitEditing", { nativeEvent: { text: "9" } })
  expect(changed).toHaveBeenCalledTimes(1)
  await view.unmount()
  expect(editor.current).toBeNull()
  expect(container.current).toBeNull()
})

it("transitions final root border for250ms with original easing while background, radius and focus outline remain immediate", async () => {
  const timing = jest.spyOn(Animated, "timing")
  const view = await render(<NumberInput {...names} customStyles={{ borderColor: "#000000" }} />)
  timing.mockClear()
  await view.rerender(
    <NumberInput {...names} customStyles={{ borderColor: "#ffffff", backgroundColor: "#123456", borderRadius: 17 }} />,
  )
  expect(root()).toHaveStyle({ borderColor: "#000000", backgroundColor: "#123456", borderRadius: 17 })
  expect(timing).toHaveBeenCalledTimes(1)
  const config = timing.mock.calls[0][1]
  expect(config.duration).toBe(250)
  for (const t of [0.1, 0.25, 0.5, 0.75, 0.9])
    expect(config.easing?.(t)).toBeCloseTo(Easing.bezier(0.42, 0, 0.58, 1)(t), 6)
  await fireEvent(input(), "focus", { nativeEvent: {} })
  expect(root()).toHaveStyle({ outlineWidth: 1.5, outlineOffset: 1.5 })
  await act(() => jest.advanceTimersByTime(100))
  const current = root().props.style.borderColor
  expect(current).toMatch(/^rgba\(/)
  await view.rerender(<NumberInput {...names} customStyles={{ borderColor: "#abcdef" }} />)
  expect(root().props.style.borderColor).toBe(current)
  await act(() => jest.advanceTimersByTime(275))
  expect(root()).toHaveStyle({ borderColor: "#abcdef" })
})

it("preserves final-style precedence and opaque colors, then cancels owned motion on live Reduce Motion and teardown", async () => {
  const events = jest.spyOn(AccessibilityInfo, "addEventListener")
  const animate = Animated.timing
  const stops: Array<jest.SpyInstance> = []
  const timing = jest.spyOn(Animated, "timing").mockImplementation((value, config) => {
    const animation = animate(value, config)
    stops.push(jest.spyOn(animation, "stop"))
    return animation
  })
  const view = await render(<NumberInput {...names} customStyles={{ borderColor: "#000000" }} />)
  const opaque = PlatformColor("native-number-border")
  await view.rerender(
    <NumberInput {...names} errorState customStyles={{ borderColor: "#123456" }} style={{ borderColor: opaque }} />,
  )
  expect(root().props.style.borderColor).toBe(opaque)
  await view.rerender(<NumberInput {...names} customStyles={{ borderColor: "#000000" }} />)
  await view.rerender(<NumberInput {...names} customStyles={{ borderColor: "#ffffff" }} />)
  await act(() => jest.advanceTimersByTime(80))
  expect(root().props.style.borderColor).toMatch(/^rgba\(/)
  const callbacks = (events.mock.calls as unknown as Array<[string, (value: boolean) => void]>)
    .filter(([name]) => name === "reduceMotionChanged")
    .map(([, callback]) => callback)
  await act(() => callbacks.forEach((callback) => callback(true)))
  expect(root()).toHaveStyle({ borderColor: "#ffffff" })
  await view.unmount()
  expect(stops.length).toBeGreaterThan(0)
  for (const stop of stops) expect(stop).toHaveBeenCalled()
  const count = timing.mock.calls.length
  await act(() => {
    callbacks.forEach((callback) => callback(false))
    jest.advanceTimersByTime(300)
  })
  expect(timing).toHaveBeenCalledTimes(count)
})
