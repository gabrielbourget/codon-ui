import { act, fireEvent, render, screen, within } from "@testing-library/react-native"
import { AccessibilityInfo, processColor, StyleSheet } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"

import { NativeShowcase } from "../NativeShowcase"

beforeEach(() => jest.useFakeTimers())
afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})
const enter = async () => {
  await render(
    <SafeAreaInsetsContext.Provider value={{ top: 20, bottom: 10, left: 0, right: 0 }}>
      <NativeShowcase />
    </SafeAreaInsetsContext.Provider>,
  )
  const press = async (name: string) => {
    await fireEvent.press(screen.getByRole("button", { name }))
    await act(() => jest.advanceTimersByTime(1000))
  }
  await press("Reset scene")
  await press("Basic controls scene")
  await press("Prepare standalone Switch checks")
  return press
}
const node = (id: string) => screen.getByTestId(id, { includeHiddenElements: true })
const target = () => node("switch-native-target")
const state = () => JSON.parse(node("switch-native-state").props.accessibilityLabel)
const payload = { target: 79, currentTarget: 81, nativeEvent: { timestamp: 10 } }

it("prepares repeated owner veto, boolean echo, original callbacks and uncontrolled read-once defaults", async () => {
  const press = await enter()
  await fireEvent.press(target(), payload)
  await fireEvent.press(target(), payload)
  expect(state()).toMatchObject({
    selected: false,
    actions: 2,
    requests: [true, true],
    phases: ["change", "press", "change", "press"],
  })
  await press("Next Switch check")
  await fireEvent.press(target(), payload)
  await fireEvent.press(target(), payload)
  expect(state()).toMatchObject({ selected: false, actions: 4, requests: [true, true, true, false] })
  expect(state().events.at(-1)).toMatchObject({ phase: "press", target: 79, currentTarget: 81 })
  for (let i = 0; i < 9; i++) await press("Next Switch check")
  expect(state().case).toBe("local")
  await fireEvent.press(target(), payload)
  await fireEvent.press(target(), payload)
  expect(state().selected).toBe(false)
  await press("Next Switch check")
  expect(state()).toMatchObject({ case: "local-default-changed", selected: false })
  expect(target().props.accessibilityState.checked).toBe(false)
})

it("prepares disabled/read-only and held disable cancellation without invented activation", async () => {
  const press = await enter()
  await press("Next Switch check")
  await press("Next Switch check")
  await fireEvent.press(target(), payload)
  expect(state().actions).toBe(0)
  await press("Next Switch check")
  await fireEvent.press(target(), payload)
  expect(state()).toMatchObject({ readonly: true, actions: 0, requests: [] })
  await press("Next Switch check")
  await fireEvent(target(), "pressIn", payload)
  expect(state()).toMatchObject({ disabled: true, canceled: true })
  await fireEvent(target(), "pressOut", payload)
  await fireEvent.press(target(), payload)
  expect(state()).toMatchObject({ actions: 0, requests: [] })
})

