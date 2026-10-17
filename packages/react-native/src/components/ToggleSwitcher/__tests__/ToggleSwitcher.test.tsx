import { act, fireEvent, render, screen, userEvent, within } from "@testing-library/react-native"
import { createRef, useState } from "react"
import { AccessibilityInfo, Animated, PlatformColor, StyleSheet, type View } from "react-native"

import {
  AVAILABLE_THEMING_ORDER_CODES,
  NativeThemeProvider,
  Text,
  ToggleSwitcher,
  useNativeTheme,
  type NativeTheme,
  type ToggleSwitcherItem,
  type ToggleSwitcherProps,
  type TNativeToggleSwitcherStyleState,
} from "../../.."

const items: readonly ToggleSwitcherItem[] = [
  { id: "and", label: "Match all" },
  { id: "or", label: "Match any" },
]
const Example = (props: Partial<ToggleSwitcherProps>) => (
  <ToggleSwitcher accessibilityLabel="Match mode" items={items} {...props} />
)
const options = () => screen.getAllByTestId("toggle-switcher-option")
const labels = () => screen.getAllByTestId("toggle-switcher-label")
const part = (id: string) => screen.getByTestId(id, { includeHiddenElements: true })
const layout = async (
  node: ReturnType<typeof screen.getByTestId>,
  x: number,
  y: number,
  width: number,
  height: number,
) => fireEvent(node, "layout", { nativeEvent: { layout: { x, y, width, height } } })
const measure = async () => {
  await layout(screen.getByTestId("toggle-switcher"), 0, 0, 156, 50)
  await layout(screen.getByTestId("toggle-switcher-row"), 3, 3, 150, 44)
  await layout(options()[0], 0, 0, 60, 44)
  await layout(options()[1], 62, 0, 88, 44)
  await layout(labels()[0], 5, 2, 50, 16)
  await layout(labels()[1], 5, 2, 78, 16)
  await layout(screen.getByTestId("toggle-switcher"), 0, 0, 184, 50)
  await layout(screen.getByTestId("toggle-switcher-row"), 3, 3, 178, 44)
  await layout(options()[0], 0, 0, 88, 44)
  await layout(options()[1], 90, 0, 88, 44)
}
beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation(() => 73)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

it("CAP.toggle-switcher.001 renders separate native button/checked targets and one decorative selected surface", async () => {
  await render(<Example />)
  expect(screen.getAllByRole("button")).toHaveLength(2)
  expect(screen.getByTestId("toggle-switcher").props.accessible).toBe(false)
  expect(screen.getByRole("button", { name: "Match all" }).props.accessibilityState).toEqual({
    checked: true,
    disabled: false,
  })
  expect(screen.getByRole("button", { name: "Match any" }).props.accessibilityState.checked).toBe(false)
  expect(screen.getAllByTestId("toggle-switcher-selected-surface", { includeHiddenElements: true })).toHaveLength(1)
  expect(part("toggle-switcher-selected-surface").props.importantForAccessibility).toBe("no-hide-descendants")
})

it("CAP.toggle-switcher.002 preserves numeric, percentage, auto and explicit zero root dimensions", async () => {
  const { rerender } = await render(<Example width={240} height={40} />)
  expect(screen.getByTestId("toggle-switcher")).toHaveStyle({ width: 240, height: 40 })
  await rerender(<Example width="100%" height="auto" />)
  expect(screen.getByTestId("toggle-switcher")).toHaveStyle({ width: "100%", height: "auto" })
  expect(options()[0]).toHaveStyle({ minHeight: 44 })
  expect(StyleSheet.flatten(options()[0].props.style).height).toBeUndefined()
  await rerender(<Example width={240} height={40} style={{ width: null, height: null }} />)
  expect(screen.getByTestId("toggle-switcher")).toHaveStyle({ width: null, height: null })
  expect(options()[0]).toHaveStyle({ minHeight: 44 })
  await rerender(<Example width={0} height={0} fontSize={0} />)
  expect(screen.getByTestId("toggle-switcher")).toHaveStyle({ width: 0, height: 0 })
  expect(screen.getByText("Match all")).toHaveStyle({ fontSize: 0 })
})

