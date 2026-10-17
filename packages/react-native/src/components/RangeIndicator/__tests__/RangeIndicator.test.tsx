import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { AccessibilityInfo, Animated, PlatformColor, StyleSheet, type View, type ViewStyle } from "react-native"

import { LinearProgress, Meter, NativeThemeProvider } from "../../.."
import type { TNativeLinearProgressStyleState } from "../../LinearProgress/types"
import type { TNativeMeterStyleState } from "../../Meter/types"

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

describe.each([
  { Component: LinearProgress, identity: "linear-progress", role: "progressbar" },
  { Component: Meter, identity: "meter", role: "meter" },
] as const)("$identity native contract", ({ Component, identity, role }) => {
  it("renders one named, bounded accessibility target with a semantic default bar", async () => {
    await render(<Component accessibilityLabel="Completion" value={36} />)
    const root = screen.getByRole(role, { name: "Completion" })
    expect(root).toHaveAccessibilityValue({ min: 0, max: 100, now: 36, text: "36%" })
    expect(root).toHaveStyle({ width: 150, height: 10 })
    expect(screen.getByTestId(`${identity}-bar`, { includeHiddenElements: true })).toHaveStyle({
      backgroundColor: "#2563eb",
      width: "36%",
    })
    expect(screen.getAllByRole(role)).toHaveLength(1)
    expect(screen.getByTestId(`${identity}-track`).props.accessible).toBe(false)
  })

  it("preserves explicit zero, negative ranges, clamping and controlled rerenders", async () => {
    const { rerender } = await render(<Component aria-label="Range" value={0} minValue={-10} maxValue={10} />)
    expect(screen.getByRole(role)).toHaveAccessibilityValue({ min: -10, max: 10, now: 0, text: "50%" })
    expect(screen.getByTestId(`${identity}-bar`, { includeHiddenElements: true })).toHaveStyle({ width: "50%" })
    await rerender(<Component aria-label="Range" value={-25} minValue={-10} maxValue={10} />)
    expect(screen.getByRole(role)).toHaveAccessibilityValue({ now: -10, text: "0%" })
    expect(screen.getByTestId(`${identity}-bar`, { includeHiddenElements: true })).toHaveStyle({ width: "0%" })
    await rerender(<Component aria-label="Range" value={30} minValue={-10} maxValue={10} />)
    expect(screen.getByRole(role)).toHaveAccessibilityValue({ now: 10, text: "100%" })
    await rerender(<Component aria-label="Range" value={0} />)
    expect(screen.getByRole(role)).toHaveAccessibilityValue({ now: 0, text: "0%" })
  })

  it("handles finite ranges whose subtraction overflows", async () => {
    await render(<Component aria-label="Wide range" value={0} minValue={-1e308} maxValue={1e308} />)
    expect(screen.getByTestId(`${identity}-bar`, { includeHiddenElements: true })).toHaveStyle({ width: "50%" })
    expect(screen.getByRole(role)).toHaveAccessibilityValue({ text: "50%" })
  })

  it.each([
    { value: NaN },
    { value: Infinity },
    { value: 1, minValue: -Infinity },
    { value: 1, maxValue: NaN },
    { value: 1, minValue: 5, maxValue: 5 },
    { value: 1, minValue: 6, maxValue: 5 },
  ])("rejects a non-finite value or invalid range: %j", async (range) => {
    await expect(render(<Component aria-label="Invalid" {...range} />)).rejects.toThrow(
      /value and bounds must be finite/,
    )
  })

  it("formats percent versus numeric values and preserves explicit empty value labels", async () => {
    const { rerender } = await render(
      <Component
        aria-label="Format"
        value={1250}
        maxValue={2000}
        locale="en-US"
        formatOptions={{ style: "decimal" }}
      />,
    )
    expect(screen.getByRole(role)).toHaveAccessibilityValue({ text: "1,250", now: 1250 })
    await rerender(
      <Component
        aria-label="Format"
        value={1250}
        maxValue={2000}
        locale="fr-CA"
        formatOptions={{ style: "decimal" }}
      />,
    )
    expect(screen.getByRole(role).props.accessibilityValue.text).toMatch(/^1\s250$/)
    await rerender(<Component aria-label="Format" value={25} valueLabel="One quarter" />)
    expect(screen.getByRole(role)).toHaveAccessibilityValue({ now: 25, text: "One quarter" })
    await rerender(<Component aria-label="Format" value={0} valueLabel="" />)
    expect(screen.getByRole(role).props.accessibilityValue).toMatchObject({ now: 0, text: "" })
  })

  it("does not require Intl when the host supplies its value label", async () => {
    const formatter = jest.spyOn(Intl, "NumberFormat").mockImplementation(() => {
      throw new Error("Intl unavailable")
    })
    await render(<Component aria-label="Authored format" value={5} valueLabel="Five units" />)
    expect(formatter).not.toHaveBeenCalled()
    expect(screen.getByRole(role)).toHaveAccessibilityValue({ text: "Five units" })
  })

  it("honors numeric, zero and percentage dimensions with final root precedence", async () => {
    const { rerender } = await render(<Component aria-label="Dimensions" value={50} height={30} width={300} />)
    expect(screen.getByRole(role)).toHaveStyle({ height: 30, width: 300 })
    expect(screen.getByTestId(`${identity}-track`)).toHaveStyle({ height: "100%", width: "100%" })
    await rerender(
      <Component
        aria-label="Dimensions"
        value={50}
        height={0}
        width="80%"
        customStyles={{ width: 99 }}
        style={{ width: "40%" }}
      />,
    )
    expect(screen.getByRole(role)).toHaveStyle({ height: 0, width: "40%" })
  })

  it.each([
    ["orthogonal", 0],
    ["rounded", 5],
    ["round", 10000],
  ] as const)("retains independent %s bar and track geometry", async (geometry, radius) => {
    await render(<Component aria-label="Geometry" value={50} trackGeometry={geometry} barGeometry={geometry} />)
    expect(screen.getByTestId(`${identity}-track`)).toHaveStyle({ borderRadius: radius })
    expect(screen.getByTestId(`${identity}-bar`, { includeHiddenElements: true })).toHaveStyle({ borderRadius: radius })
  })

  it.each([
    ["primary", "#2563eb"],
    ["secondary", "#c6c6c6"],
    ["tertiary", "#2f7d18"],
    ["quaternary", "#a66b00"],
    ["quintenary", "#b73434"],
  ] as const)("uses the existing numbered palette for order %s", async (order, backgroundColor) => {
    await render(<Component aria-label="Order" value={50} order={order} />)
    expect(screen.getByTestId(`${identity}-bar`, { includeHiddenElements: true })).toHaveStyle({ backgroundColor })
  })

  it("gives explicit colors priority over order and validates native colors", async () => {
    await render(<Component aria-label="Colors" value={50} order="tertiary" barColor="blue" trackColor="orange" />)
    expect(screen.getByTestId(`${identity}-bar`, { includeHiddenElements: true })).toHaveStyle({
      backgroundColor: "blue",
    })
    expect(screen.getByTestId(`${identity}-track`)).toHaveStyle({ backgroundColor: "orange" })
    await expect(render(<Component aria-label="Bad color" value={50} barColor="var(--cui-color)" />)).rejects.toThrow(
      /unsupported native color/,
    )
  })

  it("supports native dynamic colors, registered styles and style arrays", async () => {
    const color = PlatformColor("systemBlueColor")
    const registered = StyleSheet.create({ root: { width: 250 }, bar: { backgroundColor: color } })
    await render(
      <Component
        aria-label="Native styles"
        value={50}
        customStyles={[false, registered.root]}
        customBarStyles={[undefined, registered.bar]}
      />,
    )
    expect(screen.getByRole(role)).toHaveStyle({ width: 250 })
    expect(screen.getByTestId(`${identity}-bar`, { includeHiddenElements: true })).toHaveStyle({
      backgroundColor: color,
    })
  })

  it("uses current provider colors and geometry without changing the controlled value", async () => {
    const { rerender } = await render(
      <NativeThemeProvider overrides={{ colors: { controlSelectedBackground: "pink" } }}>
        <Component aria-label="Themed" value={25} trackGeometry="rounded" />
      </NativeThemeProvider>,
    )
    expect(screen.getByTestId(`${identity}-bar`, { includeHiddenElements: true })).toHaveStyle({
      backgroundColor: "pink",
    })
    await rerender(
      <NativeThemeProvider
        mode="dark"
        overrides={{ actions: { secondary: { background: "orange" } }, radius: { rounded: 8 } }}
      >
        <Component aria-label="Themed" value={25} order="secondary" trackGeometry="rounded" />
      </NativeThemeProvider>,
    )
    expect(screen.getByTestId(`${identity}-bar`, { includeHiddenElements: true })).toHaveStyle({
      backgroundColor: "orange",
      width: "25%",
    })
    expect(screen.getByTestId(`${identity}-track`)).toHaveStyle({
      borderColor: "#474747",
      backgroundColor: "#171717",
      borderRadius: 8,
    })
  })

  it("adds and removes established track elevation", async () => {
    const { rerender } = await render(<Component aria-label="Raised" value={30} raised />)
    expect(screen.getByTestId(`${identity}-track`)).toHaveStyle({ elevation: 2, shadowOpacity: 0.24 })
    await rerender(<Component aria-label="Raised" value={30} raised={false} />)
    expect(StyleSheet.flatten(screen.getByTestId(`${identity}-track`).props.style).elevation).toBeUndefined()
  })

  it("anchors physical left/right and vertical up/down without rotating its accessibility target", async () => {
    const { rerender } = await render(<Component aria-label="Direction" value={30} direction="left" />)
    expect(screen.getByTestId(`${identity}-bar`, { includeHiddenElements: true })).toHaveStyle({
      right: 0,
      width: "30%",
      height: "100%",
    })
    await rerender(<Component aria-label="Direction" value={30} direction="right" />)
    expect(screen.getByTestId(`${identity}-bar`, { includeHiddenElements: true })).toHaveStyle({
      left: 0,
      width: "30%",
    })
    await rerender(<Component aria-label="Direction" value={30} direction="down" />)
    expect(screen.getByTestId(`${identity}-bar`, { includeHiddenElements: true })).toHaveStyle({ left: 0 })
    await rerender(<Component aria-label="Direction" value={30} orientation="vertical" />)
    expect(screen.getByRole(role)).toHaveStyle({ width: 10, height: 150 })
    expect(screen.getByTestId(`${identity}-bar`, { includeHiddenElements: true })).toHaveStyle({
      bottom: 0,
      height: "30%",
      width: "100%",
    })
    await rerender(<Component aria-label="Direction" value={30} orientation="vertical" direction="down" />)
    expect(screen.getByTestId(`${identity}-bar`, { includeHiddenElements: true })).toHaveStyle({
      top: 0,
      height: "30%",
    })
    await rerender(<Component aria-label="Direction" value={30} orientation="vertical" direction="left" />)
    expect(screen.getByTestId(`${identity}-bar`, { includeHiddenElements: true })).toHaveStyle({ bottom: 0 })
  })

  it("isolates the three style slots and passes post-custom defaults to the final callback", async () => {
    const states: Array<TNativeLinearProgressStyleState | TNativeMeterStyleState> = []
    const { rerender } = await render(
      <Component
        aria-label="Slots"
        value={28}
        width={100}
        customStyles={{ width: 200, backgroundColor: "red" }}
        customTrackStyles={{ backgroundColor: "orange", height: 25 }}
        customBarStyles={{ backgroundColor: "green", borderRadius: 2 }}
        style={(state: TNativeLinearProgressStyleState | TNativeMeterStyleState) => {
          states.push(state)
          return [state.defaultStyle, { width: 300, backgroundColor: "blue" }]
        }}
      />,
    )
    expect(states.at(-1)).toMatchObject({
      valueText: "28%",
      defaultStyle: { width: 200, backgroundColor: "red" },
    })
    expect(states.at(-1)?.percentage).toBeCloseTo(28)
    expect(screen.getByRole(role)).toHaveStyle({ width: 300, backgroundColor: "blue" })
    expect(screen.getByTestId(`${identity}-track`)).toHaveStyle({ backgroundColor: "orange", height: 25 })
    expect(screen.getByTestId(`${identity}-bar`, { includeHiddenElements: true })).toHaveStyle({
      backgroundColor: "green",
      borderRadius: 2,
    })
    await rerender(<Component aria-label="Slots" value={0} style={{ opacity: 0 }} />)
    expect(screen.getByRole(role)).toHaveStyle({ width: 150, opacity: 0 })
    expect(screen.getByRole(role)).toHaveAccessibilityValue({ now: 0 })
  })

  it("validates colors in every authored slot including final callback output", async () => {
    for (const slot of ["customStyles", "customTrackStyles", "customBarStyles"] as const) {
      await expect(
        render(<Component aria-label="Invalid slot" value={5} {...{ [slot]: { backgroundColor: "var(--bad)" } }} />),
      ).rejects.toThrow(/unsupported native color/)
    }
    await expect(
      render(<Component aria-label="Invalid callback" value={5} style={() => ({ borderColor: "var(--bad)" })} />),
    ).rejects.toThrow(/unsupported native color/)
  })

  it("forwards its real View ref, IDs and native layout payload while consuming wrapper props", async () => {
    const ref = createRef<View>()
    const layout = jest.fn()
    await render(
      <Component
        ref={ref}
        accessibilityLabel="Native name"
        aria-label="Alias name"
        testID="native-id"
        data-testid="alias-id"
        nativeID="measure-id"
        value={5}
        minValue={-5}
        maxValue={20}
        valueLabel="Five"
        locale="en-US"
        formatOptions={{ style: "decimal" }}
        height={15}
        width={200}
        order="primary"
        orientation="vertical"
        direction="down"
        barColor="blue"
        trackColor="white"
        barGeometry="round"
        trackGeometry="rounded"
        raised
        customStyles={{ opacity: 0.9 }}
        onLayout={layout}
        collapsable={false}
      />,
    )
    const root = screen.getByTestId("native-id")
    expect(root).toHaveAccessibleName("Native name")
    expect(screen.queryByTestId("alias-id")).toBeNull()
    expect(root.props.nativeID).toBe("measure-id")
    expect(root.props.collapsable).toBe(false)
    expect(typeof ref.current?.measure).toBe("function")
    const event = { nativeEvent: { layout: { x: 0, y: 0, height: 15, width: 200 } } }
    await fireEvent(root, "layout", event)
    expect(layout).toHaveBeenCalledWith(event)
    for (const prop of [
      "value",
      "minValue",
      "maxValue",
      "valueLabel",
      "locale",
      "formatOptions",
      "height",
      "width",
      "order",
      "orientation",
      "direction",
      "barColor",
      "trackColor",
      "barGeometry",
      "trackGeometry",
      "raised",
      "customStyles",
      "customTrackStyles",
      "customBarStyles",
      "isIndeterminate",
      "data-testid",
    ])
      expect(root.props[prop]).toBeUndefined()
  })

  it("rejects blank accessible names instead of falling through to a lower-priority alias", async () => {
    await expect(render(<Component accessibilityLabel="" aria-label="Fallback" value={5} />)).rejects.toThrow(
      /nonempty accessibilityLabel/,
    )
    await expect(render(<Component aria-label="  " value={5} />)).rejects.toThrow(/nonempty accessibilityLabel/)
  })
})

