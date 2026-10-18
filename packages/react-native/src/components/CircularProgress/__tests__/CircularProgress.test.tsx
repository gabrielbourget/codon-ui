import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { AccessibilityInfo, Animated, PlatformColor, StyleSheet, type View } from "react-native"

import { CircularProgress, NativeThemeProvider, type CircularProgressProps } from "../../.."
import { getNativeCircularGeometry } from "../model"

const hidden = { includeHiddenElements: true }
const part = (name: string) => screen.getByTestId(`circular-progress-${name}`, hidden)

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

it("maps canonical render/dimensions to one named native progress target and a real vector viewBox", async () => {
  const ref = createRef<View>()
  const onLayout = jest.fn()
  await render(
    <CircularProgress ref={ref} aria-label="Completion" value={36} height={70} width={80} onLayout={onLayout} />,
  )
  expect(screen.getByRole("progressbar", { name: "Completion" })).toHaveAccessibilityValue({
    min: 0,
    max: 100,
    now: 36,
    text: "36%",
  })
  expect(screen.getByRole("progressbar")).toHaveStyle({ height: 70, width: 80 })
  expect(ref.current?.measure).toEqual(expect.any(Function))
  expect(part("svg").props).toMatchObject({ minX: 0, minY: 0, vbWidth: 100, vbHeight: 100, pointerEvents: "none" })
  expect(screen.getAllByRole("progressbar")).toHaveLength(1)
  const event = { nativeEvent: { layout: { x: 1, y: 2, width: 80, height: 70 } } }
  await fireEvent(screen.getByRole("progressbar"), "layout", event)
  expect(onLayout).toHaveBeenCalledWith(event)
})

it("preserves default radius46/rendered stroke6 and paired sweep-one geometry", async () => {
  await render(<CircularProgress value={25} />)
  expect(part("path").props).toMatchObject({ strokeWidth: 6, strokeLinecap: 0, fillOpacity: 0 })
  expect(part("path").props.d).toBe("M 50,50 m 0,-46 a 46,46 0 1 1 0,92 a 46,46 0 1 1 0,-92")
  expect(part("path").props.strokeDasharray).toEqual([2 * Math.PI * 46, 2 * Math.PI * 46])
  expect(part("path").props.strokeDashoffset).toBeCloseTo(0.75 * 2 * Math.PI * 46)
})

it.each([0, -5, 25, 100, 150])("retains controlled value %s and canonical drawing clamps", async (value) => {
  const owner = Object.freeze({ value })
  await render(<CircularProgress {...owner} />)
  expect(owner.value).toBe(value)
  expect(part("path").props.strokeDashoffset ?? 0).toBeCloseTo(
    (1 - Math.min(100, Math.max(0, value)) / 100) * 2 * Math.PI * 46,
  )
  expect(screen.getByRole("progressbar")).toHaveAccessibilityValue({ now: Math.min(100, Math.max(0, value)) })
})

it("updates the existing native tree through zero, range and direction changes", async () => {
  const ref = createRef<View>()
  const { rerender } = await render(<CircularProgress ref={ref} value={25} />)
  const host = ref.current
  await rerender(
    <CircularProgress ref={ref} value={0} minValue={-10} maxValue={10} circleRatio={0.5} counterClockwise />,
  )
  expect(ref.current).toBe(host)
  expect(part("path").props.strokeDashoffset).toBeCloseTo(-0.75 * 2 * Math.PI * 46)
  expect(part("track").props.strokeDashoffset).toBeCloseTo(-0.5 * 2 * Math.PI * 46)
  expect(part("path").props.d).toContain("a 46,46 1 1 1")
  await rerender(<CircularProgress ref={ref} value={0} circleRatio={0} counterClockwise={false} />)
  expect(part("track").props.strokeDashoffset).toBeCloseTo(2 * Math.PI * 46)
})

it.each(["butt", "round", "square"] as const)("maps canonical %s caps on both paths", async (strokeLineCap) => {
  await render(<CircularProgress value={25} strokeWidth={10} strokeLineCap={strokeLineCap} />)
  expect(part("path").props.strokeLinecap).toBe(["butt", "round", "square"].indexOf(strokeLineCap))
  expect(part("track").props.strokeLinecap).toBe(part("path").props.strokeLinecap)
  expect(part("path").props.d).toContain("m 0,-45")
})