it("CAP.toggle-switcher.003/.004 directs font size and custom selected color to owned Text", async () => {
  const { rerender } = await render(<Example color="red" selectedKey="or" />)
  expect(screen.getByText("Match all")).toHaveStyle({ fontSize: 12, color: "#171717" })
  expect(screen.getByText("Match any")).toHaveStyle({ fontSize: 12, color: "red" })
  expect(screen.getByRole("button", { name: "Match any" })).toHaveStyle({ backgroundColor: "#ffffff" })
  await rerender(<Example fontSize={14} color="red" selectedKey="or" />)
  expect(screen.getByText("Match any")).toHaveStyle({ fontSize: 14 })
  expect(StyleSheet.flatten(options()[1].props.style).fontSize).toBeUndefined()
})

it.each([
  ["rounded", 5],
  ["round", 10000],
  ["orthogonal", 0],
] as const)("CAP.toggle-switcher.005 retains %s root and option geometry", async (geometry, borderRadius) => {
  await render(<Example geometry={geometry} />)
  expect(screen.getByTestId("toggle-switcher")).toHaveStyle({ borderRadius })
  for (const option of options()) expect(option).toHaveStyle({ borderRadius })
})

it.each(["light", "dark"] as const)(
  "CAP.toggle-switcher.006/.007 uses existing selected roles for every %s order",
  async (mode) => {
    let theme: NativeTheme | undefined
    const Probe = (props: Partial<ToggleSwitcherProps>) => {
      theme = useNativeTheme()
      return <Example {...props} />
    }
    const { rerender } = await render(
      <NativeThemeProvider mode={mode}>
        <Probe />
      </NativeThemeProvider>,
    )
    expect(screen.getByText("Match all")).toHaveStyle({ color: theme!.colors.controlSelectedBackground })
    for (const order of AVAILABLE_THEMING_ORDER_CODES) {
      await rerender(
        <NativeThemeProvider mode={mode}>
          <Probe order={order} />
        </NativeThemeProvider>,
      )
      expect(screen.getByText("Match all")).toHaveStyle({ color: theme!.actions[order].background })
      expect(screen.getByText("Match any")).toHaveStyle({ color: theme!.colors.controlForeground })
    }
  },
)

it("CAP.toggle-switcher.008 preserves default/first enabled selection and accepts later controlled ownership", async () => {
  const change = jest.fn()
  const { rerender } = await render(<Example defaultSelectedKey="or" onSelectionChange={change} />)
  expect(options()[1].props.accessibilityState.checked).toBe(true)
  await userEvent.setup().press(screen.getByRole("button", { name: "Match all" }))
  expect(change.mock.calls).toEqual([["and"]])
  expect(options()[0].props.accessibilityState.checked).toBe(true)
  await rerender(<Example selectedKey="or" onSelectionChange={change} />)
  expect(options()[1].props.accessibilityState.checked).toBe(true)
})

it("CAP.toggle-switcher.009 moves exactly one selected surface to the accepted current option", async () => {
  await render(<Example />)
  expect(
    within(options()[0]).getByTestId("toggle-switcher-selected-surface", { includeHiddenElements: true }),
  ).toBeOnTheScreen()
  await userEvent.setup().press(screen.getByRole("button", { name: "Match any" }))
  expect(
    within(options()[0]).queryByTestId("toggle-switcher-selected-surface", { includeHiddenElements: true }),
  ).toBeNull()
  expect(
    within(options()[1]).getByTestId("toggle-switcher-selected-surface", { includeHiddenElements: true }),
  ).toBeOnTheScreen()
})

it("CAP.toggle-switcher.010–.012 guards group disabled/read-only and option-local disabled without compound opacity or busy", async () => {
  const change = jest.fn()
  const { rerender } = await render(<Example isDisabled onSelectionChange={change} />)
  expect(screen.getByTestId("toggle-switcher")).toHaveStyle({ opacity: 0.4 })
  expect(options().every((option) => option.props.accessibilityState.disabled)).toBe(true)
  expect(StyleSheet.flatten(options()[0].props.style).opacity).toBeUndefined()
  await rerender(<Example isReadOnly onSelectionChange={change} />)
  await fireEvent.press(options()[1])
  expect(options()[1].props.focusable).toBe(true)
  expect(options()[1].props.accessibilityState).toEqual({ checked: false, disabled: false })
  expect(change).not.toHaveBeenCalled()
  await rerender(<Example items={[items[0], { ...items[1], disabled: true }]} onSelectionChange={change} />)
  expect(screen.getByTestId("toggle-switcher")).toHaveStyle({ opacity: 1 })
  expect(options()[1].props.accessibilityState.disabled).toBe(true)
  await rerender(<Example isDisabled={false} isReadOnly={false} onSelectionChange={change} />)
  await fireEvent.press(options()[1])
  expect(change.mock.calls).toEqual([["or"]])
})

