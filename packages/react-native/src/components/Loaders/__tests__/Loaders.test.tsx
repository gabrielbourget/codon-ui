import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { AccessibilityInfo, Animated, PlatformColor, StyleSheet, type View } from "react-native"

import { Button, CircleLoader, LaggingLinesLoader, NativeThemeProvider, type TNativeLoaderStyleState } from "../../.."

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

const part = (identity: string) => screen.getByTestId(identity, { includeHiddenElements: true })
const measureTrack = async (width: number) =>
  fireEvent(part("lagging-lines-loader-track"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width, height: 0 } } })

const captureMotion = () => {
  const handles: Array<{ start: jest.Mock; stop: jest.Mock; reset: jest.Mock }> = []
  const handle = () => {
    const result = { start: jest.fn(), stop: jest.fn(), reset: jest.fn() }
    handles.push(result)
    return result
  }
  const timings: Array<{
    value: Animated.Value
    config: Animated.TimingAnimationConfig
    handle: ReturnType<typeof handle>
  }> = []
  const sequences: Array<{ children: Animated.CompositeAnimation[]; handle: ReturnType<typeof handle> }> = []
  const loops: Array<{ child: Animated.CompositeAnimation; handle: ReturnType<typeof handle> }> = []
  jest.spyOn(Animated, "timing").mockImplementation((value, config) => {
    const result = handle()
    timings.push({ value: value as Animated.Value, config, handle: result })
    return result
  })
  jest.spyOn(Animated, "sequence").mockImplementation((children) => {
    const result = handle()
    sequences.push({ children, handle: result })
    return result
  })
  jest.spyOn(Animated, "loop").mockImplementation((child) => {
    const result = handle()
    loops.push({ child, handle: result })
    return result
  })
  return { handles, timings, sequences, loops }
}

it("CAP.circle-loader.001 exposes one Loading target with exact default ring styling", async () => {
  const motion = captureMotion()
  await render(<CircleLoader />)
  const root = screen.getByRole("progressbar", { name: "Loading" })
  expect(root.props.accessibilityState).toEqual({ busy: true })
  expect(root.props.accessibilityValue).toEqual({})
  expect(root.props.accessibilityLiveRegion).toBe("polite")
  expect(part("circle-loader-spinner")).toHaveStyle({
    width: 25,
    height: 25,
    borderWidth: 3,
    borderRadius: 10000,
    borderColor: "rgba(127, 127, 127, 0.22)",
    borderTopColor: "#171717",
    borderRightColor: "#171717",
    transform: [{ rotate: "0deg" }],
  })
  expect(screen.getAllByRole("progressbar")).toHaveLength(1)
  expect(motion.loops).toHaveLength(0)
})

it("CAP.circle-loader.002 retains independent ring size, custom colors/timing/labels and root overrides", async () => {
  const states: TNativeLoaderStyleState[] = []
  await render(
    <CircleLoader
      size={20}
      spinnerTrackWidth={2.5}
      spinnerColor="purple"
      spinnerTrackColor="silver"
      duration={450}
      ariaLabel="Saving"
      testID="saving"
      customStyles={{ marginTop: 5, width: 40 }}
      style={(state) => {
        states.push(state)
        return { marginBottom: 10 }
      }}
    />,
  )
  expect(screen.getByRole("progressbar", { name: "Saving" })).toHaveStyle({ marginTop: 5, marginBottom: 10, width: 40 })
  expect(part("saving-spinner")).toHaveStyle({
    width: 20,
    height: 20,
    borderWidth: 2.5,
    borderColor: "silver",
    borderTopColor: "purple",
    borderRightColor: "purple",
  })
  expect(states.at(-1)).toMatchObject({
    duration: 450,
    isMotionEnabled: false,
    defaultStyle: { marginTop: 5, width: 40 },
  })
})