it("preserves truthy background gates, padding and the distinction between color and fill", async () => {
  const { rerender } = await render(<CircularProgress value={25} backgroundPadding={9} text="" />)
  expect(screen.queryByTestId("circular-progress-background", hidden)).toBeNull()
  expect(screen.queryByTestId("circular-progress-text", hidden)).toBeNull()
  expect(part("path").props.d).toContain("m 0,-46")
  await rerender(<CircularProgress value={25} backgroundColor="red" backgroundPadding={9} text="0" />)
  expect(part("path").props.d).toContain("m 0,-37")
  expect(part("background").props).toMatchObject({
    cx: 50,
    cy: 50,
    r: 50,
    fill: { type: 0, payload: 0xffffffff },
  })
  expect(part("text").props).toMatchObject({ x: [50], y: [50], alignmentBaseline: "middle" })
})

it.each([
  [undefined, 0xff2563eb],
  ["primary", 0xff2563eb],
  ["secondary", 0xffc6c6c6],
  ["tertiary", 0xff2f7d18],
  ["quaternary", 0xffa66b00],
  ["quintenary", 0xffb73434],
] as const)("uses the existing semantic/compatibility stroke for order %s", async (order, payload) => {
  await render(<CircularProgress value={25} order={order} />)
  expect(part("path").props.stroke).toEqual({ type: 0, payload })
})

it("preserves named-color CSS quirks while currentColor explicitly selects authored paint", async () => {
  const { rerender } = await render(
    <CircularProgress value={25} order="quintenary" pathColor="red" trackColor="blue" />,
  )
  expect(part("path").props).toMatchObject({ color: "red", stroke: { payload: 0xff2563eb } })
  expect(part("track").props).toMatchObject({ color: "blue", stroke: { payload: 0xfff7f7f7 } })
  await rerender(<CircularProgress value={25} pathColor="red" customPathStyles={{ stroke: "currentColor" }} />)
  expect(part("path").props.stroke).toEqual({ type: 2 })
})

it("maps all six style owners, registered arrays and final root/dash precedence", async () => {
  const registered = StyleSheet.create({ root: { height: 61, opacity: 0.6 }, svg: { opacity: 0.7 } })
  const style = jest.fn(({ defaultStyle }: import("../types").TNativeCircularProgressStyleState) => ({
    ...defaultStyle,
    height: 62,
    opacity: 0.8,
  }))
  await render(
    <CircularProgress
      value={25}
      height={50}
      width={60}
      backgroundColor="red"
      text="Quarter"
      customStyles={[registered.root, { width: 65 }]}
      style={style}
      customSVGStyles={[registered.svg, { transform: [{ rotate: "12deg" }] }]}
      customTrackStyles={{ stroke: "green", strokeWidth: 3, strokeDashoffset: 777, strokeDasharray: [1, 2] }}
      customPathStyles={{
        stroke: "blue",
        strokeWidth: 9,
        strokeLinecap: "square",
        strokeDashoffset: 888,
        strokeDasharray: [3, 4],
      }}
      customTextStyles={{ fill: "purple", fontSize: 17, textAnchor: "end", x: 45 }}
      customBackgroundStyles={{ fill: "orange", r: 40, fillOpacity: 0.5 }}
    />,
  )
  expect(screen.getByRole("progressbar")).toHaveStyle({ height: 62, width: 65, opacity: 0.8 })
  expect(style).toHaveBeenCalledWith(
    expect.objectContaining({
      percentage: 25,
      valueText: "25%",
      isIndeterminate: false,
      defaultStyle: expect.objectContaining({ height: 61 }),
    }),
  )
  expect(part("path").props).toMatchObject({ strokeWidth: 9, strokeLinecap: 2, stroke: { payload: 0xff0000ff } })
  expect(part("track").props.strokeDasharray).toEqual([2 * Math.PI * 46, 2 * Math.PI * 46])
  expect(part("track").props.strokeDashoffset).toBeNull()
  expect(part("path").props.strokeDashoffset).not.toBe(888)
  expect(part("text").props).toMatchObject({
    x: [45],
    font: { fontSize: 17, textAnchor: "end" },
    fill: { payload: 0xff800080 },
  })
  expect(part("background").props).toMatchObject({ r: 40, fillOpacity: 0.5, fill: { payload: 0xffffa500 } })
})

