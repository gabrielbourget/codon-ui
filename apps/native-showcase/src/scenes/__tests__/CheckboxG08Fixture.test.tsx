import { act, fireEvent, render, screen, within } from "@testing-library/react-native"
import { processColor, StyleSheet } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"

import { Checkbox } from "@codon-ui/react-native"

import { NativeShowcase } from "../NativeShowcase"

jest.mock("@codon-ui/react-native", () => {
  const native = jest.requireActual<typeof import("@codon-ui/react-native")>("@codon-ui/react-native")
  const react = jest.requireActual<typeof import("react")>("react")
  return {
    ...native,
    Checkbox: jest.fn((props: Parameters<typeof native.Checkbox>[0]) => react.createElement(native.Checkbox, props)),
  }
})

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
  await press("Prepare standalone Checkbox checks")
  return press
}
const node = (id: string) => screen.getByTestId(id, { includeHiddenElements: true })
const target = () => node("checkbox-native-target")
const state = () => JSON.parse(node("checkbox-native-state").props.accessibilityLabel)
const payload = { target: 79, currentTarget: 81, nativeEvent: { timestamp: 10 } }
const advance = async (press: (name: string) => Promise<void>, name: string) => {
  while (state().case !== name) await press("Next Checkbox check")
}

it("prepares Checkbox veto, echo, mixed ownership, grouped ordering and uncontrolled defaults", async () => {
  const press = await enter()
  await fireEvent.press(target(), payload)
  await fireEvent.press(target(), payload)
  expect(state()).toMatchObject({
    selected: false,
    actions: 2,
    requests: [true, true],
    phases: ["change", "press", "change", "press"],
  })
  await advance(press, "echo")
  await fireEvent.press(target(), payload)
  await fireEvent.press(target(), payload)
  expect(state()).toMatchObject({ selected: false, actions: 4, requests: [true, true, true, false] })
  await advance(press, "mixed")
  expect(target().props.accessibilityState.checked).toBe("mixed")
  await fireEvent.press(target(), payload)
  expect(target().props.accessibilityState.checked).toBe("mixed")
  await advance(press, "group-veto")
  expect(state().selected).toBe(false)
  await fireEvent.press(target(), payload)
  expect(state()).toMatchObject({ selected: false, groupValue: [], groupRequests: [["one"]] })
  expect(state().phases.slice(-3)).toEqual(["group", "change", "press"])
  await advance(press, "group-echo")
  await fireEvent.press(target(), payload)
  expect(state()).toMatchObject({ selected: true, groupValue: ["one"] })
  await advance(press, "local")
  await fireEvent.press(target(), payload)
  await fireEvent.press(target(), payload)
  expect(state().selected).toBe(false)
  await press("Next Checkbox check")
  expect(state()).toMatchObject({ case: "local-default-changed", selected: false })
  expect(state().events.at(-1)).toMatchObject({ phase: "press", target: 79, currentTarget: 81 })
})
it("prepares Checkbox standalone and group guards plus held disable cancellation", async () => {
  const press = await enter()
  for (const name of ["disabled", "readonly", "group-disabled", "group-readonly"]) {
    await advance(press, name)
    await fireEvent.press(target(), payload)
    expect(state()).toMatchObject({ actions: 0, requests: [], groupRequests: [] })
  }
  await press("Checkbox behavior checks")
  await advance(press, "held-disabled")
  await fireEvent(target(), "pressIn", payload)
  expect(state()).toMatchObject({ disabled: true, canceled: true })
  await fireEvent(target(), "pressOut", payload)
  await fireEvent.press(target(), payload)
  expect(state()).toMatchObject({ actions: 0, requests: [] })
})
it("preflights all Checkbox root, mark, glyph and text reference properties", async () => {
  const press = await enter()
  await press("Checkbox styles checks")
  const flat = (id: string) => StyleSheet.flatten(node(id).props.style)
  const edge = (s: Record<string, unknown>, side: string) =>
    s["padding" + side] ??
    s[side === "Left" || side === "Right" ? "paddingHorizontal" : "paddingVertical"] ??
    s.padding ??
    0
  for (let index = 0; index < 19; index++) {
    if (state().case === "dark") await press("Dark theme")
    if (state().case === "light-restored") await press("Light theme")
    for (const property of [
      "width",
      "height",
      "minWidth",
      "minHeight",
      "flexDirection",
      "alignItems",
      "gap",
      "opacity",
      "overflow",
    ])
      expect({ case: state().case, property, value: flat("checkbox-native-target")[property] }).toEqual({
        case: state().case,
        property,
        value: flat("checkbox-native-reference")[property],
      })
    for (const side of ["Left", "Right", "Top", "Bottom"])
      expect(edge(flat("checkbox-native-target"), side)).toEqual(edge(flat("checkbox-native-reference"), side))
    expect(processColor(flat("checkbox-native-target").backgroundColor)).toEqual(
      processColor(flat("checkbox-native-reference").backgroundColor),
    )
    for (const property of [
      "width",
      "height",
      "borderWidth",
      "borderRadius",
      "shadowOffset",
      "shadowOpacity",
      "shadowRadius",
      "elevation",
    ])
      expect({ case: state().case, property, value: flat("checkbox-native-target-shape")[property] }).toEqual({
        case: state().case,
        property,
        value: flat("checkbox-native-reference-shape")[property],
      })
    for (const property of ["backgroundColor", "borderColor", "shadowColor"])
      expect({
        case: state().case,
        property,
        value: processColor(flat("checkbox-native-target-shape")[property]),
      }).toEqual({
        case: state().case,
        property,
        value: processColor(flat("checkbox-native-reference-shape")[property]),
      })
    if (state().selected && !state().mixed && state().case !== "no-icon") {
      for (const property of ["width", "height", "borderRightWidth", "borderBottomWidth", "transform", "marginTop"])
        expect(flat("checkbox-native-target-check")[property]).toEqual(
          flat("checkbox-native-reference-check")[property],
        )
      expect(processColor(flat("checkbox-native-target-check").borderColor)).toEqual(
        processColor(flat("checkbox-native-reference-check").borderColor),
      )
    }
    const actual = StyleSheet.flatten(within(target()).getByText(state().display).props.style),
      reference = flat("checkbox-native-reference-text")
    for (const property of [
      "fontSize",
      "fontFamily",
      "fontWeight",
      "fontStyle",
      "lineHeight",
      "flexShrink",
      "letterSpacing",
      "textAlign",
    ])
      expect({ case: state().case, property, value: actual[property] }).toEqual({
        case: state().case,
        property,
        value: reference[property],
      })
    expect(processColor(actual.color)).toEqual(processColor(reference.color))
    if (index < 18) await press("Next Checkbox check")
  }
})
it("prepares Checkbox separate shape and glyph clocks, retargets and retirement", async () => {
  const press = await enter()
  await press("Checkbox motion checks")
  await press("Arm Checkbox motion and retirement")
  await act(() => jest.advanceTimersByTime(6000))
  expect(state().motionTrace.map((r: { name: string }) => r.name)).toEqual([
    "select",
    "interrupt",
    "retarget",
    ...Array.from({ length: 29 }, (_, i) => `retarget-${i + 3}`),
    "settle",
  ])
  await act(() => jest.advanceTimersByTime(300))
  const actualShape = StyleSheet.flatten(node("checkbox-native-target-shape").props.style)
  const referenceShape = StyleSheet.flatten(node("checkbox-native-reference-shape").props.style)
  for (const property of ["backgroundColor", "borderColor"])
    expect(processColor(actualShape[property])).toEqual(processColor(referenceShape[property]))
  await act(() => jest.advanceTimersByTime(3000))
  expect(screen.queryByTestId("checkbox-native-target")).toBeNull()
  await act(() => jest.advanceTimersByTime(3000))
  expect(target()).toBeOnTheScreen()
  expect(state().motionTrace.at(-1).name).toBe("fresh")
})

it("snapshots transient Checkbox callback targets before React clears the event", async () => {
  await enter()
  let current: number | null = 81
  const event = {
    target: 79,
    get currentTarget() {
      return current
    },
    nativeEvent: { timestamp: 10 },
  }
  const props = jest.mocked(Checkbox).mock.calls.at(-1)?.[0]
  expect(props).toBeDefined()
  await act(() => {
    props!.onChange?.(true)
    props!.onPress?.(event as never)
    current = null
  })
  expect(state().events.find((row: { phase: string }) => row.phase === "press")).toMatchObject({
    target: 79,
    currentTarget: 81,
  })
})

it("records Checkbox timer epochs at delivery rather than deferred updater execution", async () => {
  const press = await enter()
  await press("Checkbox motion checks")
  await fireEvent.press(screen.getByRole("button", { name: "Arm Checkbox motion and retirement" }))
  await act(() => jest.advanceTimersByTime(16400))
  const trace = state().motionTrace
  expect(trace).toHaveLength(35)
  expect(trace[1].epochMs - trace[0].epochMs).toBe(125)
  expect(trace.at(-1).epochMs - trace[0].epochMs).toBe(10000)
})