it("preflights every authored root/track/indicator/content property against independently measured native references", async () => {
  const press = await enter()
  await press("Switch styles checks")
  const flatten = (id: string) => StyleSheet.flatten(node(id).props.style)
  const edge = (style: Record<string, unknown>, side: string) =>
    style["padding" + side] ??
    style[side === "Left" || side === "Right" ? "paddingHorizontal" : "paddingVertical"] ??
    style.padding ??
    0
  for (let i = 0; i < 20; i++) {
    if (state().case === "dark") await press("Dark theme")
    if (state().case === "light-restored") await press("Light theme")
    const track = flatten("switch-native-target-track")
    const root = flatten("switch-native-target")
    const width = typeof track.width === "string" ? Number(root.width) * 0.5 : track.width
    const round = (value: number) => Math.round(value * 3) / 3
    const event = {
      nativeEvent: {
        layout: {
          x: 0,
          y: 0,
          width: round(width - 2 * track.borderWidth),
          height: round(track.height - 2 * track.borderWidth),
        },
      },
    }
    await fireEvent(node("switch-native-target-track-content"), "layout", event)
    await fireEvent(node("switch-native-reference-content"), "layout", event)
    for (const prefix of ["switch-native-target", "switch-native-reference"]) {
      const indicator = flatten(prefix + "-indicator")
      await fireEvent(node(prefix + "-indicator"), "layout", {
        nativeEvent: { layout: { x: 0, y: 0, width: round(indicator.width), height: round(indicator.height) } },
      })
    }
    await act(() => jest.advanceTimersByTime(1000))
    for (const property of [
      "width",
      "height",
      "minWidth",
      "minHeight",
      "flexDirection",
      "alignItems",
      "justifyContent",
      "gap",
      "opacity",
      "overflow",
    ])
      expect({ case: state().case, property, value: flatten("switch-native-target")[property] }).toEqual({
        case: state().case,
        property,
        value: flatten("switch-native-reference")[property],
      })
    for (const side of ["Left", "Right", "Top", "Bottom"])
      expect(edge(flatten("switch-native-target"), side)).toEqual(edge(flatten("switch-native-reference"), side))
    expect(processColor(flatten("switch-native-target").backgroundColor)).toEqual(
      processColor(flatten("switch-native-reference").backgroundColor),
    )
    for (const part of ["track", "indicator"]) {
      const actual = flatten("switch-native-target-" + part),
        reference = flatten("switch-native-reference-" + part)
      for (const property of part === "track"
        ? ["width", "height", "borderWidth", "borderRadius"]
        : [
            "width",
            "height",
            "left",
            "top",
            "position",
            "borderRadius",
            "shadowOffset",
            "shadowOpacity",
            "shadowRadius",
            "elevation",
          ])
        expect({ case: state().case, part, property, value: actual[property] }).toEqual({
          case: state().case,
          part,
          property,
          value: reference[property],
        })
      for (const property of ["backgroundColor", "borderColor", "shadowColor"])
        expect(processColor(actual[property])).toEqual(processColor(reference[property]))
    }
    if (state().display) {
      const actual = StyleSheet.flatten(within(target()).getByText(state().display).props.style),
        reference = flatten("switch-native-reference-text")
      for (const property of ["fontSize", "fontFamily", "fontStyle", "fontWeight", "lineHeight", "flexShrink"])
        expect(actual[property]).toEqual(reference[property])
      expect(processColor(actual.color)).toEqual(processColor(reference.color))
    }
    if (i < 19) await press("Next Switch check")
  }
})

it("preserves timer epochs through repeated retargets and retirement", async () => {
  const press = await enter()
  await press("Switch motion checks")
  await fireEvent.press(screen.getByRole("button", { name: "Arm Switch motion and retirement" }))
  await act(() => jest.advanceTimersByTime(16400))
  const trace = state().motionTrace
  expect(trace).toHaveLength(35)
  expect(trace[1].epochMs - trace[0].epochMs).toBe(125)
  expect(trace.at(-1).epochMs - trace[0].epochMs).toBe(10000)
  expect(state()).toMatchObject({ selected: true, visible: true })
})

it("records delivered motion layout fields synchronously while preserving the original measurement handlers", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  const press = await enter()
  await press("Switch motion checks")
  await press("Record native Switch layouts")
  await press("Arm Switch motion and retirement")
  const deliver = async (part: string, width: number) => {
    await fireEvent(node(part), "layout", {
      target: 79,
      currentTarget: 81,
      nativeEvent: { layout: { x: 0, y: 0, width, height: 15 } },
    })
  }
  await deliver("switch-native-target-track-content", 30)
  await deliver("switch-native-target-indicator", 15.000001907348633)
  await act(() => jest.advanceTimersByTime(2500))
  expect(StyleSheet.flatten(node("switch-native-target-indicator").props.style).left).toBeCloseTo(
    30 - 15.000001907348633,
    7,
  )
  await act(() => jest.advanceTimersByTime(7000))
  expect(state().motionLayouts).toEqual([
    expect.objectContaining({
      part: "switch-native-target-track-content",
      target: 79,
      currentTarget: 81,
      layout: { x: 0, y: 0, width: 30, height: 15 },
    }),
    expect.objectContaining({
      part: "switch-native-target-indicator",
      target: 79,
      currentTarget: 81,
      layout: { x: 0, y: 0, width: 15.000001907348633, height: 15 },
    }),
  ])
})
