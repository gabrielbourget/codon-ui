import { act, render, screen, userEvent } from "@testing-library/react-native"
import { createRef } from "react"
import { AccessibilityInfo, Animated, Easing, PlatformColor, View, type ViewProps } from "react-native"

import { NativeButtonContext, Select, Text, type TNativeSelectRenderState } from "../../.."

jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual("react-native")
  return { SafeAreaProvider: View, SafeAreaView: View }
})
const items = [
  { id: "one", name: "One" },
  { id: "two", name: "Two" },
]
const base = {
  items,
  getKey: (item: (typeof items)[number]) => item.id,
  getTextValue: (item: (typeof items)[number]) => item.name,
  accessibilityLabel: "Choose",
  closeLabel: "Close",
  placeholder: "Choose a value",
}
const hidden = { includeHiddenElements: true }
const root = () => screen.getByTestId("select", hidden)
const trigger = () => screen.getByTestId("select-trigger", hidden)
const icon = () => screen.getByTestId("select-icon-motion", hidden)
const rotation = () => parseFloat(icon().props.style.transform[0].rotateX)
beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
  jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent").mockImplementation(() => {})
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

it("renders original owned trigger/window after style and before selected value while retaining the trigger ref", async () => {
  const ref = createRef<View>()
  const trace: string[] = []
  const opened = jest.fn()
  const renderer = jest.fn((props: ViewProps, state: TNativeSelectRenderState) => {
    trace.push("root")
    return <View {...props} nativeID={String(state.isOpen)} />
  })
  const adapter = { render: renderer }
  const view = await render(
    <Select
      {...base}
      {...adapter}
      ref={ref}
      value="one"
      isOpen={false}
      onOpenChange={opened}
      style={({ defaultStyle }) => {
        trace.push("style")
        return defaultStyle
      }}
      renderSelectedValue={({ selectedText }) => {
        trace.push("value")
        return <>Picked {selectedText}</>
      }}
    />,
  )
  expect(renderer).toHaveBeenCalled()
  expect(trace.indexOf("style")).toBeLessThan(trace.indexOf("root"))
  expect(trace.indexOf("root")).toBeLessThan(trace.indexOf("value"))
  const original = ref.current
  expect(original).not.toBeNull()
  expect(root().props.accessible).toBe(false)
  expect(screen.getByText("Picked One")).toBeOnTheScreen()
  await userEvent.setup().press(trigger())
  expect(opened.mock.calls).toEqual([[true]])
  expect(root().props.nativeID).toBe("false")
  await view.rerender(<Select {...base} {...adapter} ref={ref} value="one" isOpen isReadOnly onOpenChange={opened} />)
  expect(ref.current).toBe(original)
  expect(root().props.nativeID).toBe("true")
  expect(renderer.mock.calls.at(-1)?.[1]).toMatchObject({ isOpen: true, isReadOnly: true })
  expect(screen.getByRole("radio", { name: "Two" })).toBeOnTheScreen()
  await view.unmount()
  expect(ref.current).toBeNull()
})

it("retains root background/geometry and native root-trigger-text foreground precedence", async () => {
  const view = await render(<Select {...base} value="one" />)
  expect(root()).toHaveStyle({ backgroundColor: "#ffffff", borderRadius: 5 })
  const authored = { color: "#123456", backgroundColor: "#111111" }
  const triggerStyles = { color: "#abcdef", backgroundColor: "#222222" }
  await view.rerender(
    <Select
      {...base}
      value="one"
      geometry="orthogonal"
      customStyles={authored}
      customSelectedItemStyles={triggerStyles}
      customSelectedItemTextStyles={{ color: "#654321" }}
    />,
  )
  expect(root()).toHaveStyle({ backgroundColor: "#111111", borderRadius: 0 })
  expect(root().props.style.color).toBeUndefined()
  await act(() => jest.advanceTimersByTime(275))
  expect(trigger()).toHaveStyle({ backgroundColor: "#222222" })
  expect(screen.getByText("One")).toHaveStyle({ color: "#654321" })
})

