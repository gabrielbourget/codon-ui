import { act, render, screen } from "@testing-library/react-native"
import { AccessibilityInfo, Animated, Easing } from "react-native"

import { NativeThemeProvider } from "../../../theme"
import { NATIVE_CAROUSEL_DOT_VARIANTS } from "../dotsModel"
import { NativeCarouselDotVisual } from "../NativeCarouselDotVisual"

const dot = () => screen.getByTestId("dot", { includeHiddenElements: true })

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => jest.restoreAllMocks())

it.each([
  ["active", 8, 1.15, 1, "#2563eb"],
  ["default", 8, 1, 1, "#9e9e9e"],
  ["near", 8, 0.8, 1, "#9e9e9e"],
  ["far", 8, 0.65, 0.9, "#9e9e9e"],
  ["hidden", 8, 0.4, 0, "#9e9e9e"],
  ["sentinel", 6, 1, 0.4, "#ffffff"],
] as const)(
  "renders the canonical %s graphic without an accessible or touch target",
  async (variant, size, scale, opacity, backgroundColor) => {
    await render(<NativeCarouselDotVisual variant={variant} testID="dot" />)
    expect(dot()).toHaveStyle({
      width: size,
      height: size,
      borderRadius: 10000,
      transform: [{ scale }],
      opacity,
      backgroundColor,
    })
    expect(dot().props).toMatchObject({
      accessible: false,
      accessibilityElementsHidden: true,
      importantForAccessibility: "no-hide-descendants",
      pointerEvents: "none",
    })
    expect(dot().props.onPress).toBeUndefined()
    expect(screen.queryByRole("radio")).toBeNull()
  },
)

it("updates theme paint, raised state and supplied focus-visible decoration on the existing host", async () => {
  const { rerender } = await render(
    <NativeThemeProvider>
      <NativeCarouselDotVisual variant="active" testID="dot" />
    </NativeThemeProvider>,
  )
  await rerender(
    <NativeThemeProvider
      mode="dark"
      overrides={{ colors: { controlSelectedBackground: "orange", controlBorder: "purple", focusRing: "pink" } }}
    >
      <NativeCarouselDotVisual variant="active" raised focusVisible testID="dot" />
    </NativeThemeProvider>,
  )
  expect(dot()).toHaveStyle({
    backgroundColor: "orange",
    shadowOpacity: 0.24,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    outlineWidth: 1,
    outlineColor: "pink",
    outlineOffset: 2,
  })
  await rerender(
    <NativeThemeProvider mode="dark" overrides={{ colors: { controlBorder: "purple" } }}>
      <NativeCarouselDotVisual variant="far" raised={false} focusVisible={false} testID="dot" />
    </NativeThemeProvider>,
  )
  expect(dot()).toHaveStyle({ backgroundColor: "purple", opacity: 0.9, transform: [{ scale: 0.65 }] })
  expect(dot()).not.toHaveStyle({ outlineWidth: 1 })
})

const captureMotion = () => {
  const animations: {
    value: Animated.Value
    config: Animated.TimingAnimationConfig
    start: jest.Mock
    stop: jest.Mock
  }[] = []
  const timing = jest.spyOn(Animated, "timing").mockImplementation((value, config) => {
    const animation = { value: value as Animated.Value, config, start: jest.fn(), stop: jest.fn(), reset: jest.fn() }
    animations.push(animation)
    return animation
  })
  return { animations, timing }
}

it("does not animate initial mounting or an unchanged variant when motion becomes available", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
  const { timing } = captureMotion()
  const { rerender } = await render(<NativeCarouselDotVisual variant="active" testID="dot" />)
  expect(timing).not.toHaveBeenCalled()
  await rerender(<NativeCarouselDotVisual variant="active" raised focusVisible testID="dot" />)
  expect(timing).not.toHaveBeenCalled()
})