it("CAP.toggle-switcher.013 preserves focus opt-outs, raised false, uppercase and both font weights", async () => {
  const { rerender } = await render(
    <Example raised uppercase optionFontWeight="bold" selectedOptionFontWeight="extrabold" />,
  )
  expect(screen.getByTestId("toggle-switcher")).toHaveStyle({ shadowOpacity: 0.24 })
  expect(screen.getByText("Match all")).toHaveStyle({ fontWeight: "800", textTransform: "uppercase" })
  expect(screen.getByText("Match any")).toHaveStyle({ fontWeight: "700", textTransform: "uppercase" })
  await fireEvent(options()[0], "focus", {})
  expect(options()[0]).toHaveStyle({ outlineWidth: 1.5, outlineOffset: 1.5 })
  await rerender(<Example enableFocusStyle={false} offsetFocusRing={false} raised={false} />)
  expect(StyleSheet.flatten(options()[0].props.style).outlineWidth).toBeUndefined()
  expect(StyleSheet.flatten(screen.getByTestId("toggle-switcher").props.style).shadowOpacity).toBeUndefined()
})

it("CAP.toggle-switcher.014/.015 keeps root, option and selected-slot precedence with registered native colors and typography", async () => {
  const color = PlatformColor("systemBlueColor")
  const registered = StyleSheet.create({ option: { minHeight: 32, color, fontSize: 16, letterSpacing: 1 } })
  const states: TNativeToggleSwitcherStyleState[] = []
  await render(
    <Example
      selectedKey="or"
      customStyles={{ height: 40, backgroundColor: "yellow" }}
      style={(state) => {
        states.push(state)
        return { width: 240 }
      }}
      customOptionStyles={[false, registered.option]}
      customSelectedOptionStyles={{ color: "teal", fontWeight: "800", borderRadius: 3, backgroundColor: "purple" }}
    />,
  )
  expect(screen.getByTestId("toggle-switcher")).toHaveStyle({ height: 40, width: 240, backgroundColor: "yellow" })
  expect(states.at(-1)).toMatchObject({ selectedKey: "or", defaultStyle: { height: 40, backgroundColor: "yellow" } })
  expect(screen.getByText("Match all")).toHaveStyle({ color, fontSize: 16, letterSpacing: 1 })
  expect(screen.getByText("Match any")).toHaveStyle({ color: "teal", fontWeight: "800" })
  expect(options()[1]).toHaveStyle({ minHeight: 32, borderRadius: 3, backgroundColor: "purple" })
  expect(part("toggle-switcher-selected-surface")).toHaveStyle({ backgroundColor: "purple", borderRadius: 3 })
  for (const key of ["color", "fontWeight", "fontSize", "letterSpacing"])
    expect(StyleSheet.flatten(options()[1].props.style)[key]).toBeUndefined()
})

