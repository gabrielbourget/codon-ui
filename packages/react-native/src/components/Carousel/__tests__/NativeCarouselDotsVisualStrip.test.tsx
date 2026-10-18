import { act, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { AccessibilityInfo, Animated, StyleSheet, View } from "react-native"

import { NativeThemeProvider } from "../../../theme"
import { NativeCarouselDotsViewport, NativeCarouselDotsVisualStrip } from "../NativeCarouselDotsVisualStrip"

import oracle from "./fixtures/dotsWindowOracle.json"

const hidden = { includeHiddenElements: true }
const part = (suffix = "") => screen.getByTestId(`strip${suffix}`, hidden)
type TFrameCallback = Parameters<typeof requestAnimationFrame>[0]
let nextFrame: number
let pendingFrames: Map<number, TFrameCallback>
let allFrames: Map<number, TFrameCallback>

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  nextFrame = 1
  pendingFrames = new Map()
  allFrames = new Map()
  jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
    const id = nextFrame++
    pendingFrames.set(id, callback)
    allFrames.set(id, callback)
    return id
  })
  jest.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => {
    if (id !== null && id !== undefined) pendingFrames.delete(id)
  })
})
afterEach(() => jest.restoreAllMocks())

const flushFrame = async () => {
  const callbacks = [...pendingFrames.values()]
  pendingFrames.clear()
  await act(() => callbacks.forEach((callback) => callback(16)))
}

it.each([0, 1])("retains an empty native tree for itemCount %s", async (itemCount) => {
  await render(<NativeCarouselDotsVisualStrip itemCount={itemCount} selectedIndex={0} testID="strip" />)
  expect(screen.queryByTestId("strip", hidden)).toBeNull()
})

it("composes the passive branch as one clipped viewport, fixed track and shrinkable decorative dots", async () => {
  await render(<NativeCarouselDotsVisualStrip itemCount={10} selectedIndex={5} raised testID="strip" />)
  expect(part().props).toMatchObject({
    accessible: false,
    accessibilityElementsHidden: true,
    importantForAccessibility: "no-hide-descendants",
  })
  expect(part()).toHaveStyle({ flexDirection: "row", alignItems: "center", gap: 5 })
  expect(part("-viewport")).toHaveStyle({
    width: 86,
    paddingVertical: 5,
    flexShrink: 1,
    overflow: "hidden",
    justifyContent: "center",
  })
  expect(part("-track")).toHaveStyle({ width: 86, flexShrink: 0, gap: 5, transform: [{ translateX: -26 }] })
  expect(screen.getAllByTestId(/^strip-dot-/, hidden)).toHaveLength(10)
  expect(part("-dot-5")).toHaveStyle({
    width: 8,
    height: 8,
    flexShrink: 1,
    backgroundColor: "#2563eb",
    transform: [{ scale: 1.15 }],
    elevation: 2,
  })
  expect(part("-dot-0")).toHaveStyle({ opacity: 0, transform: [{ scale: 0.4 }] })
  expect(screen.queryByRole("radio")).toBeNull()
  expect(screen.queryByRole("radiogroup")).toBeNull()
})

it.each([
  [0, 86],
  [3, 86],
  [7, 86],
  [9, 112],
  [40, 151],
])("keeps maxVisible %s inside the seven-minimum/collection limit", async (maxVisible, width) => {
  const owner = Object.freeze({ itemCount: 12, selectedIndex: 0, maxVisible })
  await render(<NativeCarouselDotsVisualStrip {...owner} testID="strip" />)
  expect(part("-track")).toHaveStyle({ width })
  expect(screen.getAllByTestId(/^strip-dot-/, hidden)).toHaveLength(12)
  expect(owner).toEqual({ itemCount: 12, selectedIndex: 0, maxVisible })
})