it("updates provider paint/fonts without rewriting the value", async () => {
  const { rerender } = await render(
    <NativeThemeProvider>
      <CircularProgress value={0} text="Zero" backgroundColor="red" />
    </NativeThemeProvider>,
  )
  await rerender(
    <NativeThemeProvider
      mode="dark"
      overrides={{
        colors: { controlSelectedBackground: "pink", foreground: "yellow", background: "navy" },
        typography: { fontFamilies: { body: "CustomBody" } },
      }}
    >
      <CircularProgress value={0} text="Zero" backgroundColor="red" />
    </NativeThemeProvider>,
  )
  expect(part("path").props.stroke).toMatchObject({ payload: 0xffffc0cb })
  expect(part("track").props.stroke).toMatchObject({ payload: 0xff202020 })
  expect(part("background").props.fill).toMatchObject({ payload: 0xff000080 })
  expect(part("text").props.font.fontFamily).toBe("CustomBody")
  expect(screen.getByRole("progressbar")).toHaveAccessibilityValue({ now: 0 })
})

it("formats numeric/percent values and canonical falsy labels, including indeterminate state", async () => {
  const style = jest.fn(() => ({}))
  const { rerender } = await render(
    <CircularProgress value={1250} maxValue={2000} locale="en-US" formatOptions={{ style: "decimal" }} style={style} />,
  )
  expect(screen.getByRole("progressbar")).toHaveAccessibilityValue({ text: "1,250" })
  for (const valueLabel of [0, ""] as const) {
    await rerender(<CircularProgress value={25} valueLabel={valueLabel} />)
    expect(screen.getByRole("progressbar")).toHaveAccessibilityValue({ text: "25%" })
  }
  await rerender(<CircularProgress value={25} valueLabel="One quarter" />)
  expect(screen.getByRole("progressbar")).toHaveAccessibilityValue({ text: "One quarter" })
  await rerender(<CircularProgress value={25} isIndeterminate style={style} />)
  expect(screen.getByRole("progressbar").props.accessibilityValue).toEqual({ min: 0, max: 100, text: undefined })
  expect(style).toHaveBeenLastCalledWith(
    expect.objectContaining({ percentage: undefined, valueText: undefined, isIndeterminate: true }),
  )
  expect(part("path").props.strokeDashoffset).toBeCloseTo(0.75 * 2 * Math.PI * 46)
})

it.each([
  { minValue: 5, maxValue: 5 },
  { minValue: 10, maxValue: 5 },
])("keeps canonical nonpositive range ratio zero: %j", async (bounds) => {
  await render(<CircularProgress value={8} {...bounds} />)
  expect(getNativeCircularGeometry({ value: 8, ...bounds }).ratio).toBe(0)
  expect(part("path").props.strokeDashoffset).toBeCloseTo(2 * Math.PI * 46)
  expect(screen.getByRole("progressbar").props.accessibilityValue.now).toBeUndefined()
})

it.each([NaN, Infinity, -Infinity])("never sends nonfinite native drawing data for %s", async (value) => {
  const owner = Object.freeze({ value })
  await render(<CircularProgress {...owner} text="Raw value retained" />)
  expect(Object.is(owner.value, value)).toBe(true)
  expect(part("track").props.strokeDashoffset).toBeNull()
  if (Number.isNaN(value)) expect(screen.queryByTestId("circular-progress-path", hidden)).toBeNull()
  else expect(Number.isFinite(part("path").props.strokeDashoffset ?? 0)).toBe(true)
  expect(part("text").children).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ props: expect.objectContaining({ content: "Raw value retained" }) }),
    ]),
  )
})

it("rejects unsupported CSS color/relationships and invalid authored drawing numbers", async () => {
  await expect(
    render(<CircularProgress value={0} customPathStyles={{ stroke: "var(--cui-control-selected-background)" }} />),
  ).rejects.toThrow(/unsupported native color/)
  await expect(render(<CircularProgress value={0} customTrackStyles={{ strokeWidth: NaN }} />)).rejects.toThrow(
    /nonfinite/,
  )
  await expect(
    render(
      <CircularProgress
        value={0}
        {...({ "aria-describedby": "other" } as unknown as Partial<CircularProgressProps>)}
      />,
    ),
  ).rejects.toThrow(/relationships/)
})