it("CAP.circle-loader.003 gives explicit track transparency precedence and restores false", async () => {
  const { rerender } = await render(<CircleLoader spinnerTrackColor="silver" spinnerTrackIsTransparent />)
  expect(part("circle-loader-spinner")).toHaveStyle({ borderColor: "transparent", borderTopColor: "#171717" })
  await rerender(<CircleLoader spinnerTrackColor="silver" spinnerTrackIsTransparent={false} />)
  expect(part("circle-loader-spinner")).toHaveStyle({ borderColor: "silver" })
})

it("CAP.lagging-lines-loader.001 preserves all three line recipes and the 150 by 50 container", async () => {
  await render(<LaggingLinesLoader />)
  expect(screen.getByRole("progressbar")).toHaveStyle({
    width: 150,
    height: 50,
    alignSelf: "center",
    justifyContent: "center",
  })
  const recipes = [
    [0.4, 1.2],
    [0.6, 1.1],
    [0.9, 1],
  ] as const
  for (const [index, [opacity, scaleX]] of recipes.entries()) {
    expect(part("lagging-lines-loader-motion-" + index)).toHaveStyle({ width: "20%", position: "absolute" })
    expect(part("lagging-lines-loader-slide-" + index)).toHaveStyle({
      width: "100%",
      height: 5,
      backgroundColor: "#171717",
      opacity,
      transform: [{ scaleX }],
    })
  }
  expect(screen.getAllByRole("progressbar")).toHaveLength(1)
})

it("CAP.lagging-lines-loader.002 applies color, duration and custom styles to every slide", async () => {
  const states: TNativeLoaderStyleState[] = []
  await render(
    <LaggingLinesLoader
      width={120}
      color="purple"
      duration={500}
      customStyles={{ borderRadius: 5 }}
      style={(state) => {
        states.push(state)
        return {}
      }}
    />,
  )
  expect(screen.getByRole("progressbar")).toHaveStyle({ width: 120, height: 50 })
  for (const index of [0, 1, 2])
    expect(part("lagging-lines-loader-slide-" + index)).toHaveStyle({ backgroundColor: "purple", borderRadius: 5 })
  expect(states.at(-1)?.duration).toBe(500)
})

it("NATIVE.loaders.001 keeps foreground ownership, explicit colors and theme changes distinct", async () => {
  const { rerender } = await render(
    <NativeThemeProvider>
      <CircleLoader customStyles={{ color: "red" }} style={{ color: "blue" }} />
      <LaggingLinesLoader color="purple" customStyles={{ color: "orange" }} />
    </NativeThemeProvider>,
  )
  expect(part("circle-loader-spinner")).toHaveStyle({ borderTopColor: "blue" })
  expect(part("lagging-lines-loader-slide-0")).toHaveStyle({ backgroundColor: "purple" })
  await rerender(
    <NativeThemeProvider mode="dark">
      <CircleLoader spinnerColor="green" style={{ color: "blue" }} />
      <LaggingLinesLoader />
    </NativeThemeProvider>,
  )
  expect(part("circle-loader-spinner")).toHaveStyle({ borderTopColor: "green" })
  expect(part("lagging-lines-loader-slide-0")).toHaveStyle({ backgroundColor: "#ffffff" })
  await rerender(
    <NativeThemeProvider mode="dark">
      <CircleLoader />
      <LaggingLinesLoader customStyles={{ color: "orange" }} />
    </NativeThemeProvider>,
  )
  expect(part("circle-loader-spinner")).toHaveStyle({ borderTopColor: "#ffffff" })
  expect(part("lagging-lines-loader-slide-0")).toHaveStyle({ backgroundColor: "orange" })
})

