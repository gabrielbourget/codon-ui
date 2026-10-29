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

import { ListBoxItem, Text, type TNativeListBoxItemRenderState } from "../../.."

const row = () => screen.getByRole("radio", { name: "Choice" })
beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

it("retains root/ref/event identity and style-child-render order with controlled selection and guards", async () => {
  const ref = createRef<View>()
  const trace: string[] = []
  const pressed = jest.fn()
  const childState = jest.fn()
  const renderer = jest.fn((props: PressableProps & RefAttributes<View>, state: TNativeListBoxItemRenderState) => {
    trace.push("render")
    return <Pressable {...props} nativeID={String(state.isSelected)} />
  })
  const adapter = { render: renderer }
  const view = await render(
    <ListBoxItem
      {...adapter}
      ref={ref}
      id={0}
      textValue="Choice"
      onPress={pressed}
      style={({ defaultStyle }) => {
        trace.push("style")
        return defaultStyle
      }}
    >
      {(state) => {
        childState(state)
        trace.push("child")
        return <>Choice {state.isSelected ? "selected" : "available"}</>
      }}
    </ListBoxItem>,
  )
  expect(renderer).toHaveBeenCalled()
  expect(trace.slice(0, 3)).toEqual(["style", "child", "render"])
  expect(childState.mock.calls[0][0]).toHaveProperty("defaultChildren", undefined)
  const original = ref.current
  expect(original).not.toBeNull()
  expect(renderer.mock.calls.at(-1)?.[0].ref).toBe(ref)
  const event = { nativeEvent: { timestamp: 5, target: 17 } }
  await fireEvent(row(), "press", event)
  expect(pressed.mock.calls[0][0]).toBe(event)
  expect(row()).not.toBeChecked()
  await view.rerender(
    <ListBoxItem {...adapter} ref={ref} id={0} textValue="Choice" isSelected isReadOnly onPress={pressed} />,
  )
  expect(ref.current).toBe(original)
  expect(row()).toBeChecked()
  expect(row().props.nativeID).toBe("true")
  await fireEvent(row(), "press", event)
  expect(pressed).toHaveBeenCalledTimes(1)
  await view.unmount()
  expect(ref.current).toBeNull()
})

it("routes computed-custom-final foreground to owned content while preserving authored Text overrides", async () => {
  const supplied = { color: "#123456", width: 72 }
  const styleState = jest.fn()
  await render(
    <ListBoxItem
      id="row"
      textValue="Choice"
      isSelected
      customStyles={supplied}
      style={(state) => {
        styleState(state)
        return { ...state.defaultStyle, color: "#abcdef" }
      }}
    >
      <>
        Inherited <Text color="#654321">Authored</Text>
      </>
    </ListBoxItem>,
  )
  expect(styleState.mock.calls[0][0].defaultStyle).toMatchObject({ color: "#123456", width: 72 })
  expect(screen.getByText("Inherited")).toHaveStyle({ color: "#abcdef" })
  expect(screen.getByText("Authored")).toHaveStyle({ color: "#654321" })
  expect(row()).toHaveStyle({ width: 72, backgroundColor: "#2563eb" })
  expect(row().props.style.color).toBeUndefined()
})

it("uses250ms background easing with original selected and pressed native roles and immediate focus/radius", async () => {
  const timing = jest.spyOn(Animated, "timing")
  const view = await render(<ListBoxItem id="row" textValue="Choice" customStyles={{ backgroundColor: "#000000" }} />)
  timing.mockClear()
  await view.rerender(
    <ListBoxItem id="row" textValue="Choice" customStyles={{ backgroundColor: "#ffffff", borderRadius: 17 }} />,
  )
  expect(row()).toHaveStyle({ backgroundColor: "#000000", borderRadius: 17 })
  expect(timing).toHaveBeenCalledTimes(1)
  const config = timing.mock.calls[0][1]
  expect(config.duration).toBe(250)
  for (const t of [0.1, 0.25, 0.5, 0.75, 0.9])
    expect(config.easing?.(t)).toBeCloseTo(Easing.bezier(0.42, 0, 0.58, 1)(t), 6)
  await fireEvent(row(), "focus", { nativeEvent: {} })
  expect(row()).toHaveStyle({ outlineWidth: 1.5, outlineOffset: 1.5 })
  await act(() => jest.advanceTimersByTime(100))
  const current = row().props.style.backgroundColor
  expect(current).toMatch(/^rgba\(/)
  await view.rerender(<ListBoxItem id="row" textValue="Choice" isSelected />)
  expect(row().props.style.backgroundColor).toBe(current)
  await act(() => jest.advanceTimersByTime(275))
  expect(row()).toHaveStyle({ backgroundColor: "#2563eb" })
  await fireEvent(row(), "hoverIn", { nativeEvent: {} })
  expect(row()).toHaveStyle({ cursor: "pointer" })
  await act(() => jest.advanceTimersByTime(275))
  expect(row()).toHaveStyle({ backgroundColor: "#245bd6" })
  await fireEvent(row(), "pressIn", { nativeEvent: { timestamp: 1 } })
  await act(() => jest.advanceTimersByTime(275))
  expect(row()).toHaveStyle({ backgroundColor: "#2254c1" })
})

it("preserves opaque/final background targets and cancels motion for live Reduce Motion and unmount", async () => {
  const events = jest.spyOn(AccessibilityInfo, "addEventListener")
  const animate = Animated.timing
  const stops: Array<jest.SpyInstance> = []
  const timing = jest.spyOn(Animated, "timing").mockImplementation((value, config) => {
    const animation = animate(value, config)
    stops.push(jest.spyOn(animation, "stop"))
    return animation
  })
  const view = await render(<ListBoxItem id="row" textValue="Choice" customStyles={{ backgroundColor: "#000000" }} />)
  const opaque = PlatformColor("native-row-background")
  await view.rerender(
    <ListBoxItem
      id="row"
      textValue="Choice"
      customStyles={{ backgroundColor: "#123456" }}
      style={{ backgroundColor: opaque }}
    />,
  )
  expect(row().props.style.backgroundColor).toBe(opaque)
  await view.rerender(<ListBoxItem id="row" textValue="Choice" customStyles={{ backgroundColor: "#000000" }} />)
  await view.rerender(<ListBoxItem id="row" textValue="Choice" customStyles={{ backgroundColor: "#ffffff" }} />)
  await act(() => jest.advanceTimersByTime(80))
  expect(row().props.style.backgroundColor).toMatch(/^rgba\(/)
  const callbacks = (events.mock.calls as unknown as Array<[string, (value: boolean) => void]>)
    .filter(([name]) => name === "reduceMotionChanged")
    .map(([, callback]) => callback)
  await act(() => callbacks.forEach((callback) => callback(true)))
  expect(row()).toHaveStyle({ backgroundColor: "#ffffff" })
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
