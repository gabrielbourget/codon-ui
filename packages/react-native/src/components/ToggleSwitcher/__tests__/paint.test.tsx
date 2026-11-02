import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { AccessibilityInfo, Animated, PlatformColor, processColor, StyleSheet, type View } from "react-native"

import { NativeFloatingWindowContext } from "../../../overlays/floating/scope"
import { NativeThemeProvider } from "../../../theme"
import { ToggleSwitcher } from "../ToggleSwitcher"

jest.mock("../../../input/specs/CUIFocusViewNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
  Commands: {
    requestKeyboardFocus: jest.fn(),
    requestContainerFocus: jest.fn(),
    requestKeyboardBlur: jest.fn(),
    inspectAccessibility: jest.fn(),
    queryMotionGeometry: jest.fn(),
    sampleMotionColors: jest.fn(),
  },
}))
const items = [
  { id: "a", label: "First" },
  { id: "b", label: "Second" },
]
const root = () => screen.getByTestId("toggle-switcher")
const style = () => StyleSheet.flatten(root().props.style)
const foreground = (label: string) => StyleSheet.flatten(screen.getByText(label).props.style).color
beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

it("preserves the original root and controlled selection while root color250 and shadow450 clocks run", async () => {
  const timing = jest.spyOn(Animated, "timing")
  const ref = createRef<View>()
  const change = jest.fn()
  const node = (raised: boolean, backgroundColor: string, borderColor: string) => (
    <ToggleSwitcher
      ref={ref}
      items={items}
      selectedKey="a"
      raised={raised}
      onSelectionChange={change}
      customStyles={{ backgroundColor, borderColor }}
    />
  )
  const result = await render(node(false, "red", "green"))
  const original = ref.current
  await result.rerender(node(true, "blue", "yellow"))
  const clocks = timing.mock.calls.map(([, config]) => config)
  expect(clocks.filter((config) => config.duration === 250)).toHaveLength(8)
  expect(clocks.filter((config) => config.duration === 450)).toHaveLength(8)
  for (const config of clocks) {
    expect(config).toMatchObject({ delay: 0, useNativeDriver: false, isInteraction: false })
    expect(config.easing!(0.25)).toBeCloseTo(0.12916, 4)
  }
  expect(processColor(style().backgroundColor)).toBe(processColor("red"))
  await act(() => jest.advanceTimersByTime(125))
  expect(processColor(style().backgroundColor)).not.toBe(processColor("red"))
  expect(processColor(style().backgroundColor)).not.toBe(processColor("blue"))
  expect(style().shadowOpacity).toBeGreaterThan(0)
  expect(style().shadowOpacity).toBeLessThan(0.24)
  await act(() => jest.advanceTimersByTime(400))
  expect(processColor(style().backgroundColor)).toBe(processColor("blue"))
  expect(processColor(style().borderColor)).toBe(processColor("yellow"))
  expect(style().shadowOpacity).toBe(0.24)
  expect(ref.current).toBe(original)
  expect(screen.getByRole("button", { name: "First" }).props.accessibilityState.checked).toBe(true)
  expect(change).not.toHaveBeenCalled()
})

it("animates actual option and phrase paint after owner echo while a veto preserves current paint and names", async () => {
  const timing = jest.spyOn(Animated, "timing")
  const change = jest.fn()
  const result = await render(<ToggleSwitcher items={items} selectedKey="a" onSelectionChange={change} />)
  const original = screen.getByRole("button", { name: "Second" })
  const before = processColor(foreground("First"))
  await fireEvent.press(original)
  expect(change).toHaveBeenCalledWith("b")
  expect(processColor(foreground("First"))).toBe(before)
  expect(timing).not.toHaveBeenCalled()
  await result.rerender(<ToggleSwitcher items={items} selectedKey="b" onSelectionChange={change} />)
  expect(timing).toHaveBeenCalledTimes(16)
  expect(timing.mock.calls.every(([, config]) => config.duration === 250)).toBe(true)
  await act(() => jest.advanceTimersByTime(125))
  expect(processColor(foreground("First"))).not.toBe(before)
  expect(processColor(foreground("First"))).not.toBe(processColor("#171717"))
  await act(() => jest.advanceTimersByTime(200))
  expect(processColor(foreground("First"))).toBe(processColor("#171717"))
  expect(processColor(foreground("Second"))).toBe(processColor("#2563eb"))
  expect(screen.getByRole("button", { name: "Second" })).toBe(original)
  expect(original.props.accessibilityState.checked).toBe(true)
})

