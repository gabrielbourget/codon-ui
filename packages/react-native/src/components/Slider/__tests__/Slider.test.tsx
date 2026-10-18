import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef, useState } from "react"
import { Platform, PlatformColor, StyleSheet, type MeasureOnSuccessCallback } from "react-native"

import {
  NativeThemeProvider,
  Slider,
  type SliderProps,
  type TNativeSliderRef,
  type TNativeSliderStyleState,
} from "../../.."
import { resolveNativeTheme } from "../../../theme/defaults"

type TFrame = [number, number, number, number]
const nativeMethods: { measure: jest.Mock; focus: jest.Mock } = jest.requireActual(
  "@react-native/jest-preset/jest/MockNativeMethods",
).default
let frames: Record<string, TFrame>
let deferred: (() => void)[] | undefined
let captured: TNativeSliderStyleState
const name = { accessibilityLabel: "Quantity" }
const root = () => screen.getByTestId("slider")
const track = () => screen.getByTestId("slider-track")
const target = (index = 1) => screen.getByTestId(`slider-thumb-${index}-target`)
const body = (index = 1) => screen.getByTestId(`slider-thumb-${index}`)
const observe = (state: TNativeSliderStyleState) => {
  captured = state
  return {}
}
const event = (x: number, y = 224, id = 0) => ({
  nativeEvent: { pageX: x, pageY: y, identifier: id, changedTouches: [{ pageX: x, pageY: y, identifier: id }] },
})
const down = (x: number, y?: number, id?: number) => fireEvent(track(), "responderGrant", event(x, y, id))
const move = (x: number, y?: number, id?: number) => fireEvent(track(), "responderMove", event(x, y, id))
const up = (x: number, y?: number, id?: number) => fireEvent(track(), "responderRelease", event(x, y, id))
const measure = (width = 300, height = 48) =>
  fireEvent(track(), "layout", { nativeEvent: { layout: { x: 0, y: 0, width, height } } })
const action = (name: string, index = 1) =>
  fireEvent(target(index), "accessibilityAction", { nativeEvent: { actionName: name } })
beforeEach(() => {
  jest.replaceProperty(Platform, "OS", "android")
  frames = {
    "slider-track": [100, 200, 300, 48],
    "slider-thumb-1-target": [100, 200, 48, 48],
    "slider-thumb-1": [115, 215, 18, 18],
  }
  deferred = undefined
  nativeMethods.measure.mockImplementation(function (
    this: { props: { testID: string } },
    callback: MeasureOnSuccessCallback,
  ) {
    const frame = frames[this.props.testID]
    if (!frame) throw new Error(`Unexpected native measure ${this.props.testID}`)
    const resolve = () => callback(0, 0, frame[2], frame[3], frame[0], frame[1])
    if (deferred) deferred.push(resolve)
    else resolve()
  })
  nativeMethods.focus.mockClear()
})
afterEach(() => jest.restoreAllMocks())

it("CAP.slider.001 renders one minimum adjustable thumb and separate label/output owners", async () => {
  await render(<Slider {...name} label="Quantity" />)
  expect(target()).toHaveAccessibilityValue({ min: 0, max: 100, now: 0, text: "0" })
  expect(screen.getByRole("adjustable", { name: "Quantity, Slider Thumb 1" })).toBeOnTheScreen()
  expect(screen.getByTestId("slider-output")).toHaveTextContent("0")
  expect(root().props.accessible).toBe(false)
  expect(track().props.accessible).toBe(false)
  expect(body()).toHaveStyle({ minHeight: 18, height: 18, aspectRatio: 1 })
})

it("CAP.slider.002–.003 preserves zero and native dimensions with final root overrides", async () => {
  const { rerender } = await render(<Slider {...name} width={0} height={0} maxWidth={0} />)
  expect(root()).toHaveStyle({ width: 0, height: 0, maxWidth: 0 })
  await rerender(
    <Slider
      {...name}
      width="100%"
      maxWidth="50%"
      height={50}
      customStyles={{ marginTop: 5 }}
      style={{ width: 175, marginBottom: 10 }}
    />,
  )
  expect(root()).toHaveStyle({ width: 175, height: 50, maxWidth: "50%", marginTop: 5, marginBottom: 10 })
})