it("animates authored and default icons over400ms around X, interrupting at current paint without changing owner open", async () => {
  const timing = jest.spyOn(Animated, "timing")
  const opened = jest.fn()
  const view = await render(
    <Select {...base} isOpen={false} onOpenChange={opened} ComponentIcon={<Text>Custom icon</Text>} />,
  )
  expect(rotation()).toBe(0)
  timing.mockClear()
  await view.rerender(<Select {...base} isOpen onOpenChange={opened} ComponentIcon={<Text>Custom icon</Text>} />)
  expect(rotation()).toBe(0)
  const config = timing.mock.calls.find(([, value]) => value.duration === 400)?.[1]
  expect(config).toBeDefined()
  for (const t of [0.1, 0.25, 0.5, 0.75, 0.9])
    expect(config?.easing?.(t)).toBeCloseTo(Easing.bezier(0.42, 0, 0.58, 1)(t), 6)
  await act(() => jest.advanceTimersByTime(100))
  const current = rotation()
  expect(current).toBeGreaterThan(0)
  expect(current).toBeLessThan(180)
  await view.rerender(
    <Select {...base} isOpen={false} onOpenChange={opened} ComponentIcon={<Text>Custom icon</Text>} />,
  )
  expect(rotation()).toBe(current)
  await act(() => jest.advanceTimersByTime(425))
  expect(rotation()).toBe(0)
  expect(opened).not.toHaveBeenCalled()
  await view.rerender(<Select {...base} isOpen onOpenChange={opened} />)
  await act(() => jest.advanceTimersByTime(425))
  expect(rotation()).toBe(180)
  expect(screen.getByTestId("select-default-icon", hidden)).toHaveStyle({ transform: [{ rotate: "45deg" }] })
  await view.rerender(<Select {...base} isOpen ComponentIcon={null} />)
  expect(screen.queryByTestId("select-default-icon", hidden)).toBeNull()
})

it("uses the inherited private Button color/shadow clocks while rejecting foreign Button context", async () => {
  const ref = createRef<View>()
  const foreign = jest.fn()
  const props = { ...base, value: "one", ref }
  const fixture = (next: boolean) => (
    <NativeButtonContext.Provider value={{ isPending: true, onPress: foreign }}>
      <Select
        {...props}
        customSelectedItemStyles={{
          backgroundColor: next ? "#ffffff" : "#000000",
          borderColor: next ? "#ffffff" : "#000000",
          shadowColor: "#000000",
          shadowOpacity: next ? 0.4 : 0,
          shadowRadius: next ? 3 : 0,
        }}
      />
    </NativeButtonContext.Provider>
  )
  const timing = jest.spyOn(Animated, "timing")
  const view = await render(fixture(false))
  const original = ref.current
  timing.mockClear()
  await view.rerender(fixture(true))
  expect(trigger()).toHaveStyle({ backgroundColor: "#000000", borderColor: "#000000", shadowOpacity: 0 })
  expect(timing.mock.calls.some(([, config]) => config.duration === 250)).toBe(true)
  expect(timing.mock.calls.some(([, config]) => config.duration === 450)).toBe(true)
  expect(trigger().props.accessibilityState.busy).toBe(false)
  expect(ref.current).toBe(original)
  await act(() => jest.advanceTimersByTime(100))
  expect(trigger().props.style.backgroundColor).toMatch(/^rgba\(/)
  expect(trigger().props.style.shadowOpacity).toBeGreaterThan(0)
  expect(trigger().props.style.shadowOpacity).toBeLessThan(0.4)
  await act(() => jest.advanceTimersByTime(375))
  expect(trigger()).toHaveStyle({
    backgroundColor: "#ffffff",
    borderColor: "#ffffff",
    shadowOpacity: 0.4,
    shadowRadius: 3,
  })
  expect(foreign).not.toHaveBeenCalled()
})

it("retains opaque trigger colors and stops icon/color work on live Reduce Motion and unmount", async () => {
  const events = jest.spyOn(AccessibilityInfo, "addEventListener")
  const animate = Animated.timing
  const stops: Array<jest.SpyInstance> = []
  const timing = jest.spyOn(Animated, "timing").mockImplementation((value, config) => {
    const animation = animate(value, config)
    stops.push(jest.spyOn(animation, "stop"))
    return animation
  })
  const opaque = PlatformColor("native-select-trigger")
  const view = await render(<Select {...base} isOpen={false} customSelectedItemStyles={{ backgroundColor: opaque }} />)
  expect(trigger().props.style.backgroundColor).toBe(opaque)
  await view.rerender(<Select {...base} isOpen customSelectedItemStyles={{ backgroundColor: "#000000" }} />)
  await act(() => jest.advanceTimersByTime(80))
  expect(rotation()).toBeGreaterThan(0)
  const callbacks = (events.mock.calls as unknown as Array<[string, (value: boolean) => void]>)
    .filter(([name]) => name === "reduceMotionChanged")
    .map(([, cb]) => cb)
  await act(() => callbacks.forEach((cb) => cb(true)))
  expect(rotation()).toBe(180)
  expect(trigger()).toHaveStyle({ backgroundColor: "#000000" })
  await view.unmount()
  expect(stops.length).toBeGreaterThan(0)
  for (const stop of stops) expect(stop).toHaveBeenCalled()
  const count = timing.mock.calls.length
  await act(() => {
    callbacks.forEach((cb) => cb(false))
    jest.advanceTimersByTime(500)
  })
  expect(timing).toHaveBeenCalledTimes(count)
})