it("retargets from current paint with per-role theme timing/delay and restores defaults after provider replacement", async () => {
  const timing = jest.spyOn(Animated, "timing")
  const node = (custom: boolean, color: string) => (
    <NativeThemeProvider
      overrides={
        custom
          ? {
              transitions: {
                backgroundColor: { duration: "1s", delay: "100ms", easing: "linear" },
                borderColor: 400,
                color: 900,
                boxShadow: 750,
              },
            }
          : undefined
      }
    >
      <ToggleSwitcher items={items} color={color} customStyles={{ backgroundColor: color, borderColor: color }} />
    </NativeThemeProvider>
  )
  const result = await render(node(true, "red"))
  await result.rerender(node(true, "blue"))
  expect(
    timing.mock.calls.some(
      ([, config]) => config.duration === 1000 && config.delay === 100 && config.easing!(0.25) === 0.25,
    ),
  ).toBe(true)
  expect(timing.mock.calls.some(([, config]) => config.duration === 400)).toBe(true)
  expect(timing.mock.calls.some(([, config]) => config.duration === 900)).toBe(true)
  await act(() => jest.advanceTimersByTime(90))
  expect(processColor(style().backgroundColor)).toBe(processColor("red"))
  await act(() => jest.advanceTimersByTime(510))
  const midway = processColor(style().backgroundColor)
  expect(midway).not.toBe(processColor("blue"))
  await result.rerender(node(false, "green"))
  expect(processColor(style().backgroundColor)).toBe(midway)
  expect(timing.mock.calls.at(-1)![1].duration).toBe(250)
  await act(() => jest.advanceTimersByTime(350))
  expect(processColor(style().backgroundColor)).toBe(processColor("green"))
})

it("snaps current paint on live Reduce Motion and retires every owned subscription and clock", async () => {
  const subscriptions = jest.spyOn(AccessibilityInfo, "addEventListener")
  const actual = Animated.timing
  const stops: jest.SpyInstance[] = []
  jest.spyOn(Animated, "timing").mockImplementation((...args) => {
    const clock = actual(...args)
    stops.push(jest.spyOn(clock, "stop"))
    return clock
  })
  const result = await render(<ToggleSwitcher items={items} customStyles={{ backgroundColor: "red" }} />)
  await result.rerender(<ToggleSwitcher items={items} customStyles={{ backgroundColor: "blue" }} />)
  await act(() => jest.advanceTimersByTime(80))
  const calls = subscriptions.mock.calls as unknown as readonly (readonly [string, (value: boolean) => void])[]
  const listeners = calls.filter(([event]) => event === "reduceMotionChanged")
  const removals = subscriptions.mock.results.map(({ value }) => jest.spyOn(value, "remove"))
  await act(() => {
    for (const [, listener] of listeners) listener(true)
  })
  expect(style().backgroundColor).toBe("blue")
  await result.unmount()
  for (const remove of removals) expect(remove).toHaveBeenCalledTimes(1)
  expect(stops).toHaveLength(4)
  for (const stop of stops) expect(stop).toHaveBeenCalled()
})

it("preserves final opaque colors and pending-preference static paint without native color substitution", async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockReturnValue(new Promise(() => {}))
  const color = PlatformColor("labelColor")
  const timing = jest.spyOn(Animated, "timing")
  const result = await render(
    <ToggleSwitcher items={items} selectedKey="a" customStyles={{ backgroundColor: "red" }} />,
  )
  await result.rerender(
    <ToggleSwitcher
      items={items}
      selectedKey="a"
      customStyles={{ backgroundColor: color }}
      customSelectedOptionStyles={{ color }}
    />,
  )
  expect(style().backgroundColor).toBe(color)
  expect(foreground("First")).toBe(color)
  expect(timing).not.toHaveBeenCalled()
  expect(screen.getByRole("button", { name: "First" }).props.accessibilityState.checked).toBe(true)
})

it("retains current selection while the original option hover background transitions and disabled takeover retires it", async () => {
  const result = await render(<ToggleSwitcher items={items} selectedKey="a" />)
  const option = screen.getByRole("button", { name: "Second" })
  const background = () => StyleSheet.flatten(option.props.style).backgroundColor
  await fireEvent(option, "pointerEnter", { nativeEvent: { pointerType: "mouse" } })
  await act(() => jest.advanceTimersByTime(125))
  expect(processColor(background())).not.toBe(processColor("transparent"))
  expect(processColor(background())).not.toBe(processColor("#efefef"))
  await act(() => jest.advanceTimersByTime(200))
  expect(processColor(background())).toBe(processColor("#efefef"))
  await result.rerender(<ToggleSwitcher items={items} selectedKey="a" isDisabled />)
  await act(() => jest.advanceTimersByTime(350))
  expect(processColor(background())).toBe(processColor("transparent"))
  expect(option.props.accessibilityState).toMatchObject({ checked: false, disabled: true })
  expect(screen.getByRole("button", { name: "First" }).props.accessibilityState.checked).toBe(true)
})