it("CAP.slider.004 keeps container color separate from the painted rail and explicit thumb color", async () => {
  await render(<Slider {...name} trackColor="red" thumbColor="blue" />)
  expect(track()).toHaveStyle({ backgroundColor: "red" })
  expect(screen.getByTestId("slider-rail")).toHaveStyle({
    backgroundColor: resolveNativeTheme("light").colors.controlBorder,
    height: 3,
  })
  expect(body()).toHaveStyle({ backgroundColor: "blue" })
  await down(124)
  expect(body()).toHaveStyle({ backgroundColor: "blue" })
})

it.each([
  ["round", 10000],
  ["rounded", 5],
  ["orthogonal", 0],
] as const)("CAP.slider.005 retains %s visual geometry", async (geometry, radius) => {
  await render(<Slider {...name} geometry={geometry} />)
  expect(body()).toHaveStyle({ borderRadius: radius })
  expect(screen.getByTestId("slider-rail")).toHaveStyle({ borderRadius: radius })
})

it.each(["primary", "secondary", "tertiary", "quaternary", "quintenary"] as const)(
  "CAP.slider.006–.007 maps %s resting/drag colors in both modes",
  async (order) => {
    const show = (mode: "light" | "dark") => (
      <NativeThemeProvider mode={mode}>
        <Slider {...name} order={order} />
      </NativeThemeProvider>
    )
    const { rerender } = await render(show("light"))
    expect(body()).toHaveStyle({ backgroundColor: resolveNativeTheme("light").actions[order].background })
    await down(124)
    expect(body()).toHaveStyle({ backgroundColor: resolveNativeTheme("light").actions[order].hoverBackground })
    await up(124)
    await rerender(show("dark"))
    expect(body()).toHaveStyle({ backgroundColor: resolveNativeTheme("dark").actions[order].background })
    await down(124)
    expect(body()).toHaveStyle({ backgroundColor: resolveNativeTheme("dark").actions[order].hoverBackground })
  },
)

it.each(["light", "dark"] as const)(
  "uses the canonical local neutral700 while dragging without an order in %s",
  async (mode) => {
    await render(
      <NativeThemeProvider mode={mode}>
        <Slider {...name} />
      </NativeThemeProvider>,
    )
    await down(124)
    expect(body()).toHaveStyle({ backgroundColor: mode === "dark" ? "#9e9e9e" : "#474747" })
  },
)

it("CAP.slider.008–.009 controls visual shadow and native focus outline", async () => {
  const { rerender } = await render(<Slider {...name} />)
  expect(body()).toHaveStyle({ elevation: 2 })
  await fireEvent(target(), "focus", { nativeEvent: {} })
  expect(target()).toHaveStyle({ outlineWidth: 2, outlineOffset: 3.5 })
  await rerender(<Slider {...name} raised={false} offsetFocusRing={false} />)
  expect(StyleSheet.flatten(body().props.style).elevation).toBeUndefined()
  expect(target()).toHaveStyle({ outlineOffset: 0 })
  await rerender(<Slider {...name} raised={false} enableFocusStyle={false} />)
  expect(StyleSheet.flatten(target().props.style).outlineWidth).toBeUndefined()
})

it.each([true, false])("CAP.slider.010–.011 retains disabled=%s", async (isDisabled) => {
  const changed = jest.fn(),
    ended = jest.fn()
  await render(<Slider {...name} value={0} isDisabled={isDisabled} onChange={changed} onChangeEnd={ended} />)
  await measure()
  await down(250)
  await up(250)
  expect(changed.mock.calls).toEqual(isDisabled ? [] : [[50]])
  expect(ended.mock.calls).toEqual(isDisabled ? [] : [[50]])
  expect(target().props.accessibilityState.disabled).toBe(isDisabled)
})

it("CAP.slider.012 gives all five style owners registered/native color support", async () => {
  const registered = StyleSheet.create({ root: { marginTop: 5 }, thumb: { borderRadius: 0 } })
  const color = PlatformColor("labelColor")
  await render(
    <Slider
      {...name}
      customStyles={[registered.root, { backgroundColor: color }]}
      customLabelStyles={{ color: "green" }}
      customOutputStyles={{ color: "blue" }}
      customTrackStyles={{ backgroundColor: "yellow" }}
      customThumbStyles={[registered.thumb, { backgroundColor: "magenta" }]}
    />,
  )
  expect(root()).toHaveStyle({ marginTop: 5, backgroundColor: color })
  expect(screen.getByTestId("slider-label")).toHaveStyle({ color: "green" })
  expect(screen.getByTestId("slider-output")).toHaveStyle({ color: "blue" })
  expect(track()).toHaveStyle({ backgroundColor: "yellow" })
  expect(body()).toHaveStyle({ backgroundColor: "magenta", borderRadius: 0 })
})