it("NATIVE.loaders.001 supports native colors, registered/array styles and slide time override without leaks", async () => {
  const color = PlatformColor("systemBlueColor")
  const registered = StyleSheet.create({
    root: { marginTop: 7, color },
    slide: { backgroundColor: color, opacity: 0.2 },
  })
  const states: TNativeLoaderStyleState[] = []
  await render(
    <>
      <CircleLoader customStyles={[false, registered.root]} />
      <LaggingLinesLoader
        duration={500}
        customStyles={[registered.slide, { animationDuration: "1.25s", transform: [{ rotate: "90deg" }] }]}
        style={(state) => {
          states.push(state)
          return { color: "pink" }
        }}
      />
    </>,
  )
  expect(screen.getByTestId("circle-loader")).toHaveStyle({ marginTop: 7 })
  expect(StyleSheet.flatten(screen.getByTestId("circle-loader").props.style).color).toBeUndefined()
  expect(part("circle-loader-spinner")).toHaveStyle({ borderTopColor: color })
  for (const index of [0, 1, 2]) {
    const slide = part("lagging-lines-loader-slide-" + index)
    expect(slide).toHaveStyle({ backgroundColor: color, opacity: 0.2, transform: [{ rotate: "90deg" }] })
    expect(StyleSheet.flatten(slide.props.style).animationDuration).toBeUndefined()
    expect(StyleSheet.flatten(slide.props.style).color).toBeUndefined()
  }
  expect(states.at(-1)?.duration).toBe(1250)
})

it.each(["circle", "lines"] as const)(
  "NATIVE.loaders.003 forwards %s root ref/name/identity/layout while consuming wrapper props",
  async (kind) => {
    const ref = createRef<View>()
    const layout = jest.fn()
    const common = {
      ref,
      onLayout: layout,
      testID: "chosen",
      "data-testid": "alias",
      accessibilityLabel: "Native label",
      "aria-label": "Alias label",
      ariaLabel: "Legacy label",
      nativeID: "native-loader",
      collapsable: false,
    }
    await render(
      kind === "circle" ? (
        <CircleLoader
          {...common}
          size={30}
          spinnerColor="green"
          spinnerTrackWidth={2}
          spinnerTrackColor="gray"
          spinnerTrackIsTransparent
          duration={600}
          customStyles={{ opacity: 0.5 }}
        />
      ) : (
        <LaggingLinesLoader {...common} width={100} color="green" duration={600} customStyles={{ borderRadius: 2 }} />
      ),
    )
    const root = screen.getByTestId("chosen")
    expect(root.props).toMatchObject({
      accessibilityLabel: "Native label",
      nativeID: "native-loader",
      collapsable: false,
    })
    expect(screen.queryByTestId("alias")).toBeNull()
    expect(typeof ref.current?.measure).toBe("function")
    const event = { nativeEvent: { layout: { x: 1, y: 2, width: 100, height: 50 } } }
    await fireEvent(root, "layout", event)
    expect(layout).toHaveBeenCalledWith(event)
    for (const key of [
      "size",
      "spinnerColor",
      "spinnerTrackWidth",
      "spinnerTrackColor",
      "spinnerTrackIsTransparent",
      "duration",
      "customStyles",
      "color",
      "width",
      "ariaLabel",
      "data-testid",
    ])
      expect(root.props[key]).toBeUndefined()
  },
)

it("NATIVE.loaders.003 keeps loaders decorative inside owned Button content and preserves explicit opt-in", async () => {
  const { rerender } = await render(
    <Button order="primary">
      <CircleLoader />
      <LaggingLinesLoader />
    </Button>,
  )
  expect(screen.queryAllByRole("progressbar")).toHaveLength(0)
  expect(part("circle-loader-spinner")).toHaveStyle({ borderTopColor: "#ffffff" })
  expect(part("lagging-lines-loader-slide-0")).toHaveStyle({ backgroundColor: "#ffffff" })
  await rerender(
    <Button order="primary">
      <CircleLoader accessible />
    </Button>,
  )
  expect(screen.getByRole("progressbar", { name: "Loading" })).toBeOnTheScreen()
})