it("CAP.toggle-switcher.016 forwards the root View ref, native aliases/layout payload and consumes wrapper fields", async () => {
  const ref = createRef<View>(),
    onLayout = jest.fn()
  await render(
    <ToggleSwitcher
      ref={ref}
      items={items}
      testID="native"
      data-testid="alias"
      accessibilityLabel="Native"
      aria-label="Alias"
      width={240}
      height={40}
      color="red"
      geometry="round"
      order="primary"
      raised
      uppercase
      fontSize={14}
      isDisabled
      isReadOnly
      enableFocusStyle={false}
      offsetFocusRing={false}
      optionFontWeight="bold"
      selectedOptionFontWeight="bold"
      customStyles={{ marginTop: 5 }}
      customOptionStyles={{ minHeight: 32 }}
      customSelectedOptionStyles={{ color: "teal" }}
      onLayout={onLayout}
    />,
  )
  const root = screen.getByTestId("native")
  expect(root.props.accessibilityLabel).toBe("Native")
  expect(typeof ref.current?.measure).toBe("function")
  const event = { nativeEvent: { layout: { x: 1, y: 2, width: 240, height: 40 } } }
  await fireEvent(root, "layout", event)
  expect(onLayout).toHaveBeenCalledWith(event)
  expect(screen.queryByTestId("alias")).toBeNull()
  for (const key of [
    "items",
    "selectedKey",
    "defaultSelectedKey",
    "onSelectionChange",
    "color",
    "geometry",
    "order",
    "raised",
    "width",
    "height",
    "fontSize",
    "uppercase",
    "isDisabled",
    "isReadOnly",
    "enableFocusStyle",
    "offsetFocusRing",
    "customStyles",
    "customOptionStyles",
    "customSelectedOptionStyles",
    "optionFontWeight",
    "selectedOptionFontWeight",
  ])
    expect(root.props[key]).toBeUndefined()
})

it("NATIVE.switcher.selection preserves repeated controlled vetoes, empty keys, reselect suppression and removal/reinsertion", async () => {
  const change = jest.fn()
  const choices = [{ id: "", label: "Empty key" }, ...items]
  const { rerender } = await render(<Example items={choices} selectedKey="" onSelectionChange={change} />)
  await fireEvent.press(options()[0])
  await fireEvent.press(options()[1])
  await fireEvent.press(options()[1])
  expect(change.mock.calls).toEqual([["and"], ["and"]])
  expect(options()[0].props.accessibilityState.checked).toBe(true)
  await rerender(<Example items={items} selectedKey="" onSelectionChange={change} />)
  expect(options().some((option) => option.props.accessibilityState.checked)).toBe(false)
  await rerender(<Example items={[...items].reverse().concat(choices[0])} selectedKey="" onSelectionChange={change} />)
  expect(options()[2].props.accessibilityState.checked).toBe(true)
  expect(change).toHaveBeenCalledTimes(2)
})

it("NATIVE.switcher.selection reads first-enabled/default only once and supports empty/all-disabled collections", async () => {
  const { rerender } = await render(<Example items={[]} />)
  expect(screen.queryAllByRole("button")).toHaveLength(0)
  await rerender(<Example />)
  expect(options().some((option) => option.props.accessibilityState.checked)).toBe(false)
  await rerender(<Example key="fresh" items={[{ ...items[0], disabled: true }, items[1]]} />)
  expect(options()[1].props.accessibilityState.checked).toBe(true)
  await rerender(<Example key="disabled" items={items.map((item) => ({ ...item, disabled: true }))} />)
  expect(options().some((option) => option.props.accessibilityState.checked)).toBe(false)
})

it("NATIVE.switcher.selection retains a removed key while retiring its measured frame before reinsertion", async () => {
  const change = jest.fn()
  const { rerender } = await render(<Example selectedKey="and" onSelectionChange={change} />)
  await measure()
  await rerender(<Example items={[items[1]]} selectedKey="and" onSelectionChange={change} />)
  await rerender(<Example selectedKey="and" onSelectionChange={change} />)
  expect(options()[0].props.accessibilityState.checked).toBe(true)
  expect(part("toggle-switcher-selected-surface")).toHaveStyle({ opacity: 0 })
  expect(change).not.toHaveBeenCalled()
})

it("NATIVE.switcher.layout measures intrinsic equal columns, bounds them to actual row width and preserves authored label instances", async () => {
  const initialize = jest.fn()
  const Label = () => {
    useState(() => initialize())
    return <Text>Stateful label</Text>
  }
  const choices = [{ id: "and", label: <Label /> }, items[1]]
  const { rerender } = await render(<Example items={choices} />)
  await measure()
  expect(screen.getByTestId("toggle-switcher")).toHaveStyle({ width: 184 })
  for (const option of options()) expect(option).toHaveStyle({ width: 88 })
  await layout(screen.getByTestId("toggle-switcher"), 0, 0, 210, 50)
  expect(screen.getByTestId("toggle-switcher")).toHaveStyle({ width: 184 })
  await layout(screen.getByTestId("toggle-switcher"), 0, 0, 100, 50)
  await layout(screen.getByTestId("toggle-switcher-row"), 3, 3, 94, 44)
  for (const option of options()) expect(option).toHaveStyle({ width: 46 })
  await rerender(<Example items={choices} fontSize={16} />)
  expect(initialize).toHaveBeenCalledTimes(1)
})