it("CAP.slider.013 exposes native render state, a root ref and post-custom defaults", async () => {
  const ref = createRef<TNativeSliderRef>()
  const style = jest.fn(observe)
  await render(<Slider {...name} ref={ref} value={0} height={50} customStyles={{ marginTop: 5 }} style={style} />)
  expect(ref.current).toBeTruthy()
  expect(typeof ref.current?.measure).toBe("function")
  expect(style).toHaveBeenLastCalledWith(
    expect.objectContaining({
      orientation: "horizontal",
      isDisabled: false,
      defaultStyle: expect.objectContaining({ width: 300, maxWidth: 300, height: 50, marginTop: 5 }),
    }),
  )
  expect(captured.state.values).toEqual([0])
  expect(captured.state.pageSize).toBe(10)
})

it("CAP.slider.014 keeps native identity/events and consumes calibration/ownership props", async () => {
  const layout = jest.fn()
  await render(
    <Slider
      {...name}
      value={0}
      testID="named"
      data-testid="alias"
      nativeID="root-id"
      onLayout={layout}
      labelID="quantity-label"
      thumbAriaLabels={["First"]}
    />,
  )
  const node = screen.getByTestId("named")
  const e = { nativeEvent: { layout: { x: 1, y: 2, width: 300, height: 48 } } }
  await fireEvent(node, "layout", e)
  expect(layout.mock.calls[0]?.[0]).toBe(e)
  expect(node.props.nativeID).toBe("root-id")
  expect(screen.queryByTestId("alias")).toBeNull()
  expect(screen.getByTestId("named-label").props.nativeID).toBe("quantity-label")
  for (const key of [
    "value",
    "defaultValue",
    "onChange",
    "onChangeEnd",
    "minValue",
    "maxValue",
    "step",
    "thumbColor",
    "trackColor",
    "geometry",
    "order",
    "customStyles",
    "thumbAriaLabels",
    "labelID",
  ])
    expect(node.props[key]).toBeUndefined()
  expect(screen.getByRole("adjustable", { name: "Quantity, First" })).toBeOnTheScreen()
})

it("uses array callbacks by default, scalar callbacks for numeric defaults, and initializes once", async () => {
  const changed = jest.fn(),
    ended = jest.fn()
  const { rerender } = await render(<Slider {...name} onChange={changed} onChangeEnd={ended} />)
  await action("increment")
  expect(changed.mock.calls).toEqual([[[1]]])
  expect(ended.mock.calls).toEqual([[[1]]])
  await rerender(<Slider {...name} defaultValue={[80]} onChange={changed} onChangeEnd={ended} />)
  expect(target()).toHaveAccessibilityValue({ now: 1 })
})

it("keeps empty arrays empty and gives the output formatter a disposable copy", async () => {
  const values: number[] = []
  const formatter = jest.fn((copy: number[]) => {
    copy.push(99)
    return "Empty"
  })
  await render(<Slider {...name} value={values} customOutputFormatter={formatter} />)
  expect(screen.queryAllByRole("adjustable")).toHaveLength(0)
  expect(screen.getByTestId("slider-output")).toHaveTextContent("Empty")
  expect(values).toEqual([])
  expect(track().props.onStartShouldSetResponderCapture()).toBe(false)
})

it("preserves zero, controlled array identity, adjacent bounds and repeated owner veto", async () => {
  const values = [0, 50, 100]
  const changed = jest.fn(),
    ended = jest.fn()
  await render(<Slider {...name} value={values} onChange={changed} onChangeEnd={ended} />)
  await action("increment")
  await action("increment")
  expect(changed.mock.calls).toEqual([[[1, 50, 100]], [[1, 50, 100]]])
  expect(ended.mock.calls).toEqual([[[1, 50, 100]], [[1, 50, 100]]])
  expect(target()).toHaveAccessibilityValue({ now: 0, max: 50 })
  expect(values).toEqual([0, 50, 100])
})