it("accepts native dynamic paint objects and consumes wrapper props at the root", async () => {
  const paint = PlatformColor("labelColor")
  await render(<CircularProgress value={0} customPathStyles={{ stroke: paint }} text="0" />)
  expect(part("path").props.stroke).toEqual({ type: 0, payload: paint })
  const root = screen.getByRole("progressbar")
  for (const prop of ["value", "circleRatio", "strokeWidth", "customPathStyles", "text", "locale", "formatOptions"])
    expect(root.props[prop]).toBeUndefined()
})

it("animates dash updates with canonical350ms timing and stops on replacement/unmount", async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false)
  const timing = jest.spyOn(Animated, "timing")
  const { rerender, unmount } = await render(<CircularProgress value={25} />)
  await act(async () => {
    await Promise.resolve()
  })
  await rerender(<CircularProgress value={75} />)
  expect(timing).toHaveBeenLastCalledWith(
    expect.anything(),
    expect.objectContaining({
      duration: 350,
      toValue: 0.25 * 2 * Math.PI * 46,
      useNativeDriver: false,
      isInteraction: false,
    }),
  )
  const stop = jest.spyOn(Animated.Value.prototype, "stopAnimation")
  await rerender(<CircularProgress value={0} />)
  expect(stop).toHaveBeenCalled()
  const animation = timing.mock.results[timing.mock.results.length - 1].value
  const animationStop = jest.spyOn(animation, "stop")
  await unmount()
  expect(animationStop).toHaveBeenCalled()
})

it("preserves authored SVG dimensions and currentColor inheritance", async () => {
  await render(
    <CircularProgress
      value={50}
      customStyles={{ color: "red" }}
      customSVGStyles={{ color: "blue", width: "75%", height: 42 }}
      customPathStyles={{ stroke: "currentColor" }}
    />,
  )
  expect(part("svg").props.color).toBe("blue")
  expect(part("svg").props.bbWidth).toBe("75%")
  expect(part("svg").props.bbHeight).toBe(42)
  expect(part("path").props.stroke).toEqual({ type: 2 })
})

it("lets current reduced-motion events beat a stale initial request and retires callbacks", async () => {
  let resolveInitial: (value: boolean) => void = () => undefined
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockReturnValue(
    new Promise((resolve) => {
      resolveInitial = resolve
    }),
  )
  const subscriptionSpy = jest.spyOn(AccessibilityInfo, "addEventListener")
  const timing = jest.spyOn(Animated, "timing")
  const { rerender, unmount } = await render(<CircularProgress value={25} />)
  const listener = subscriptionSpy.mock.calls.at(-1)![1] as unknown as (enabled: boolean) => void
  const subscription = subscriptionSpy.mock.results.at(-1)!.value
  await act(() => listener(true))
  await act(async () => resolveInitial(false))
  await rerender(<CircularProgress value={75} />)
  expect(timing).not.toHaveBeenCalled()
  expect(part("path").props.strokeDashoffset).toBeCloseTo(0.25 * 2 * Math.PI * 46)
  await unmount()
  expect(subscription.remove).toHaveBeenCalledTimes(1)
  await act(() => listener(false))
  expect(timing).not.toHaveBeenCalled()
})

it("retains explicit zero drawing dimensions and independent named stroke width", async () => {
  await render(
    <CircularProgress
      value={0}
      width={0}
      height={0}
      strokeWidth={0}
      backgroundColor="red"
      backgroundPadding={0}
      customSVGStyles={{ width: 0, height: 0 }}
    />,
  )
  expect(screen.getByRole("progressbar")).toHaveStyle({ width: 0, height: 0 })
  expect(part("svg").props).toMatchObject({ bbWidth: 0, bbHeight: 0 })
  expect(part("path").props).toMatchObject({
    strokeWidth: 0,
    d: "M 50,50 m 0,-50 a 50,50 0 1 1 0,100 a 50,50 0 1 1 0,-100",
  })
})