it("NATIVE.switcher.guards cancels a started contact across read-only takeover and does not synthesize selection", async () => {
  const change = jest.fn(),
    event = { nativeEvent: { timestamp: 10 } }
  const { rerender } = await render(<Example onSelectionChange={change} />)
  await fireEvent(options()[1], "pressIn", event)
  await rerender(<Example isReadOnly onSelectionChange={change} />)
  await rerender(<Example onSelectionChange={change} />)
  await fireEvent(options()[1], "pressOut", event)
  await fireEvent.press(options()[1], event)
  expect(change).not.toHaveBeenCalled()
})

it("NATIVE.switcher.layout remeasures unchanged views and rejects callbacks from the retired measurement pass", async () => {
  const ref = createRef<View>()
  const { rerender } = await render(<ToggleSwitcher ref={ref} items={items} />)
  const pending: Array<Parameters<View["measure"]>[0]> = []
  jest.spyOn(ref.current!, "measure").mockImplementation((callback) => pending.push(callback))
  const initialFrames = jest.mocked(requestAnimationFrame).mock.calls.map(([callback]) => callback)
  await act(() => initialFrames.forEach((callback) => callback(0)))
  expect(pending).toHaveLength(4)
  const old = pending.splice(0)
  await rerender(<ToggleSwitcher ref={ref} items={items} fontSize={16} />)
  const currentFrames = jest
    .mocked(requestAnimationFrame)
    .mock.calls.slice(initialFrames.length)
    .map(([callback]) => callback)
  await act(() => currentFrames.forEach((callback) => callback(0)))
  expect(pending).toHaveLength(4)
  await layout(screen.getByTestId("toggle-switcher"), 0, 0, 156, 50)
  await layout(screen.getByTestId("toggle-switcher-row"), 3, 3, 150, 44)
  await act(() => {
    for (const [index, callback] of pending.entries()) {
      const width = [60, 50, 88, 78][index]
      callback(0, 0, width, index % 2 ? 16 : 44, 0, 0)
    }
  })
  expect(screen.getByTestId("toggle-switcher")).toHaveStyle({ width: 184 })
  await act(() => old.forEach((callback) => callback(0, 0, 999, 999, 0, 0)))
  expect(screen.getByTestId("toggle-switcher")).toHaveStyle({ width: 184 })
})

it.each([
  ["lighter", "300"],
  ["light", "300"],
  ["normal", "400"],
  ["regular", "400"],
  ["medium", "500"],
  ["semibold", "600"],
  ["bold", "700"],
  ["extrabold", "800"],
  ["bolder", "800"],
] as const)("NATIVE.switcher.typography maps %s using existing native weights", async (weight, expected) => {
  await render(<Example optionFontWeight={weight} selectedOptionFontWeight={weight} />)
  expect(screen.getByText("Match all")).toHaveStyle({ fontWeight: expected })
  expect(screen.getByText("Match any")).toHaveStyle({ fontWeight: expected })
})

it("NATIVE.switcher.theme updates current provider roles while keeping the controlled key and canonical muted defaults", async () => {
  const { rerender } = await render(
    <NativeThemeProvider>
      <Example selectedKey="or" />
    </NativeThemeProvider>,
  )
  expect(screen.getByTestId("toggle-switcher")).toHaveStyle({ backgroundColor: "#f7f7f7", borderColor: "#c6c6c6" })
  await rerender(
    <NativeThemeProvider mode="dark" overrides={{ colors: { controlSelectedBackground: "purple" } }}>
      <Example selectedKey="or" />
    </NativeThemeProvider>,
  )
  expect(screen.getByTestId("toggle-switcher")).toHaveStyle({ backgroundColor: "#202020", borderColor: "#3d3d3d" })
  expect(screen.getByText("Match any")).toHaveStyle({ color: "purple" })
  expect(options()[1].props.accessibilityState.checked).toBe(true)
})

