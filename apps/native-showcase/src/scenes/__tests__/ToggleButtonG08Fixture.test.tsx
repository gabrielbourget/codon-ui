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
  await press("Toggle scene")
  await press("Prepare standalone ToggleButton checks")
  return press
}
const state = () => JSON.parse(screen.getByTestId("toggle-button-native-state").props.accessibilityLabel)
const target = () => screen.getByTestId("toggle-button-native-target")
it("prepares real ToggleButton owner veto, echo, original phase payloads and held cancellation", async () => {
  const press = await enter()
  const payload = { target: 81, currentTarget: 81, nativeEvent: {} }
  await fireEvent.press(target(), payload)
  expect(state()).toMatchObject({ actions: 1, selected: false, requests: [true], phases: ["change", "press"] })
  await press("Next ToggleButton check")
  await fireEvent.press(target(), payload)
  expect(state()).toMatchObject({
    actions: 2,
    selected: true,
    requests: [true, true],
    phases: ["change", "press", "change", "press"],
  })
  await press("Next ToggleButton check")
  await fireEvent.press(target(), payload)
  expect(state().actions).toBe(2)
  await press("Next ToggleButton check")
  await fireEvent(target(), "pressIn", payload)
  expect(state()).toMatchObject({ disabled: true, canceled: true, actions: 2 })
  expect(state().events.at(-1)).toMatchObject({ phase: "in", target: 81, currentTarget: 81 })
})
it("prepares ToggleButton final precedence, caller-wrapped content, and explicit zero clipping", async () => {
  const press = await enter()
  await press("ToggleButton styles checks")
  for (let index = 0; index < 3; index++) await press("Next ToggleButton check")
  await act(() => jest.advanceTimersByTime(1000))
  expect(target()).toHaveStyle({ backgroundColor: "#117733", borderColor: "#2f7d18" })
  for (let index = 0; index < 6; index++) await press("Next ToggleButton check")
  expect(state()).toMatchObject({ narrow: true, width: 96 })
  expect(within(target()).getByText(state().display)).toHaveStyle({ fontSize: state().fontSize })
  expect(screen.getByTestId("toggle-button-native-reference")).toHaveStyle({ width: 96 })
  for (let index = 0; index < 4; index++) await press("Next ToggleButton check")
  expect(target()).toHaveStyle({ width: 24, height: 24, padding: 0, paddingHorizontal: 0 })
  await press("Next ToggleButton check")
  expect(target()).toHaveStyle({
    width: 0,
    height: 0,
    padding: 0,
    paddingHorizontal: 0,
    borderWidth: 0,
    overflow: "hidden",
  })
})
it("prepares genuine motion, interruption, retirement and fresh ToggleButton without synthetic settings", async () => {
  const press = await enter()
  await press("ToggleButton motion checks")
  await press("Arm ToggleButton motion and retirement")
  await act(() => jest.advanceTimersByTime(4300))
  expect(screen.queryByTestId("toggle-button-native-target")).toBeNull()
  expect(state().motionTrace.map((row: { name: string }) => row.name)).toEqual([
    "select",
    "interrupt",
    "retarget",
    "retire",
  ])
  await act(() => jest.advanceTimersByTime(700))
  expect(target()).toBeOnTheScreen()
  expect(state().motionTrace.at(-1).name).toBe("fresh")
})

it("prepares original default/autofocus targets and a raised reference overlay without changing the paired extent", async () => {
  const press = await enter()
  for (let index = 0; index < 10; index++) await press("Next ToggleButton check")
  expect(state().case).toBe("auto-focus")
  expect(target()).toBeOnTheScreen()
  await press("ToggleButton styles checks")
  for (let index = 0; index < 8; index++) await press("Next ToggleButton check")
  expect(state().case).toBe("raised")
  await press("Match raised reference position")
  expect(state().referenceAtOrigin).toBe(true)
  expect(screen.getByTestId("toggle-button-native-reference-parent")).toHaveStyle({
    position: "absolute",
    top: 0,
    left: 0,
    height: 224,
  })
  await press("Next ToggleButton check")
  expect(state()).toMatchObject({ case: "long-narrow", referenceAtOrigin: false })
})

it("preflights every authored style case against independent typography, edge, layout and paint inputs", async () => {
  const press = await enter()
  await press("ToggleButton styles checks")
  const edge = (style: Record<string, unknown>, side: "Left" | "Right" | "Top" | "Bottom") =>
    style["padding" + side] ??
    style[side === "Left" || side === "Right" ? "paddingHorizontal" : "paddingVertical"] ??
    style.padding ??
    0
  for (let index = 0; index < 17; index++) {
    const row = state()
    if (row.case === "dark") await press("Dark theme")
    if (row.case === "light-restored") await press("Light theme")
    await act(() => jest.advanceTimersByTime(1000))
    const actual = StyleSheet.flatten(target().props.style)
    const referenceNode = screen.getByTestId("toggle-button-native-reference")
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
    for (const property of ["backgroundColor", "borderColor", "shadowColor"])
      expect({ case: row.case, property, value: processColor(actual[property]) }).toEqual({
        case: row.case,
        property,
        value: processColor(reference[property]),
      })
    for (const property of ["shadowOpacity", "shadowRadius", "shadowOffset", "elevation"])
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
    if (index !== 16) await press("Next ToggleButton check")
  }
})