it.each([
  [0, false, true],
  [5, true, true],
  [9, true, false],
])("shows only the applicable overflow sentinels at selection %s", async (selectedIndex, left, right) => {
  await render(
    <NativeCarouselDotsVisualStrip
      itemCount={10}
      selectedIndex={selectedIndex}
      raised
      showOverflowSentinels
      testID="strip"
    />,
  )
  expect(Boolean(screen.queryByTestId("strip-left-sentinel", hidden))).toBe(left)
  expect(Boolean(screen.queryByTestId("strip-right-sentinel", hidden))).toBe(right)
  for (const suffix of ["-left-sentinel", "-right-sentinel"]) {
    const sentinel = screen.queryByTestId(`strip${suffix}`, hidden)
    if (sentinel) {
      expect(sentinel).toHaveStyle({ width: 6, height: 6, opacity: 0.4, backgroundColor: "#ffffff", flexShrink: 1 })
      expect(sentinel).not.toHaveStyle({ elevation: 2 })
    }
  }
})

it("keeps sentinels off by default and removes both when the collection fits", async () => {
  const { rerender } = await render(<NativeCarouselDotsVisualStrip itemCount={10} selectedIndex={5} testID="strip" />)
  expect(screen.queryByTestId("strip-left-sentinel", hidden)).toBeNull()
  expect(screen.queryByTestId("strip-right-sentinel", hidden)).toBeNull()
  await rerender(<NativeCarouselDotsVisualStrip itemCount={4} selectedIndex={1} showOverflowSentinels testID="strip" />)
  expect(part("-track")).toHaveStyle({ width: 47 })
  expect(StyleSheet.flatten(part("-track").props.style).transform[0].translateX).toBeCloseTo(0)
  expect(screen.queryByTestId("strip-left-sentinel", hidden)).toBeNull()
  expect(screen.queryByTestId("strip-right-sentinel", hidden)).toBeNull()
})

it("preserves registered/final root styles, explicit zero and inherited RTL without overwriting track geometry", async () => {
  const styles = StyleSheet.create({
    custom: { width: 40, padding: 3, gap: 2 },
    final: { width: 0, gap: 0, direction: "rtl" },
  })
  await render(
    <NativeCarouselDotsVisualStrip
      itemCount={10}
      selectedIndex={5}
      customStyles={styles.custom}
      style={[styles.final, { transform: [{ rotate: "10deg" }] }]}
      testID="strip"
    />,
  )
  expect(part()).toHaveStyle({ width: 0, padding: 3, gap: 0, direction: "rtl", transform: [{ rotate: "10deg" }] })
  expect(part("-track")).toHaveStyle({ width: 86, flexShrink: 0, gap: 5, transform: [{ translateX: -26 }] })
  expect(part("-viewport")).toHaveStyle({ width: 86, flexShrink: 1 })
})

it("updates paint and zero spacing without recreating the selected window or caller values", async () => {
  const owner = Object.freeze({ itemCount: 10, selectedIndex: 5, showOverflowSentinels: true })
  const { rerender } = await render(
    <NativeThemeProvider>
      <NativeCarouselDotsVisualStrip {...owner} testID="strip" />
    </NativeThemeProvider>,
  )
  await rerender(
    <NativeThemeProvider
      mode="dark"
      overrides={{ spacing: { unit: 0 }, colors: { controlSelectedBackground: "orange", controlBorder: "purple" } }}
    >
      <NativeCarouselDotsVisualStrip {...owner} testID="strip" />
    </NativeThemeProvider>,
  )
  expect(part("-track")).toHaveStyle({ width: 56, gap: 0, transform: [{ translateX: -16 }] })
  expect(part("-viewport")).toHaveStyle({ paddingVertical: 0 })
  expect(part("-dot-5")).toHaveStyle({ backgroundColor: "orange" })
  expect(part("-dot-4")).toHaveStyle({ backgroundColor: "purple" })
  expect(part("-left-sentinel")).toHaveStyle({ backgroundColor: "#ffffff" })
  expect(owner).toEqual({ itemCount: 10, selectedIndex: 5, showOverflowSentinels: true })
})