it("NATIVE.switcher.motion animates accepted native rectangles with one 250ms surface and cancels removal", async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false)
  const timings: Array<{ value: Animated.Value; config: Animated.TimingAnimationConfig }> = []
  jest.spyOn(Animated, "timing").mockImplementation((value, config) => {
    timings.push({ value: value as Animated.Value, config })
    return { start: jest.fn(), stop: jest.fn(), reset: jest.fn() }
  })
  const handles: Array<{ start: jest.Mock; stop: jest.Mock; reset: jest.Mock }> = []
  jest.spyOn(Animated, "parallel").mockImplementation(() => {
    const handle = { start: jest.fn(), stop: jest.fn(), reset: jest.fn() }
    handles.push(handle)
    return handle
  })
  const change = jest.fn()
  const { rerender, unmount } = await render(<Example selectedKey="and" onSelectionChange={change} />)
  await measure()
  timings.length = 0
  handles.length = 0
  await fireEvent.press(options()[1])
  expect(timings).toHaveLength(0)
  await rerender(<Example selectedKey="or" onSelectionChange={change} />)
  expect(timings).toHaveLength(4)
  for (const { config } of timings) {
    expect(config).toMatchObject({ duration: 250, useNativeDriver: true, isInteraction: false })
    expect(config.easing?.(0.25)).toBeCloseTo(0.12916, 4)
  }
  expect(part("toggle-switcher-selected-surface")).toHaveStyle({
    opacity: 0,
    transform: [{ translateX: -90 }, { translateY: 0 }, { scale: 0.92 }],
  })
  await act(() => timings.forEach(({ value, config }) => value.setValue(config.toValue as number)))
  expect(part("toggle-switcher-selected-surface")).toHaveStyle({
    opacity: 1,
    transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }],
  })
  await unmount()
  expect(handles.at(-1)?.stop).toHaveBeenCalledTimes(1)
})

it("NATIVE.switcher.motion ignores retired native stop callbacks after removal", async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false)
  const pending: Array<(value: number) => void> = []
  jest.spyOn(Animated.Value.prototype, "stopAnimation").mockImplementation((callback) => {
    if (callback) pending.push(callback)
  })
  const timing = jest.spyOn(Animated, "timing")
  const { unmount } = await render(<Example />)
  await measure()
  expect(pending.length).toBeGreaterThan(0)
  await unmount()
  await act(() => pending.forEach((callback) => callback(0)))
  expect(timing).not.toHaveBeenCalled()
})

it("NATIVE.switcher.motion finishes an interrupted fade even when a new layout cancels its remaining translation", async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false)
  const timings: Array<{ value: Animated.Value; config: Animated.TimingAnimationConfig }> = []
  jest.spyOn(Animated, "timing").mockImplementation((value, config) => {
    timings.push({ value: value as Animated.Value, config })
    return { start: jest.fn(), stop: jest.fn(), reset: jest.fn() }
  })
  jest.spyOn(Animated, "parallel").mockImplementation(() => ({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() }))
  const { rerender } = await render(<Example selectedKey="and" />)
  await measure()
  timings.length = 0
  await rerender(<Example selectedKey="or" />)
  await act(() =>
    timings.forEach(({ value, config }, index) =>
      value.setValue(config.toValue === 0 ? (index === 0 ? -30 : 0) : index === 2 ? 0.5 : 0.96),
    ),
  )
  timings.length = 0
  await layout(options()[1], 60, 0, 88, 44)
  expect(timings).toHaveLength(4)
  expect(part("toggle-switcher-selected-surface")).toHaveStyle({
    opacity: 0.5,
    transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 0.96 }],
  })
  await act(() => timings.forEach(({ value, config }) => value.setValue(config.toValue as number)))
  expect(part("toggle-switcher-selected-surface")).toHaveStyle({
    opacity: 1,
    transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }],
  })
})

it("NATIVE.switcher.motion stays static when the preference query fails", async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockRejectedValue(new Error("Unavailable"))
  const timing = jest.spyOn(Animated, "timing")
  await render(<Example />)
  await measure()
  expect(timing).not.toHaveBeenCalled()
  expect(part("toggle-switcher-selected-surface")).toHaveStyle({
    opacity: 1,
    transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }],
  })
})