it.each([CircleLoader, LaggingLinesLoader])(
  "NATIVE.loaders.003 validates exposed names and preserves an explicit decorative empty label",
  async (Component) => {
    await expect(render(<Component accessibilityLabel="" ariaLabel="Fallback" />)).rejects.toThrow(
      /nonempty accessible name/,
    )
    await render(
      <Component accessible={false} accessibilityLabel="" ariaLabel="Fallback" testID="" data-testid="alias" />,
    )
    expect(screen.getByTestId("").props.accessibilityLabel).toBe("")
    expect(screen.queryByTestId("alias")).toBeNull()
  },
)

it.each([0, "0ms", "0s"] as const)(
  "NATIVE.loaders.002 preserves zero duration %s without starting loops",
  async (duration) => {
    jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false)
    const motion = captureMotion()
    await render(
      <>
        <CircleLoader duration={duration} size={0} spinnerTrackWidth={0} />
        <LaggingLinesLoader duration={duration} width={0} />
      </>,
    )
    await measureTrack(150)
    expect(motion.loops).toHaveLength(0)
    expect(part("circle-loader-spinner")).toHaveStyle({ width: 0, height: 0, borderWidth: 0 })
    expect(screen.getByTestId("lagging-lines-loader")).toHaveStyle({ width: 0 })
  },
)

it("NATIVE.loaders.002 wires circular linear rotation and stops replaced/unmounted work", async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false)
  const motion = captureMotion()
  const { rerender, unmount } = await render(<CircleLoader />)
  expect(motion.timings.at(-1)?.config).toMatchObject({
    toValue: 1,
    duration: 850,
    useNativeDriver: true,
    isInteraction: false,
  })
  expect(motion.timings.at(-1)?.config.easing?.(0.25)).toBeCloseTo(0.25)
  expect(motion.loops.at(-1)?.handle.start).toHaveBeenCalledTimes(1)
  await act(() => motion.timings.at(-1)!.value.setValue(0.25))
  expect(part("circle-loader-spinner")).toHaveStyle({ transform: [{ rotate: "90deg" }] })
  const initial = motion.loops.at(-1)!.handle
  await rerender(<CircleLoader duration="0.45s" />)
  expect(initial.stop).toHaveBeenCalledTimes(1)
  expect(motion.timings.at(-1)?.config.duration).toBe(450)
  const latest = motion.loops.at(-1)!.handle
  await unmount()
  expect(latest.stop).toHaveBeenCalledTimes(1)
})

it("NATIVE.loaders.002 matches half-cycle easing, one-time delays and measured travel without resetting on resize", async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false)
  const motion = captureMotion()
  const { rerender, unmount } = await render(<LaggingLinesLoader />)
  expect(motion.loops).toHaveLength(0)
  await measureTrack(150)
  expect(motion.loops).toHaveLength(3)
  const halves = motion.timings.filter(({ config }) => config.duration === 1500)
  expect(halves.map(({ config }) => config.toValue)).toEqual([1, 0, 1, 0, 1, 0])
  for (const half of halves) {
    expect(half.config.easing?.(0.25)).toBeCloseTo(0.12916, 4)
    expect(half.config.easing?.(0.5)).toBeCloseTo(0.5)
    expect(half.config).toMatchObject({ useNativeDriver: true, isInteraction: false })
  }
  expect(motion.timings.filter(({ config }) => config.delay).map(({ config }) => config.delay)).toEqual([200, 100])
  for (const loop of motion.loops) {
    const iteration = motion.sequences.find(({ handle }) => handle === loop.child)
    expect(iteration?.children).toHaveLength(2)
  }
  const total = motion.loops.length
  await act(() => halves.at(-1)!.value.setValue(0.5))
  expect(part("lagging-lines-loader-motion-2")).toHaveStyle({ transform: [{ translateX: 75 }] })
  await measureTrack(200)
  expect(motion.loops).toHaveLength(total)
  expect(part("lagging-lines-loader-motion-2")).toHaveStyle({ transform: [{ translateX: 100 }] })
  await rerender(<LaggingLinesLoader duration={500} customStyles={{ animationDuration: "0.2s" }} />)
  expect(motion.timings.filter(({ config }) => config.duration === 100)).toHaveLength(6)
  const active = motion.sequences
    .filter(({ children }) => children.some((child) => motion.loops.some(({ handle }) => handle === child)))
    .map(({ handle }) => handle)
  const activeLastLoop = motion.loops.at(-1)!.handle
  await unmount()
  expect(activeLastLoop.stop).toHaveBeenCalled()
  expect(active.every((handle) => handle.stop.mock.calls.length > 0)).toBe(true)
})