it.each(oracle.sequences)(
  "wires actual native track positions through the web window timeline: $name",
  async (sequence) => {
    const propsFor = (input: (typeof sequence.steps)[0]["input"]) => ({
      itemCount: input.itemCount,
      selectedIndex: input.selectedIndex,
      maxVisible: input.itemCount - input.maxStart,
    })
    const { rerender } = await render(
      <NativeCarouselDotsVisualStrip {...propsFor(sequence.steps[0].input)} testID="strip" />,
    )
    const check = (step: (typeof sequence.steps)[0], state: typeof step.beforeFrames) => {
      if (step.input.itemCount <= 1) expect(screen.queryByTestId("strip", hidden)).toBeNull()
      else {
        expect(part("-track")).toHaveStyle({ transform: [{ translateX: -13 * state.windowStart }] })
        expect(screen.getAllByTestId(/^strip-dot-/, hidden)).toHaveLength(step.input.itemCount)
      }
    }
    for (const [index, step] of sequence.steps.entries()) {
      if (index) await rerender(<NativeCarouselDotsVisualStrip {...propsFor(step.input)} testID="strip" />)
      check(step, step.beforeFrames)
      for (const expected of step.afterFrames) {
        await flushFrame()
        check(step, expected)
      }
    }
  },
)

const captureMotion = () => {
  const animations: {
    value: Animated.Value
    config: Animated.TimingAnimationConfig
    start: jest.Mock
    stop: jest.Mock
  }[] = []
  jest.spyOn(Animated, "timing").mockImplementation((value, config) => {
    const animation = { value: value as Animated.Value, config, start: jest.fn(), stop: jest.fn(), reset: jest.fn() }
    animations.push(animation)
    return animation
  })
  return animations
}

it("animates the track from its interrupted position with 250ms CSS ease and preserves child refs", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
  const animations = captureMotion()
  const child = createRef<View>()
  const { rerender, unmount } = await render(
    <NativeCarouselDotsViewport visibleCount={7} windowStart={0} noTransition={false} testID="strip">
      <View ref={child} />
    </NativeCarouselDotsViewport>,
  )
  const host = child.current
  expect(animations).toHaveLength(0)
  await rerender(
    <NativeCarouselDotsViewport visibleCount={7} windowStart={2} noTransition={false} testID="strip">
      <View ref={child} />
    </NativeCarouselDotsViewport>,
  )
  expect(child.current).toBe(host)
  expect(animations[0].config).toMatchObject({
    toValue: -26,
    duration: 250,
    useNativeDriver: true,
    isInteraction: false,
  })
  expect(animations[0].config.easing?.(0.5)).toBeCloseTo(0.8024, 3)
  await act(() => animations[0].value.setValue(-8))
  expect(part("-track")).toHaveStyle({ transform: [{ translateX: -8 }] })
  await rerender(
    <NativeCarouselDotsViewport visibleCount={7} windowStart={3} noTransition={false} testID="strip">
      <View ref={child} />
    </NativeCarouselDotsViewport>,
  )
  expect(animations[0].stop).toHaveBeenCalledTimes(1)
  expect(animations[1].value).toBe(animations[0].value)
  expect(animations[1].config.toValue).toBe(-39)
  expect(part("-track")).toHaveStyle({ transform: [{ translateX: -8 }] })
  await unmount()
  expect(animations[1].stop).toHaveBeenCalledTimes(1)
  expect(child.current).toBeNull()
})

