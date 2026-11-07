import { act, fireEvent, render, screen, within } from "@testing-library/react-native"
import { processColor, StyleSheet } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"

import { NativeShowcase } from "../NativeShowcase"

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())
const node = (id: string) => screen.getByTestId(id, { includeHiddenElements: true })
const state = () => JSON.parse(node("rgroup-native-state").props.accessibilityLabel)
const payload = { target: 79, currentTarget: 81, nativeEvent: { timestamp: 10 } }
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
  await press("Prepare RadioGroup checks")
  return press
}
const advance = async (press: (name: string) => Promise<void>, name: string) => {
  while (state().case !== name) await press("Next RadioGroup check")
}
const activate = async (id: string) => {
  await fireEvent.press(node("rgroup-native-" + id), payload)
  await act(() => jest.advanceTimersByTime(1000))
}

it("prepares RadioGroup null ownership, veto, one string change and quiet reselection", async () => {
  const press = await enter()
  await activate("alpha")
  await activate("alpha")
  expect(state()).toMatchObject({
    value: null,
    requests: ["alpha", "alpha"],
    phases: ["group:root", "press:alpha", "group:root", "press:alpha"],
  })
  await advance(press, "echo")
  await activate("beta")
  await activate("alpha")
  expect(state()).toMatchObject({ value: "alpha", requests: ["alpha", "alpha", "beta", "alpha"] })
  await advance(press, "reselected")
  await activate("alpha")
  expect(state().requests).toEqual(["alpha", "alpha", "beta", "alpha"])
  expect(state().phases.at(-1)).toBe("press:alpha")
  expect(state().events.at(-1)).toMatchObject({ target: 79, currentTarget: 81 })
})
it("prepares RadioGroup guards, named role, renderer and nested isolation", async () => {
  const press = await enter()
  for (const name of ["disabled", "readonly"]) {
    await advance(press, name)
    await activate("alpha")
    await activate("beta")
    expect(state().requests).toEqual([])
    expect(node("rgroup-native-alpha").props.accessibilityState.disabled).toBe(name === "disabled")
    expect(StyleSheet.flatten(node("rgroup-native-root").props.style).opacity).toBeUndefined()
    expect(StyleSheet.flatten(node("rgroup-native-alpha").props.style).opacity).toBe(name === "disabled" ? 0.4 : 1)
  }
  await advance(press, "renderer")
  expect(node("rgroup-native-root").props.nativeID).toBe("rgroup-rendered-none")
  expect(node("rgroup-native-root").props).toMatchObject({
    accessible: false,
    role: "radiogroup",
    accessibilityRole: "radiogroup",
    accessibilityLabel: "Notification options",
  })
  await advance(press, "nested")
  await activate("other")
  expect(state()).toMatchObject({ value: null, requests: [], nestedValue: "other" })
  expect(state().phases.slice(-2)).toEqual(["nested:other", "press:other"])
})
it("prepares RadioGroup default read-once and real empty-string selection", async () => {
  const press = await enter()
  await advance(press, "local")
  expect(node("rgroup-native-beta").props.accessibilityState.checked).toBe(true)
  await activate("alpha")
  await press("Next RadioGroup check")
  expect(state()).toMatchObject({ case: "default-changed", value: "alpha" })
  expect(node("rgroup-native-alpha").props.accessibilityState.checked).toBe(true)
  await advance(press, "empty-value")
  await activate("alpha")
  expect(state().value).toBe("")
  expect(state().requests.at(-1)).toBe("")
  const count = state().requests.length
  await activate("alpha")
  expect(state().requests).toHaveLength(count)
  expect(node("rgroup-native-alpha").props.accessibilityState.checked).toBe(true)
})
it("preflights every RadioGroup root and member reference layout, paint and typography property", async () => {
  const press = await enter()
  await press("RadioGroup styles checks")
  const flat = (id: string) => StyleSheet.flatten(node(id).props.style)
  const edge = (s: Record<string, unknown>, side: string) =>
    s["padding" + side] ??
    s["padding" + (side === "Left" || side === "Right" ? "Horizontal" : "Vertical")] ??
    s.padding ??
    0
  for (let index = 0; index < 12; index++) {
    if (state().case === "dark") await press("Dark theme")
    if (state().case === "light-restored") await press("Light theme")
    const actual = flat("rgroup-native-root"),
      reference = flat("rgroup-native-reference")
    for (const key of [
      "width",
      "height",
      "flexDirection",
      "flexWrap",
      "alignItems",
      "gap",
      "overflow",
      "opacity",
      "borderWidth",
    ])
      expect({ case: state().case, key, value: actual[key] }).toEqual({
        case: state().case,
        key,
        value: reference[key],
      })
    for (const side of ["Left", "Right", "Top", "Bottom"]) expect(edge(actual, side)).toEqual(edge(reference, side))
    for (const key of ["backgroundColor", "borderColor"])
      expect(processColor(actual[key])).toEqual(processColor(reference[key]))
    for (const id of ["alpha", "beta"]) {
      const target = node("rgroup-native-" + id),
        raw = node("rgroup-reference-" + id)
      for (const key of ["width", "height", "minWidth", "minHeight", "flexDirection", "alignItems", "gap", "opacity"])
        expect(StyleSheet.flatten(target.props.style)[key]).toEqual(StyleSheet.flatten(raw.props.style)[key])
      const shape = flat("rgroup-native-" + id + "-shape"),
        rawShape = flat("rgroup-reference-" + id + "-shape")
      for (const key of [
        "width",
        "height",
        "flexShrink",
        "opacity",
        "borderWidth",
        "borderRadius",
        "shadowOffset",
        "shadowOpacity",
        "shadowRadius",
        "elevation",
      ])
        expect({ case: state().case, key, value: shape[key] }).toEqual({
          case: state().case,
          key,
          value: rawShape[key],
        })
      for (const key of ["backgroundColor", "borderColor", "shadowColor"])
        expect(processColor(shape[key])).toEqual(processColor(rawShape[key]))
      const label = state().labels[id],
        text = StyleSheet.flatten(within(target).getByText(label).props.style),
        native = StyleSheet.flatten(within(raw).getByText(label).props.style)
      for (const key of [
        "fontFamily",
        "fontSize",
        "fontWeight",
        "fontStyle",
        "lineHeight",
        "letterSpacing",
        "textAlign",
        "flexShrink",
      ])
        expect(text[key]).toEqual(native[key])
      expect(processColor(text.color)).toEqual(processColor(native.color))
    }
    if (index < 11) await press("Next RadioGroup check")
  }
  await press("RadioGroup behavior checks")
  await advance(press, "echo")
  await activate("alpha")
  expect(processColor(flat("rgroup-native-alpha-shape").backgroundColor)).toEqual(
    processColor(flat("rgroup-reference-alpha-shape").backgroundColor),
  )
})
it("prepares RadioGroup retirement, fresh lifetime and matched-origin reference controls", async () => {
  const press = await enter()
  await advance(press, "retired")
  expect(screen.queryByTestId("rgroup-native-root")).toBeNull()
  expect(screen.queryByTestId("rgroup-native-reference")).toBeNull()
  await press("Next RadioGroup check")
  expect(node("rgroup-native-root")).toBeOnTheScreen()
  await press("Show RadioGroup reference")
  expect(state().referenceAtOrigin).toBe(true)
  expect(StyleSheet.flatten(node("rgroup-native-reference-parent").props.style).top).toBe(0)
  await press("Show RadioGroup component")
  expect(StyleSheet.flatten(node("rgroup-native-reference-parent").props.style).top).toBe(232)
})