it("NATIVE.loaders.002 honors an explicit zero slide duration over the positive shorthand", async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false)
  const motion = captureMotion()
  const states: TNativeLoaderStyleState[] = []
  await render(
    <LaggingLinesLoader
      duration={3000}
      customStyles={{ animationDuration: 0 }}
      style={(state) => {
        states.push(state)
        return {}
      }}
    />,
  )
  await measureTrack(150)
  expect(states.at(-1)).toMatchObject({ duration: 0, isMotionEnabled: false })
  expect(motion.loops).toHaveLength(0)
  expect(screen.getByRole("progressbar").props.accessibilityState).toEqual({ busy: true })
})

it("NATIVE.loaders.002 ignores a late initial preference after a live Reduce Motion event and removes subscriptions", async () => {
  let resolvePreference: (enabled: boolean) => void = () => undefined
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockReturnValue(
    new Promise((resolve) => {
      resolvePreference = resolve
    }),
  )
  const motion = captureMotion()
  const { unmount } = await render(<CircleLoader />)
  const registration = jest.mocked(AccessibilityInfo.addEventListener).mock.calls.at(-1)!
  const listener = registration[1] as unknown as (enabled: boolean) => void
  const subscription = jest.mocked(AccessibilityInfo.addEventListener).mock.results.at(-1)!.value
  expect(motion.loops).toHaveLength(0)
  await act(() => listener(false))
  expect(motion.loops).toHaveLength(1)
  await act(() => resolvePreference(true))
  expect(motion.loops).toHaveLength(1)
  await act(() => listener(true))
  expect(motion.loops[0].handle.stop).toHaveBeenCalledTimes(1)
  await unmount()
  expect(subscription.remove).toHaveBeenCalledTimes(1)
})

it("NATIVE.loaders.002 retains a static first frame when the preference query fails", async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockRejectedValue(new Error("Unavailable"))
  const motion = captureMotion()
  await render(
    <>
      <CircleLoader />
      <LaggingLinesLoader />
    </>,
  )
  await measureTrack(150)
  expect(motion.loops).toHaveLength(0)
})

it.each([-1, Infinity, NaN])("NATIVE.loaders.002 rejects invalid duration %s", async (duration) => {
  await expect(render(<CircleLoader duration={duration} />)).rejects.toThrow(/duration/)
  await expect(render(<LaggingLinesLoader duration={duration} />)).rejects.toThrow(/duration/)
})
it("NATIVE.loaders.002 rejects invalid native dimensions and colors", async () => {
  await expect(render(<CircleLoader size={-1} />)).rejects.toThrow(/size/)
  await expect(render(<CircleLoader spinnerTrackWidth={-1} />)).rejects.toThrow(/spinnerTrackWidth/)
  await expect(render(<LaggingLinesLoader width={NaN} />)).rejects.toThrow(/width/)
  await expect(render(<CircleLoader spinnerColor="var(--bad)" />)).rejects.toThrow(/unsupported native color/)
  await expect(render(<LaggingLinesLoader customStyles={{ backgroundColor: "var(--bad)" }} />)).rejects.toThrow(
    /unsupported native color/,
  )
})