it("tracks a real track press/move/final release and emits the final end after changes", async () => {
  const trace: unknown[] = []
  await render(
    <Slider
      {...name}
      defaultValue={0}
      onChange={(next) => trace.push(["change", next])}
      onChangeEnd={(next) => trace.push(["end", next])}
    />,
  )
  await measure()
  await down(250)
  await move(300)
  await up(310)
  expect(trace).toEqual([
    ["change", 50],
    ["change", 70],
    ["change", 74],
    ["end", 74],
  ])
  expect(target()).toHaveAccessibilityValue({ now: 74 })
})

it("grabs a thumb without jumping and retains grab offset for the drag", async () => {
  const changed = jest.fn(),
    ended = jest.fn()
  await render(<Slider {...name} defaultValue={0} onChange={changed} onChangeEnd={ended} />)
  await measure()
  await down(126)
  expect(changed).not.toHaveBeenCalled()
  await move(189)
  await up(252)
  expect(changed.mock.calls).toEqual([[25], [50]])
  expect(ended.mock.calls).toEqual([[50]])
})

it("publishes the last request at end while a controlled owner repeatedly declines", async () => {
  const changed = jest.fn(),
    ended = jest.fn()
  await render(<Slider {...name} value={0} onChange={changed} onChangeEnd={ended} />)
  await measure()
  await down(250)
  await move(300)
  await up(310)
  expect(changed.mock.calls).toEqual([[50], [70], [74]])
  expect(ended.mock.calls).toEqual([[74]])
  expect(target()).toHaveAccessibilityValue({ now: 0 })
  await down(250)
  await up(250)
  expect(changed).toHaveBeenLastCalledWith(50)
  expect(ended).toHaveBeenLastCalledWith(50)
})

it.each(["rtl", "vertical"] as const)("reverses the measured axis for %s", async (kind) => {
  const changed = jest.fn()
  frames["slider-track"] = kind === "vertical" ? [100, 200, 48, 300] : [100, 200, 300, 48]
  frames["slider-thumb-1-target"] = [-100, -100, 48, 48]
  frames["slider-thumb-1"] = [-100, -100, 18, 18]
  await render(
    <Slider
      {...name}
      value={0}
      onChange={changed}
      direction={kind === "rtl" ? "rtl" : "ltr"}
      orientation={kind === "vertical" ? "vertical" : "horizontal"}
    />,
  )
  await measure(...((kind === "vertical" ? [48, 300] : [300, 48]) as [number, number]))
  await down(kind === "vertical" ? 124 : 187, kind === "vertical" ? 287 : 224)
  expect(changed.mock.calls).toEqual([[75]])
})

it("selects the end thumb for equidistant track presses and prevents crossing", async () => {
  const changed = jest.fn()
  frames["slider-thumb-2-target"] = [352, 200, 48, 48]
  frames["slider-thumb-2"] = [367, 215, 18, 18]
  await render(<Slider {...name} value={[20, 80]} onChange={changed} style={observe} />)
  await measure()
  await down(250)
  await up(250)
  expect(changed.mock.calls).toEqual([[[20, 50]]])
  await act(() => captured.state.setThumbValue(0, 99))
  expect(changed).toHaveBeenLastCalledWith([80, 80])
  expect(captured.state.values).toEqual([20, 80])
})

it("waits for all thumbs to finish before emitting one multi-pointer end", async () => {
  const changed = jest.fn(),
    ended = jest.fn()
  frames["slider-thumb-1-target"] = [150.4, 200, 48, 48]
  frames["slider-thumb-1"] = [165.4, 215, 18, 18]
  frames["slider-thumb-2-target"] = [301.6, 200, 48, 48]
  frames["slider-thumb-2"] = [316.6, 215, 18, 18]
  await render(<Slider {...name} value={[20, 80]} onChange={changed} onChangeEnd={ended} />)
  await measure()
  await down(174.4, 224, 0)
  await fireEvent(track(), "responderStart", event(325.6, 224, 1))
  await move(224.8, 224, 0)
  await move(275.2, 224, 1)
  await fireEvent(track(), "responderEnd", event(224.8, 224, 0))
  expect(ended).not.toHaveBeenCalled()
  await up(275.2, 224, 1)
  expect(changed.mock.calls).toEqual([[[40, 80]], [[40, 60]]])
  expect(ended.mock.calls).toEqual([[[40, 60]]])
})