it("NATIVE.switcher.motion hands a stopped visual position across rapid accepted option changes", async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false)
  const timings: Array<{ value: Animated.Value; config: Animated.TimingAnimationConfig }> = []
  jest.spyOn(Animated, "timing").mockImplementation((value, config) => {
    timings.push({ value: value as Animated.Value, config })
    return { start: jest.fn(), stop: jest.fn(), reset: jest.fn() }
  })
  jest.spyOn(Animated, "parallel").mockImplementation(() => ({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() }))
  const { rerender } = await render(<Example selectedKey="and" />)
  await measure()
  await act(() => timings.forEach(({ value, config }) => value.setValue(config.toValue as number)))
  timings.length = 0
  await rerender(<Example selectedKey="or" />)
  const movingX = timings[0].value
  await act(() =>
    timings.forEach(({ value, config }, index) =>
      value.setValue(config.toValue === 0 ? (index === 0 ? -45 : 0) : index === 2 ? 0.5 : 0.96),
    ),
  )
  timings.length = 0
  await rerender(<Example selectedKey="and" />)
  expect(timings[0].value === movingX).toBe(true)
  expect(part("toggle-switcher-selected-surface")).toHaveStyle({
    opacity: 0,
    transform: [{ translateX: 45 }, { translateY: 0 }, { scale: 0.92 }],
  })
})

it("NATIVE.switcher.motion keeps the last applied coordinate basis when native stop callbacks are superseded", async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false)
  const timings: Array<{ value: Animated.Value; config: Animated.TimingAnimationConfig }> = []
  jest.spyOn(Animated, "timing").mockImplementation((value, config) => {
    timings.push({ value: value as Animated.Value, config })
    return { start: jest.fn(), stop: jest.fn(), reset: jest.fn() }
  })
  jest.spyOn(Animated, "parallel").mockImplementation(() => ({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() }))
  const { rerender } = await render(<Example selectedKey="and" />)
  await measure()
  await act(() => timings.forEach(({ value, config }) => value.setValue(config.toValue as number)))
  const pending: Array<(value: number) => void> = []
  jest.spyOn(Animated.Value.prototype, "stopAnimation").mockImplementation((callback) => {
    if (callback) pending.push(callback)
  })
  await rerender(<Example selectedKey="or" />)
  await layout(options()[1], 120, 0, 88, 44)
  await layout(options()[1], 150, 0, 88, 44)
  const retired = pending.slice(0, -4),
    latest = pending.slice(-4)
  await act(() => retired.forEach((callback, index) => callback(index % 4 < 2 ? 1 : 0)))
  await act(() => latest.forEach((callback, index) => callback(index < 2 ? 1 : 0)))
  expect(part("toggle-switcher-selected-surface")).toHaveStyle({
    opacity: 0,
    transform: [{ translateX: -150 }, { translateY: 0 }, { scale: 0.92 }],
  })
})

it("NATIVE.switcher.motion preserves a live Reduce Motion event over late preference readiness and removes listeners", async () => {
  let finish: (value: boolean) => void = () => undefined
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve
    }),
  )
  const { unmount } = await render(<Example />)
  await measure()
  const listener = jest.mocked(AccessibilityInfo.addEventListener).mock.calls.at(-1)![1] as unknown as (
    value: boolean,
  ) => void
  const subscription = jest.mocked(AccessibilityInfo.addEventListener).mock.results.at(-1)!.value
  await act(() => listener(true))
  await act(() => finish(false))
  expect(part("toggle-switcher-selected-surface")).toHaveStyle({
    opacity: 1,
    transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }],
  })
  await unmount()
  expect(subscription.remove).toHaveBeenCalledTimes(1)
})

it("NATIVE.switcher.validation rejects duplicate keys and unsupported static/color/time-independent typography inputs", async () => {
  await expect(render(<Example items={[items[0], items[0]]} />)).rejects.toThrow(/unique strings/)
  await expect(render(<Example fontSize={NaN} />)).rejects.toThrow(/fontSize/)
  await expect(render(<Example width={-1} />)).rejects.toThrow(/width/)
  await expect(render(<Example color="var(--bad)" />)).rejects.toThrow(/unsupported native color/)
})