it("switches progress between determinate and unknown state with no second accessible target", async () => {
  const states: TNativeLinearProgressStyleState[] = []
  const capture = (state: TNativeLinearProgressStyleState): ViewStyle => {
    states.push(state)
    return {}
  }
  const { rerender } = await render(<LinearProgress aria-label="Transfer" value={40} style={capture} />)
  expect(states.at(-1)).toMatchObject({ percentage: 40, valueText: "40%", isIndeterminate: false })
  await rerender(<LinearProgress aria-label="Transfer" value={0} isIndeterminate style={capture} />)
  expect(screen.getByRole("progressbar").props.accessibilityValue).toEqual({})
  expect(screen.getAllByRole("progressbar")).toHaveLength(1)
  expect(screen.queryByTestId("linear-progress-bar", { includeHiddenElements: true })).toBeNull()
  expect(screen.getByTestId("linear-progress-indeterminate", { includeHiddenElements: true }).props.accessible).toBe(
    false,
  )
  expect(states.at(-1)).toMatchObject({ percentage: undefined, valueText: undefined, isIndeterminate: true })
  expect(screen.getByTestId("linear-progress-indeterminate", { includeHiddenElements: true }).props.animating).toBe(
    false,
  )
  await rerender(<LinearProgress aria-label="Transfer" value={75} style={capture} />)
  expect(screen.queryByTestId("linear-progress-indeterminate", { includeHiddenElements: true })).toBeNull()
  expect(screen.getByRole("progressbar")).toHaveAccessibilityValue({ now: 75, text: "75%" })
  expect(screen.getByTestId("linear-progress-bar", { includeHiddenElements: true })).toHaveStyle({ width: "75%" })
})