it("preserves queued native coordinates and a quick release until measurement completes", async () => {
  const changed = jest.fn(),
    ended = jest.fn()
  deferred = []
  await render(<Slider {...name} value={0} onChange={changed} onChangeEnd={ended} />)
  await measure()
  await down(250)
  await move(300)
  await up(310)
  expect(changed).not.toHaveBeenCalled()
  expect(ended).not.toHaveBeenCalled()
  await act(() => {
    for (const resolve of deferred!) resolve()
  })
  expect(changed.mock.calls).toEqual([[50], [70], [74]])
  expect(ended.mock.calls).toEqual([[74]])
})

it.each(["disabled", "value", "bounds", "count", "direction"] as const)(
  "retires delayed gestures after %s takeover",
  async (kind) => {
    const changed = jest.fn(),
      ended = jest.fn()
    deferred = []
    const first: SliderProps = { ...name, value: [0], onChange: changed, onChangeEnd: ended }
    const { rerender } = await render(<Slider {...first} />)
    await measure()
    await down(250)
    const next: SliderProps = {
      ...first,
      ...(kind === "disabled"
        ? { isDisabled: true }
        : kind === "value"
          ? { value: [25] }
          : kind === "bounds"
            ? { maxValue: 200 }
            : kind === "count"
              ? { value: [] }
              : { direction: "rtl" }),
    }
    await rerender(<Slider {...next} />)
    await act(() => {
      for (const resolve of deferred!) resolve()
    })
    expect(changed).not.toHaveBeenCalled()
    expect(ended).not.toHaveBeenCalled()
  },
)

it("retires delayed/native/public-state mutations after unmount", async () => {
  const changed = jest.fn(),
    ended = jest.fn()
  deferred = []
  const { unmount } = await render(
    <Slider {...name} value={0} onChange={changed} onChangeEnd={ended} style={observe} />,
  )
  await measure()
  await down(250)
  const old = captured.state
  await unmount()
  await act(() => {
    for (const resolve of deferred!) resolve()
    old.setThumbValue(0, 40)
    old.setThumbDragging(0, false)
  })
  expect(changed).not.toHaveBeenCalled()
  expect(ended).not.toHaveBeenCalled()
})

it("ends a valid responder termination once and ignores late release", async () => {
  const ended = jest.fn()
  await render(<Slider {...name} value={0} onChangeEnd={ended} />)
  await measure()
  await down(250)
  await fireEvent(track(), "responderTerminate", event(250))
  await up(250)
  expect(ended.mock.calls).toEqual([[50]])
})

it("supports formatter/state APIs, scalar helpers and editable guards", async () => {
  const changed = jest.fn()
  await render(
    <Slider
      {...name}
      value={[0.2, 0.8]}
      minValue={0}
      maxValue={1}
      step={0.1}
      locale="fr-CA"
      formatOptions={{ style: "percent" }}
      style={observe}
      onChange={changed}
    />,
  )
  expect(screen.getByTestId("slider-output")).toHaveTextContent(/20.*80/)
  expect(captured.state.getThumbPercent(0)).toBe(0.2)
  expect(captured.state.getThumbMinValue(1)).toBe(0.2)
  expect(captured.state.getThumbMaxValue(0)).toBe(0.8)
  expect(captured.state.getFormattedValue(0.5)).toMatch(/50/)
  expect(captured.state.getPercentValue(0.35)).toBeCloseTo(0.3)
  await act(() => captured.state.setThumbEditable(0, false))
  await action("increment")
  expect(changed).not.toHaveBeenCalled()
  await act(() => captured.state.setThumbEditable(0, true))
  await act(() => captured.state.incrementThumb(0))
  expect(changed).toHaveBeenLastCalledWith([0.8, 0.8])
})

it.each([
  { step: 0 },
  { minValue: 1, maxValue: 0 },
  { value: NaN },
  { width: "2rem" },
  { maxWidth: "calc(100% - 20px)" },
  { thumbColor: "var(--cui-foreground)" },
])("rejects invalid native input %j", async (props) => {
  const logged = jest.spyOn(console, "error").mockImplementation(() => undefined)
  try {
    await expect(render(<Slider {...name} {...(props as SliderProps)} />)).rejects.toThrow()
  } finally {
    logged.mockRestore()
  }
})

