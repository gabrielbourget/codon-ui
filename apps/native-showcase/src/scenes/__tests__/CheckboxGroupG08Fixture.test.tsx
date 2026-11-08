import { act, fireEvent, render, screen, within } from "@testing-library/react-native"
import { processColor, StyleSheet } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"

import { NativeShowcase } from "../NativeShowcase"

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())
const node = (id: string) => screen.getByTestId(id, { includeHiddenElements: true })
const state = () => JSON.parse(node("cgroup-native-state").props.accessibilityLabel)
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
  await press("Prepare CheckboxGroup checks")
  return press
}
const advance = async (press: (name: string) => Promise<void>, name: string) => {
  while (state().case !== name) await press("Next CheckboxGroup check")
}
const activate = async (id: string) => {
  await fireEvent.press(node("cgroup-native-" + id), payload)
  await act(() => jest.advanceTimersByTime(1000))
}

it("prepares CheckboxGroup immutable veto, append/remove ordering and local default read-once", async () => {
  const press = await enter()
  await activate("alpha")
  await activate("alpha")
  expect(state()).toMatchObject({
    value: [],
    requests: [["alpha"], ["alpha"]],
    phases: ["group:root", "member:alpha", "press:alpha", "group:root", "member:alpha", "press:alpha"],
  })
  expect(node("cgroup-native-alpha").props.accessibilityState.checked).toBe(false)
  await advance(press, "echo")
  await activate("beta")
  await activate("alpha")
  await activate("beta")
  expect(state().requests.slice(-3)).toEqual([["beta"], ["beta", "alpha"], ["alpha"]])
  expect(state().value).toEqual(["alpha"])
  expect(state().events.at(-1)).toMatchObject({ phase: "press", member: "beta", target: 79, currentTarget: 81 })
  await advance(press, "local")
  expect(node("cgroup-native-beta").props.accessibilityState.checked).toBe(true)
  await activate("beta")
  await activate("alpha")
  await press("Next CheckboxGroup check")
  expect(state()).toMatchObject({ case: "default-changed", value: ["alpha"] })
  expect(node("cgroup-native-alpha").props.accessibilityState.checked).toBe(true)
  expect(node("cgroup-native-beta").props.accessibilityState.checked).toBe(false)
})
it("prepares CheckboxGroup guards, original renderer context and isolated nested/value-less members", async () => {
  const press = await enter()
  for (const name of ["disabled", "readonly"]) {
    await advance(press, name)
    await activate("alpha")
    await activate("beta")
    expect(state().requests).toEqual([])
    expect(node("cgroup-native-alpha").props.accessibilityState.disabled).toBe(name === "disabled")
    expect(StyleSheet.flatten(node("cgroup-native-root").props.style).opacity).toBeUndefined()
    expect(StyleSheet.flatten(node("cgroup-native-alpha").props.style).opacity).toBe(name === "disabled" ? 0.4 : 1)
  }
  await advance(press, "renderer")
  expect(node("cgroup-native-root").props.nativeID).toBe("cgroup-rendered-")
  expect(node("cgroup-native-root").props.accessible).toBe(false)
  await advance(press, "nested")
  await activate("nested")
  await activate("loose")
  expect(state()).toMatchObject({ value: [], requests: [], nestedValue: [], looseValue: false })
  expect(state().phases.slice(-5)).toEqual([
    "nested:nested",
    "member:nested",
    "press:nested",
    "member:loose",
    "press:loose",
  ])
})
it("preflights every CheckboxGroup and member reference layout, paint and typography property", async () => {
  const press = await enter()
  await press("CheckboxGroup styles checks")
  const flat = (id: string) => StyleSheet.flatten(node(id).props.style)
  const edge = (s: Record<string, unknown>, side: string, stem: string) =>
    s[stem + side] ?? s[stem + (side === "Left" || side === "Right" ? "Horizontal" : "Vertical")] ?? s[stem] ?? 0
  for (let index = 0; index < 12; index++) {
    if (state().case === "dark") await press("Dark theme")
    if (state().case === "light-restored") await press("Light theme")
    const actual = flat("cgroup-native-root"),
      reference = flat("cgroup-native-reference")
    for (const key of ["width", "height", "flexDirection", "flexWrap", "alignItems", "gap", "overflow", "opacity"])
      expect({ case: state().case, key, value: actual[key] }).toEqual({
        case: state().case,
        key,
        value: reference[key],
      })
    for (const side of ["Left", "Right", "Top", "Bottom"])
      for (const stem of ["padding", "borderWidth"])
        expect(edge(actual, side, stem)).toEqual(edge(reference, side, stem))
    for (const key of ["backgroundColor", "borderColor"])
      expect(processColor(actual[key])).toEqual(processColor(reference[key]))
    for (const member of ["alpha", "beta"]) {
      const target = node("cgroup-native-" + member),
        raw = node("cgroup-reference-" + member)
      for (const key of ["width", "minWidth", "minHeight", "flexDirection", "alignItems", "gap", "opacity"])
        expect(StyleSheet.flatten(target.props.style)[key]).toEqual(StyleSheet.flatten(raw.props.style)[key])
      const label = state().labels[member],
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
    if (index < 11) await press("Next CheckboxGroup check")
  }
})
it("prepares CheckboxGroup retirement and independent matched-position reference controls", async () => {
  const press = await enter()
  await advance(press, "retired")
  expect(screen.queryByTestId("cgroup-native-root")).toBeNull()
  expect(screen.queryByTestId("cgroup-native-reference")).toBeNull()
  await press("Next CheckboxGroup check")
  expect(node("cgroup-native-root")).toBeOnTheScreen()
  await press("Show CheckboxGroup reference")
  expect(state().referenceAtOrigin).toBe(true)
  expect(StyleSheet.flatten(node("cgroup-native-reference-parent").props.style).top).toBe(0)
  await press("Show CheckboxGroup component")
  expect(StyleSheet.flatten(node("cgroup-native-reference-parent").props.style).top).toBe(232)
})

it("preflights selected grouped mark and primitive glyph endpoint properties", async () => {
  const press = await enter()
  await advance(press, "echo")
  await activate("beta")
  const flat = (id: string) => StyleSheet.flatten(node(id).props.style)
  const actual = flat("cgroup-native-beta-shape"),
    reference = flat("cgroup-reference-beta-shape")
  for (const key of [
    "width",
    "height",
    "borderWidth",
    "borderRadius",
    "shadowOffset",
    "shadowOpacity",
    "shadowRadius",
    "elevation",
  ])
    expect(actual[key]).toEqual(reference[key])
  for (const key of ["backgroundColor", "borderColor", "shadowColor"])
    expect(processColor(actual[key])).toEqual(processColor(reference[key]))
  const check = flat("cgroup-native-beta-check"),
    rawCheck = flat("cgroup-reference-beta-check")
  for (const key of ["width", "height", "borderRightWidth", "borderBottomWidth", "transform", "marginTop"])
    expect(check[key]).toEqual(rawCheck[key])
  expect(processColor(check.borderColor)).toEqual(processColor(rawCheck.borderColor))
})
