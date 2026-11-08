import { act, fireEvent, render, screen, userEvent, within } from "@testing-library/react-native"
import { processColor, StyleSheet } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"

import { NativeShowcase } from "../NativeShowcase"

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())
const enter = async () => {
  await render(
    <SafeAreaInsetsContext.Provider value={{ top: 20, bottom: 10, left: 0, right: 0 }}>
      <NativeShowcase />
    </SafeAreaInsetsContext.Provider>,
  )
  const user = userEvent.setup()
  const press = (name: string) => user.press(screen.getByRole("button", { name }))
  await press("Multiline/Radio scene")
  await press("Prepare standalone Radio checks")
  return press
}
const state = () => JSON.parse(screen.getByTestId("radio-native-state").props.accessibilityLabel)
const target = () => screen.getByTestId("radio-native-target")
const payload = { target: 79, currentTarget: 81, nativeEvent: { timestamp: 10 } }

it("prepares Radio group owner veto, echo, quiet reselection and original event order", async () => {
  const press = await enter()
  await fireEvent.press(target(), payload)
  await fireEvent.press(target(), payload)
  expect(state()).toMatchObject({
    selected: false,
    actions: 2,
    requests: ["a", "a"],
    phases: ["change", "press", "change", "press"],
  })
  await press("Next Radio check")
  await fireEvent.press(target(), payload)
  expect(state()).toMatchObject({ selected: true, actions: 3, requests: ["a", "a", "a"] })
  await press("Next Radio check")
  await fireEvent.press(target(), payload)
  expect(state()).toMatchObject({ selected: true, actions: 4, requests: ["a", "a", "a"] })
  expect(state().events.at(-1)).toMatchObject({ phase: "press", target: 79, currentTarget: 81 })
})

it("prepares disabled, read-only and actual held guard retirement without fabricated changes", async () => {
  const press = await enter()
  for (let i = 0; i < 3; i++) await press("Next Radio check")
  await fireEvent.press(target(), payload)
  expect(state().actions).toBe(0)
  await press("Next Radio check")
  await fireEvent.press(target(), payload)
  expect(state()).toMatchObject({ readonly: true, actions: 0, requests: [] })
  await press("Next Radio check")
  await fireEvent(target(), "pressIn", payload)
  expect(state()).toMatchObject({ canceled: true, disabled: true })
  await fireEvent(target(), "pressOut", payload)
  await fireEvent.press(target(), payload)
  expect(state()).toMatchObject({ actions: 0, requests: [] })
  for (let i = 0; i < 6; i++) await press("Next Radio check")
  expect(state()).toMatchObject({ case: "local", selected: true })
  await press("Next Radio check")
  expect(state()).toMatchObject({ case: "local-default-changed", selected: true })
  await press("Next Radio check")
  await fireEvent.press(target(), payload)
  expect(state()).toMatchObject({ case: "empty-value", selected: true, selectedValue: "", requests: [""] })
})

it("preflights every authored Radio root, mark and text property against independent native references", async () => {
  const press = await enter()
  await press("Radio styles checks")
  const edge = (style: Record<string, unknown>, side: string) =>
    style["padding" + side] ??
    style[side === "Left" || side === "Right" ? "paddingHorizontal" : "paddingVertical"] ??
    style.padding ??
    0
  for (let i = 0; i < 16; i++) {
    if (state().case === "dark") await press("Dark theme")
    if (state().case === "light-restored") await press("Light theme")
    await act(() => jest.advanceTimersByTime(1000))
    const row = state(),
      referenceNode = screen.getByTestId("radio-native-reference")
    const actual = StyleSheet.flatten(target().props.style),
      reference = StyleSheet.flatten(referenceNode.props.style)
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
      expect({ case: row.case, property, value: actual[property] }).toEqual({
        case: row.case,
        property,
        value: reference[property],
      })
    for (const side of ["Left", "Right", "Top", "Bottom"])
      expect({ case: row.case, side, value: edge(actual, side) }).toEqual({
        case: row.case,
        side,
        value: edge(reference, side),
      })
    expect(processColor(actual.backgroundColor)).toEqual(processColor(reference.backgroundColor))
    const shape = StyleSheet.flatten(
      screen.getByTestId("radio-native-target-shape", { includeHiddenElements: true }).props.style,
    )
    const rawShape = StyleSheet.flatten(screen.getByTestId("radio-native-reference-shape").props.style)
    for (const property of ["width", "height", "flexShrink", "borderWidth", "borderRadius"])
      expect({ case: row.case, property, value: shape[property] }).toEqual({
        case: row.case,
        property,
        value: rawShape[property],
      })
    for (const property of ["backgroundColor", "borderColor"])
      expect(processColor(shape[property])).toEqual(processColor(rawShape[property]))
    const text = StyleSheet.flatten(within(target()).getByText(row.display).props.style)
    const rawText = StyleSheet.flatten(within(referenceNode).getByText(row.display).props.style)
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
      expect({ case: row.case, property, value: text[property] }).toEqual({
        case: row.case,
        property,
        value: rawText[property],
      })
    expect(processColor(text.color)).toEqual(processColor(rawText.color))
    if (i !== 15) await press("Next Radio check")
  }
})

it("prepares real interruption, replacement and retirement independently of motion settings", async () => {
  const press = await enter()
  await press("Radio motion checks")
  await press("Arm Radio motion and retirement")
  await act(() => jest.advanceTimersByTime(8250))
  expect(screen.queryByTestId("radio-native-target")).toBeNull()
  expect(state().motionTrace.map((row: { name: string }) => row.name)).toEqual([
    "select",
    "interrupt",
    "retarget",
    ...Array.from({ length: 29 }, (_, index) => `retarget-${index + 3}`),
    "settle",
    "retire",
  ])
  await act(() => jest.advanceTimersByTime(2000))
  expect(target()).toBeOnTheScreen()
  expect(state().motionTrace.at(-1).name).toBe("fresh")
})