it("keeps meter callback state determinate", async () => {
  const callback = jest.fn<ViewStyle, [TNativeMeterStyleState]>(() => ({}))
  await render(<Meter aria-label="Capacity" value={50} style={callback} />)
  expect(callback.mock.calls.at(-1)?.[0]).toMatchObject({ percentage: 50, valueText: "50%" })
  expect(callback.mock.calls.at(-1)?.[0]).not.toHaveProperty("isIndeterminate")
})

it("animates only the visual fill and cancels superseded and unmounted transitions", async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false)
  const transitions: Array<{ start: jest.Mock; stop: jest.Mock }> = []
  const timing = jest.spyOn(Animated, "timing").mockImplementation(() => {
    const transition = { start: jest.fn(), stop: jest.fn(), reset: jest.fn() }
    transitions.push(transition)
    return transition
  })
  const { rerender, unmount } = await render(<LinearProgress aria-label="Animated" value={10} />)
  await rerender(<LinearProgress aria-label="Animated" value={70} />)
  expect(timing).toHaveBeenLastCalledWith(
    expect.anything(),
    expect.objectContaining({ toValue: 70, duration: 250, useNativeDriver: false }),
  )
  expect(screen.getByRole("progressbar")).toHaveAccessibilityValue({ now: 70, text: "70%" })
  const previous = transitions.at(-1)!
  await rerender(<LinearProgress aria-label="Animated" value={0} />)
  expect(previous.stop).toHaveBeenCalledTimes(1)
  expect(screen.getByRole("progressbar")).toHaveAccessibilityValue({ now: 0 })
  const last = transitions.at(-1)!
  await unmount()
  expect(last.stop).toHaveBeenCalledTimes(1)
})