it("uses the CSS ease curve and 250ms for changed scale/opacity, retaining the current value on interruption", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
  const { animations } = captureMotion()
  const { rerender, unmount } = await render(<NativeCarouselDotVisual variant="default" testID="dot" />)
  await rerender(<NativeCarouselDotVisual variant="far" testID="dot" />)
  expect(animations).toHaveLength(2)
  for (const animation of animations) {
    expect(animation.config).toMatchObject({ duration: 250, useNativeDriver: true, isInteraction: false })
    expect(animation.config.easing?.(0.5)).toBeCloseTo(Easing.bezier(0.25, 0.1, 0.25, 1)(0.5))
    expect(animation.start).toHaveBeenCalledTimes(1)
  }
  expect(animations.map(({ config }) => config.toValue)).toEqual([0.65, 0.9])
  await act(() => {
    animations[0].value.setValue(0.8)
    animations[1].value.setValue(0.95)
  })
  expect(dot()).toHaveStyle({ transform: [{ scale: 0.8 }], opacity: 0.95 })
  await rerender(<NativeCarouselDotVisual variant="hidden" testID="dot" />)
  expect(animations.slice(0, 2).every(({ stop }) => stop.mock.calls.length === 1)).toBe(true)
  expect(animations).toHaveLength(4)
  expect(animations[2].value).toBe(animations[0].value)
  expect(animations[3].value).toBe(animations[1].value)
  expect(dot()).toHaveStyle({ transform: [{ scale: 0.8 }], opacity: 0.95 })
  expect(animations.slice(2).map(({ config }) => config.toValue)).toEqual([0.4, 0])
  await unmount()
  expect(animations.slice(2).every(({ stop }) => stop.mock.calls.length === 1)).toBe(true)
})

it("animates only changed properties rather than restarting unchanged opacity", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
  const { animations } = captureMotion()
  const { rerender } = await render(<NativeCarouselDotVisual variant="default" testID="dot" />)
  await rerender(<NativeCarouselDotVisual variant="near" testID="dot" />)
  expect(animations).toHaveLength(1)
  expect(animations[0].config.toValue).toBe(0.8)
})

it("keeps every variant static while Reduce Motion is enabled", async () => {
  const { timing } = captureMotion()
  const { rerender } = await render(<NativeCarouselDotVisual variant="default" testID="dot" />)
  for (const variant of NATIVE_CAROUSEL_DOT_VARIANTS) {
    await rerender(<NativeCarouselDotVisual variant={variant} testID="dot" />)
  }
  expect(dot()).toHaveStyle({ opacity: 0.4, transform: [{ scale: 1 }] })
  expect(timing).not.toHaveBeenCalled()
})

it("lets in-flight opacity finish when a later variant changes only scale", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
  const { animations } = captureMotion()
  const { rerender } = await render(<NativeCarouselDotVisual variant="hidden" testID="dot" />)
  await rerender(<NativeCarouselDotVisual variant="near" testID="dot" />)
  const opacity = animations[1]
  await act(() => opacity.value.setValue(0.5))
  await rerender(<NativeCarouselDotVisual variant="active" testID="dot" />)
  expect(animations).toHaveLength(3)
  expect(animations[0].stop).toHaveBeenCalledTimes(1)
  expect(opacity.stop).not.toHaveBeenCalled()
  await act(() => opacity.value.setValue(1))
  expect(dot()).toHaveStyle({ opacity: 1 })
})

it("stops live motion immediately and ignores an older preference-query result", async () => {
  let resolvePreference: ((value: boolean) => void) | undefined
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockReturnValue(
    new Promise((resolve) => {
      resolvePreference = resolve
    }),
  )
  const subscriptionSpy = jest.spyOn(AccessibilityInfo, "addEventListener")
  const { animations } = captureMotion()
  const { rerender, unmount } = await render(<NativeCarouselDotVisual variant="default" testID="dot" />)
  expect(subscriptionSpy.mock.calls.at(-1)![0]).toBe("reduceMotionChanged")
  const notify = subscriptionSpy.mock.calls.at(-1)![1] as unknown as (enabled: boolean) => void
  const subscription = subscriptionSpy.mock.results.at(-1)!.value
  await act(() => notify?.(false))
  await rerender(<NativeCarouselDotVisual variant="hidden" testID="dot" />)
  expect(animations).toHaveLength(2)
  await act(() => notify?.(true))
  expect(animations.every(({ stop }) => stop.mock.calls.length === 1)).toBe(true)
  expect(dot()).toHaveStyle({ opacity: 0, transform: [{ scale: 0.4 }] })
  await act(() => resolvePreference?.(false))
  await rerender(<NativeCarouselDotVisual variant="active" testID="dot" />)
  expect(animations).toHaveLength(2)
  expect(dot()).toHaveStyle({ opacity: 1, transform: [{ scale: 1.15 }] })
  await unmount()
  expect(subscription.remove).toHaveBeenCalledTimes(1)
  await act(() => notify?.(false))
  expect(animations).toHaveLength(2)
})

it("uses static presentation when the platform preference query rejects", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockRejectedValue(new Error("unavailable"))
  const { timing } = captureMotion()
  const { rerender } = await render(<NativeCarouselDotVisual variant="active" testID="dot" />)
  await rerender(<NativeCarouselDotVisual variant="hidden" testID="dot" />)
  expect(dot()).toHaveStyle({ transform: [{ scale: 0.4 }], opacity: 0 })
  expect(timing).not.toHaveBeenCalled()
})
