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
  await press("Basic controls scene")
  await press("Prepare standalone Button checks")
  return press
}
const state = () => JSON.parse(screen.getByTestId("button-native-state").props.accessibilityLabel)
const target = () => screen.getByTestId("button-native-target")
it("prepares actual Button guards, pending cancellation and original event snapshots", async () => {
  const press = await enter()
  const payload = { target: 81, currentTarget: 81, nativeEvent: {} }
  await fireEvent.press(target(), payload)
  expect(state()).toMatchObject({ actions: 1, phases: ["press"], pending: false, disabled: false })
  expect(state().events.at(-1)).toMatchObject({ phase: "press", target: 81, currentTarget: 81 })
  for (let index = 0; index < 2; index++) await press("Next Button check")
  await fireEvent.press(target(), payload)
  expect(state().actions).toBe(1)
  await press("Next Button check")
  await fireEvent(target(), "pressIn", payload)
  expect(state()).toMatchObject({ disabled: true, canceled: true, actions: 1 })
  for (let index = 0; index < 2; index++) await press("Next Button check")
  expect(state()).toMatchObject({ pending: true, disabled: false })
  await fireEvent.press(target(), payload)
  expect(state().actions).toBe(1)
})
it("prepares interrupted color and shadow targets, retirement and a fresh Button lifetime", async () => {
  const press = await enter()
  await press("Button motion checks")
  await press("Arm Button motion and retirement")
  await act(() => jest.advanceTimersByTime(7000))
  expect(state()).toMatchObject({ selected: true, background: "#117733", hasShadow: true })
  await press("Reference")
  expect(screen.getByTestId("button-native-reference-parent")).toHaveStyle({ position: "absolute", top: 0, left: 0 })
  await act(() => jest.advanceTimersByTime(450))
  expect(target()).toHaveStyle({ shadowOpacity: 0.4, shadowRadius: 0, shadowOffset: { width: 0, height: 6 } })
  await act(() => jest.advanceTimersByTime(800))
  expect(screen.queryByTestId("button-native-target")).toBeNull()
  await act(() => jest.advanceTimersByTime(2000))
  expect(target()).toBeOnTheScreen()
  expect(state().motionTrace.map((row: { name: string }) => row.name)).toEqual([
    ...Array.from({ length: 20 }, (_, index) => `retarget-${index}`),
    "settle",
    "retire",
    "fresh",
  ])
})
it("preflights every authored style case against independent typography, edge, layout and paint inputs", async () => {
  const press = await enter()
  await press("Button styles checks")
  const edge = (style: Record<string, unknown>, side: "Left" | "Right" | "Top" | "Bottom") =>
    style["padding" + side] ??
    style[side === "Left" || side === "Right" ? "paddingHorizontal" : "paddingVertical"] ??
    style.padding ??
    0
  for (let index = 0; index < 20; index++) {
    const row = state()
    if (row.case === "dark") await press("Dark theme")
    if (row.case === "light-restored") await press("Light theme")
    await act(() => jest.advanceTimersByTime(1000))
    const actual = StyleSheet.flatten(target().props.style)
    const referenceNode = screen.getByTestId("button-native-reference")
    const reference = StyleSheet.flatten(referenceNode.props.style)
    for (const property of [
      "width",
      "height",
      "minHeight",
      "borderWidth",
      "borderRadius",
      "flexDirection",
      "alignItems",
      "justifyContent",
      "gap",
      "opacity",
      "overflow",
    ])
      expect({ case: row.case, property, value: actual[property] }).toEqual({
        case: row.case,
        property,
        value: reference[property],
      })
    for (const side of ["Left", "Right", "Top", "Bottom"] as const)
      expect({ case: row.case, side, value: edge(actual, side) }).toEqual({
        case: row.case,
        side,
        value: edge(reference, side),
      })
    for (const property of row.raised
      ? ["backgroundColor", "borderColor", "shadowColor"]
      : ["backgroundColor", "borderColor"])
      expect({ case: row.case, property, value: processColor(actual[property]) }).toEqual({
        case: row.case,
        property,
        value: processColor(reference[property]),
      })
    for (const property of row.raised ? ["shadowOpacity", "shadowRadius", "shadowOffset", "elevation"] : [])
      expect({ case: row.case, property, value: actual[property] }).toEqual({
        case: row.case,
        property,
        value: reference[property],
      })
    const actualText = StyleSheet.flatten(within(target()).getByText(row.display).props.style)
    const referenceText = StyleSheet.flatten(within(referenceNode).getByText(row.display).props.style)
    for (const property of [
      "fontSize",
      "fontFamily",
      "fontWeight",
      "fontStyle",
      "lineHeight",
      "letterSpacing",
      "textAlign",
      "flexShrink",
    ])
      expect({ case: row.case, property, value: actualText[property] }).toEqual({
        case: row.case,
        property,
        value: referenceText[property],
      })
    expect(processColor(actualText.color)).toEqual(processColor(referenceText.color))
    if (index !== 19) await press("Next Button check")
  }
})