it("honors a newer Reduce Motion event over a delayed initial query and removes its listener", async () => {
  let resolvePreference: (enabled: boolean) => void = () => undefined
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockReturnValue(
    new Promise((resolve) => {
      resolvePreference = resolve
    }),
  )
  const timing = jest.spyOn(Animated, "timing")
  const { rerender, unmount } = await render(<Meter aria-label="Motion preference" value={10} />)
  const registration = jest.mocked(AccessibilityInfo.addEventListener).mock.calls.at(-1)!
  expect(registration[0]).toBe("reduceMotionChanged")
  const listener = registration[1] as unknown as (enabled: boolean) => void
  const subscription = jest.mocked(AccessibilityInfo.addEventListener).mock.results.at(-1)!.value
  await act(() => listener(true))
  await act(() => resolvePreference(false))
  await rerender(<Meter aria-label="Motion preference" value={60} />)
  expect(timing).not.toHaveBeenCalled()
  expect(screen.getByTestId("meter-bar", { includeHiddenElements: true })).toHaveStyle({ width: "60%" })
  await unmount()
  expect(subscription.remove).toHaveBeenCalledTimes(1)
})

it("keeps static presentation if the native motion preference query fails", async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockRejectedValue(new Error("Preference unavailable"))
  const timing = jest.spyOn(Animated, "timing")
  const { rerender } = await render(<Meter aria-label="Safe motion" value={10} />)
  await rerender(<Meter aria-label="Safe motion" value={90} />)
  expect(timing).not.toHaveBeenCalled()
  expect(screen.getByTestId("meter-bar", { includeHiddenElements: true })).toHaveStyle({ width: "90%" })
})