it("snaps and cancels suppressed track motion, then keeps the snap when transitions are re-enabled", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
  const animations = captureMotion()
  const { rerender } = await render(
    <NativeCarouselDotsViewport visibleCount={7} windowStart={0} noTransition={false} testID="strip">
      {null}
    </NativeCarouselDotsViewport>,
  )
  await rerender(
    <NativeCarouselDotsViewport visibleCount={7} windowStart={2} noTransition={false} testID="strip">
      {null}
    </NativeCarouselDotsViewport>,
  )
  await act(() => animations[0].value.setValue(-8))
  await rerender(
    <NativeCarouselDotsViewport visibleCount={7} windowStart={13} noTransition testID="strip">
      {null}
    </NativeCarouselDotsViewport>,
  )
  expect(animations[0].stop).toHaveBeenCalledTimes(1)
  expect(part("-track")).toHaveStyle({ transform: [{ translateX: -169 }] })
  await rerender(
    <NativeCarouselDotsViewport visibleCount={7} windowStart={13} noTransition={false} testID="strip">
      {null}
    </NativeCarouselDotsViewport>,
  )
  expect(animations).toHaveLength(1)
  expect(part("-track")).toHaveStyle({ transform: [{ translateX: -169 }] })
  await rerender(
    <NativeCarouselDotsViewport visibleCount={7} windowStart={12} noTransition={false} testID="strip">
      {null}
    </NativeCarouselDotsViewport>,
  )
  expect(animations[1].config.toValue).toBe(-156)
})

it("keeps full-strip wraps immediate through two frames, ignores replaced frames and resumes ordinary movement", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
  const animations = captureMotion()
  const { rerender, unmount } = await render(
    <NativeCarouselDotsVisualStrip itemCount={20} selectedIndex={0} testID="strip" />,
  )
  await rerender(<NativeCarouselDotsVisualStrip itemCount={20} selectedIndex={19} testID="strip" />)
  const staleFrame = nextFrame - 1
  expect(part("-track")).toHaveStyle({ transform: [{ translateX: -169 }] })
  await rerender(<NativeCarouselDotsVisualStrip itemCount={20} selectedIndex={0} testID="strip" />)
  await act(() => allFrames.get(staleFrame)!(16))
  expect(StyleSheet.flatten(part("-track").props.style).transform[0].translateX).toBeCloseTo(0)
  await flushFrame()
  expect(animations.filter(({ config }) => Number(config.toValue) < 0)).toHaveLength(0)
  await flushFrame()
  await rerender(<NativeCarouselDotsVisualStrip itemCount={20} selectedIndex={10} testID="strip" />)
  expect(animations.filter(({ config }) => Number(config.toValue) < 0).at(-1)?.config.toValue).toBe(-78)
  await unmount()
  expect(pendingFrames.size).toBe(0)
})

it("makes live Reduce Motion authoritative over a late query and retires the track subscription", async () => {
  let resolvePreference: ((enabled: boolean) => void) | undefined
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockReturnValue(
    new Promise((resolve) => {
      resolvePreference = resolve
    }),
  )
  const subscriptions = jest.spyOn(AccessibilityInfo, "addEventListener")
  const animations = captureMotion()
  const { rerender, unmount } = await render(
    <NativeCarouselDotsViewport visibleCount={7} windowStart={0} noTransition={false} testID="strip">
      {null}
    </NativeCarouselDotsViewport>,
  )
  const notify = subscriptions.mock.calls.at(-1)![1] as unknown as (enabled: boolean) => void
  const subscription = subscriptions.mock.results.at(-1)!.value
  await act(() => notify(false))
  await rerender(
    <NativeCarouselDotsViewport visibleCount={7} windowStart={2} noTransition={false} testID="strip">
      {null}
    </NativeCarouselDotsViewport>,
  )
  expect(animations).toHaveLength(1)
  await act(() => notify(true))
  expect(animations[0].stop).toHaveBeenCalledTimes(1)
  expect(part("-track")).toHaveStyle({ transform: [{ translateX: -26 }] })
  await act(() => resolvePreference?.(false))
  await rerender(
    <NativeCarouselDotsViewport visibleCount={7} windowStart={3} noTransition={false} testID="strip">
      {null}
    </NativeCarouselDotsViewport>,
  )
  expect(animations).toHaveLength(1)
  expect(part("-track")).toHaveStyle({ transform: [{ translateX: -39 }] })
  await unmount()
  expect(subscription.remove).toHaveBeenCalledTimes(1)
  await act(() => notify(false))
  expect(animations).toHaveLength(1)
})