it("keeps the independent iOS44-unit endpoint and drag calibration", async () => {
  jest.replaceProperty(Platform, "OS", "ios")
  frames["slider-track"] = [100, 200, 300, 44]
  frames["slider-thumb-1-target"] = [100, 200, 44, 44]
  frames["slider-thumb-1"] = [113, 213, 18, 18]
  const changed = jest.fn(),
    ended = jest.fn()
  await render(<Slider {...name} value={0} onChange={changed} onChangeEnd={ended} />)
  await measure(300, 44)
  expect(target()).toHaveStyle({ width: 44, height: 44 })
  await down(122)
  await move(186)
  await up(250)
  expect(changed.mock.calls).toEqual([[25], [50]])
  expect(ended.mock.calls).toEqual([[50]])
})

it("continues through normal owner echo and preserves mounted values through provider changes", async () => {
  const changed = jest.fn(),
    ended = jest.fn()
  const Example = ({ mode }: { mode: "light" | "dark" }) => {
    const [value, setValue] = useState(0)
    return (
      <NativeThemeProvider mode={mode}>
        <Slider
          {...name}
          value={value}
          onChange={(next) => {
            changed(next)
            setValue(next)
          }}
          onChangeEnd={ended}
        />
      </NativeThemeProvider>
    )
  }
  const { rerender } = await render(<Example mode="light" />)
  await measure()
  await down(250)
  await move(300)
  await up(310)
  expect(changed.mock.calls).toEqual([[50], [70], [74]])
  expect(ended.mock.calls).toEqual([[74]])
  await rerender(<Example mode="dark" />)
  expect(target()).toHaveAccessibilityValue({ now: 74 })
})

it("ignores an old native action after its thumb is removed", async () => {
  const changed = jest.fn(),
    ended = jest.fn()
  const { rerender } = await render(<Slider {...name} value={[0, 50]} onChange={changed} onChangeEnd={ended} />)
  const old = target(2).props.onAccessibilityAction
  await rerender(<Slider {...name} value={[]} onChange={changed} onChangeEnd={ended} />)
  await act(() => old({ nativeEvent: { actionName: "increment" } }))
  expect(changed).not.toHaveBeenCalled()
  expect(ended).not.toHaveBeenCalled()
})

it("owns the native responder while a valid gesture is active", async () => {
  await render(<Slider {...name} value={0} />)
  await measure()
  let result: unknown
  await act(() => {
    result = track().props.onResponderGrant(event(250))
  })
  expect(result).toBe(true)
  expect(track().props.onResponderTerminationRequest()).toBe(false)
  await up(250)
  expect(track().props.onResponderTerminationRequest()).toBe(true)
})

it("keeps initial controlled reset metadata and accepts later explicit defaults without changing the value", async () => {
  const { rerender } = await render(<Slider {...name} value={20} style={observe} />)
  expect(captured.state.defaultValues).toEqual([20])
  await rerender(<Slider {...name} value={30} style={observe} />)
  expect(captured.state.defaultValues).toEqual([20])
  await rerender(<Slider {...name} value={30} defaultValue={50} style={observe} />)
  expect(captured.state.defaultValues).toEqual([50])
  expect(target()).toHaveAccessibilityValue({ now: 30 })
})

it("uses resolved root sizing for vertical native extent and preserves explicit zero", async () => {
  const { rerender } = await render(<Slider {...name} orientation="vertical" height="auto" />)
  expect(track()).toHaveStyle({ height: 150 })
  await rerender(<Slider {...name} orientation="vertical" style={{ height: 200 }} />)
  expect(track()).toHaveStyle({ flex: 1, minHeight: 0 })
  await rerender(<Slider {...name} orientation="vertical" height={200} style={{ height: 0 }} />)
  expect(root()).toHaveStyle({ height: 0 })
  expect(track()).toHaveStyle({ flex: 1, minHeight: 0 })
})