it("consumes the existing independent muted-border role with final authored precedence and unchanged original controls", async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(true)
  const node = (borderMuted: string, authored = false) => (
    <NativeThemeProvider overrides={{ colors: { borderMuted, controlBorder: "orange" } }}>
      <ToggleSwitcher items={items} selectedKey="a" style={authored ? { borderColor: "green" } : undefined} />
    </NativeThemeProvider>
  )
  const result = await render(node("purple"))
  const option = screen.getByRole("button", { name: "First" })
  expect(style().borderColor).toBe("purple")
  await result.rerender(node("blue"))
  expect(style().borderColor).toBe("blue")
  await result.rerender(node("blue", true))
  expect(style().borderColor).toBe("green")
  expect(screen.getByRole("button", { name: "First" })).toBe(option)
  expect(option.props.accessibilityState.checked).toBe(true)
})

it("preserves readonly pointer hover through original observation while stale contacts and disabled scopes remain guarded", async () => {
  const change = jest.fn()
  const result = await render(<ToggleSwitcher items={items} selectedKey="a" isReadOnly onSelectionChange={change} />)
  const option = screen.getByRole("button", { name: "Second" })
  const background = () => StyleSheet.flatten(option.props.style).backgroundColor
  await fireEvent(option, "pointerEnter", { nativeEvent: { pointerType: "touch" } })
  await act(() => jest.advanceTimersByTime(350))
  expect(processColor(background())).toBe(processColor("transparent"))
  await fireEvent(option, "pointerEnter", { nativeEvent: { pointerType: "mouse" } })
  await act(() => jest.advanceTimersByTime(350))
  expect(processColor(background())).toBe(processColor("#efefef"))
  await fireEvent.press(option)
  expect(change).not.toHaveBeenCalled()
  await result.rerender(
    <ToggleSwitcher items={items} selectedKey="a" isReadOnly isDisabled onSelectionChange={change} />,
  )
  await act(() => jest.advanceTimersByTime(350))
  expect(processColor(background())).toBe(processColor("transparent"))
  expect(change).not.toHaveBeenCalled()
})

it("retires readonly paint across inactive floating windows and detached original hosts", async () => {
  let active = true
  const window = () => active
  const change = jest.fn(),
    ref = createRef<View>()
  const node = (width: number) => (
    <NativeFloatingWindowContext.Provider value={window}>
      <ToggleSwitcher ref={ref} items={items} selectedKey="a" isReadOnly width={width} onSelectionChange={change} />
    </NativeFloatingWindowContext.Provider>
  )
  const result = await render(node(200))
  const original = ref.current,
    option = screen.getByRole("button", { name: "Second" })
  const pointer = { nativeEvent: { pointerType: "pen" }, persist: jest.fn() }
  await fireEvent(option, "pointerEnter", pointer)
  await act(() => jest.advanceTimersByTime(350))
  expect(processColor(StyleSheet.flatten(option.props.style).backgroundColor)).toBe(processColor("#efefef"))
  active = false
  await result.rerender(node(201))
  await act(() => jest.advanceTimersByTime(350))
  expect(processColor(StyleSheet.flatten(option.props.style).backgroundColor)).toBe(processColor("transparent"))
  expect(ref.current).toBe(original)
  const receive = option.props.onPointerEnter
  await result.unmount()
  active = true
  await act(() => receive(pointer))
  expect(ref.current).toBeNull()
  expect(change).not.toHaveBeenCalled()
})

it("consumes the approved muted surface role through defaults, provider changes and authored precedence without replacing controls", async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(true)
  const ref = createRef<View>()
  const change = jest.fn()
  const node = (mode: "light" | "dark", surfaceMuted?: string, custom = false, final = false) => (
    <NativeThemeProvider mode={mode} overrides={{ colors: { surfaceMuted, background: "orange" } }}>
      <ToggleSwitcher
        ref={ref}
        items={items}
        selectedKey="a"
        onSelectionChange={change}
        customStyles={custom ? { backgroundColor: "purple" } : undefined}
        style={final ? { backgroundColor: "green" } : undefined}
      />
    </NativeThemeProvider>
  )
  const result = await render(node("light"))
  const original = ref.current
  const option = screen.getByRole("button", { name: "First" })
  expect(style().backgroundColor).toBe("#f7f7f7")
  await result.rerender(node("dark"))
  expect(style().backgroundColor).toBe("#202020")
  await result.rerender(node("dark", "pink"))
  expect(style().backgroundColor).toBe("pink")
  await result.rerender(node("dark", "pink", true))
  expect(style().backgroundColor).toBe("purple")
  await result.rerender(node("dark", "pink", true, true))
  expect(style().backgroundColor).toBe("green")
  await result.rerender(node("light"))
  expect(style().backgroundColor).toBe("#f7f7f7")
  expect(ref.current).toBe(original)
  expect(screen.getByRole("button", { name: "First" })).toBe(option)
  expect(option.props.accessibilityState.checked).toBe(true)
  expect(change).not.toHaveBeenCalled()
})