it("retires a delayed thumb through editable takeover even when it is restored before measurement", async () => {
  const changed = jest.fn(),
    ended = jest.fn()
  deferred = []
  await render(<Slider {...name} value={0} onChange={changed} onChangeEnd={ended} style={observe} />)
  await measure()
  await down(250)
  await act(() => captured.state.setThumbEditable(0, false))
  await act(() => captured.state.setThumbEditable(0, true))
  await act(() => {
    for (const resolve of deferred!) resolve()
  })
  expect(changed).not.toHaveBeenCalled()
  expect(ended).not.toHaveBeenCalled()
})

it("keeps the other pointer active when one thumb becomes uneditable", async () => {
  const changed = jest.fn(),
    ended = jest.fn()
  frames["slider-thumb-1-target"] = [150.4, 200, 48, 48]
  frames["slider-thumb-1"] = [165.4, 215, 18, 18]
  frames["slider-thumb-2-target"] = [301.6, 200, 48, 48]
  frames["slider-thumb-2"] = [316.6, 215, 18, 18]
  await render(<Slider {...name} value={[20, 80]} onChange={changed} onChangeEnd={ended} style={observe} />)
  await measure()
  await down(174.4, 224, 0)
  await fireEvent(track(), "responderStart", event(325.6, 224, 1))
  await move(224.8, 224, 0)
  await act(() => captured.state.setThumbEditable(0, false))
  await move(275.2, 224, 1)
  await up(224.8, 224, 0)
  expect(ended).not.toHaveBeenCalled()
  await up(275.2, 224, 1)
  expect(changed.mock.calls).toEqual([[[40, 80]], [[40, 60]]])
  expect(ended.mock.calls).toEqual([[[40, 60]]])
})

it("rejects stale layout/focus/action callbacks across removal and reinsertion", async () => {
  const changed = jest.fn(),
    ended = jest.fn()
  const show = (values: number[]) => <Slider {...name} value={values} onChange={changed} onChangeEnd={ended} />
  const { rerender } = await render(show([0, 50]))
  const oldBody = body(2).props.onLayout,
    oldTarget = target(2).props.onLayout,
    oldFocus = target(2).props.onFocus,
    oldAction = target(2).props.onAccessibilityAction
  await rerender(show([0]))
  await rerender(show([0, 50]))
  await act(() => {
    oldBody({ nativeEvent: { layout: { width: 200, height: 200 } } })
    oldTarget({ nativeEvent: { layout: { width: 200, height: 200 } } })
    oldFocus()
    oldAction({ nativeEvent: { actionName: "increment" } })
  })
  expect(target(2)).toHaveStyle({ width: 48, height: 48 })
  expect(changed).not.toHaveBeenCalled()
  expect(ended).not.toHaveBeenCalled()
  expect(nativeMethods.focus).not.toHaveBeenCalled()
})

it("ignores invalid native geometry and retains the last valid coordinate surface", async () => {
  await render(<Slider {...name} value={0} />)
  await measure()
  expect(target()).toHaveStyle({ left: 24 })
  await measure(NaN, 48)
  await measure(-1, 48)
  await fireEvent(body(), "layout", { nativeEvent: { layout: { width: Infinity, height: 18 } } })
  expect(target()).toHaveStyle({ left: 24, width: 48, height: 48 })
})

it("forwards native contextual hints and requests the first thumb ref from its label", async () => {
  await render(<Slider {...name} label="Quantity" accessibilityHint="Adjust this range" value={[0, 50]} />)
  expect(target().props.accessibilityHint).toBe("Adjust this range")
  expect(target(2).props.accessibilityHint).toBe("Adjust this range")
  await fireEvent.press(screen.getByTestId("slider-label"))
  expect(nativeMethods.focus).toHaveBeenCalledTimes(1)
})

it("supports a fixed zero domain without NaN placement or fabricated changes", async () => {
  const changed = jest.fn(),
    ended = jest.fn()
  await render(<Slider {...name} value={0} minValue={0} maxValue={0} onChange={changed} onChangeEnd={ended} />)
  await measure()
  expect(target()).toHaveStyle({ left: 24 })
  expect(target()).toHaveAccessibilityValue({ min: 0, max: 0, now: 0, text: "0" })
  expect(target().props.accessibilityActions).toEqual([])
  await down(250)
  await up(250)
  expect(changed).not.toHaveBeenCalled()
  expect(ended.mock.calls).toEqual([[0]])
})
