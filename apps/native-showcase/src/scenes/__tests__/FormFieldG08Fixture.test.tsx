import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import { AccessibilityInfo, StyleSheet, processColor } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"

import { FIELD_ACTIONS, FIELD_STYLES } from "../FormFieldG08Fixture"
import { NativeShowcase } from "../NativeShowcase"

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})
const state = () => JSON.parse(screen.getByTestId("field-native-state").props.accessibilityLabel)
const enter = async () => {
  await render(
    <SafeAreaInsetsContext.Provider value={{ top: 20, bottom: 10, left: 0, right: 0 }}>
      <NativeShowcase />
    </SafeAreaInsetsContext.Provider>,
  )
  const user = userEvent.setup(),
    press = (name: string) => user.press(screen.getByRole("button", { name }))
  await press("Form field scene")
  await press("Prepare standalone Field checks")
  return press
}
it("keeps Field native relationship targets on one visible row outside measurement parents", async () => {
  await enter()
  const row = screen.getByTestId("field-native-relationship-targets")
  expect(row).toHaveStyle({ height: 20, flexDirection: "row", gap: 4 })
  for (const child of row.children) {
    if (typeof child !== "string") expect(child).toHaveStyle({ fontSize: 10, lineHeight: 12 })
  }
})
it("preflights Field child ownership, validation order, current target removal and lifetime", async () => {
  const press = await enter()
  await fireEvent.changeText(screen.getByTestId("field-native-editor"), "ownerx")
  const child = screen.getByTestId("field-native-editor")
  for (const name of FIELD_ACTIONS) {
    expect(state().case).toBe(name)
    if (name === "retired") expect(screen.queryByTestId("field-native-target")).toBeNull()
    else {
      expect(screen.getByTestId("field-native-editor").props.value).toBe("ownerx")
      if (name !== "fresh") expect(screen.getByTestId("field-native-editor")).toBe(child)
      expect(!!screen.getByTestId("form-field-label").props.onPress).toBe(name !== "target-cleared")
    }
    if (name === "messages") {
      expect(screen.getAllByTestId("form-field-error-messages").map((node) => node.props.children)).toEqual([
        "Error one",
        "Error two",
      ])
      expect(screen.getByTestId("form-field-warning-messages")).toHaveTextContent("Warning")
      expect(screen.getByTestId("form-field-success-messages")).toHaveTextContent("Success")
    }
    if (name === "empty-messages") {
      expect(screen.getByTestId("form-field-bottom-row")).toBeOnTheScreen()
      expect(screen.getByTestId("form-field-bottom-right-content")).toHaveTextContent("0")
    }
    if (name !== FIELD_ACTIONS.at(-1)) await press("Next Field check")
  }
  expect(state().changes).toBe(1)
})
it("preflights every Field native style owner and raw reference including provider and narrow layout", async () => {
  const press = await enter()
  await press("Field styles checks")
  const owners = [
    ["field-native-target", "field-native-reference"],
    ["form-field-top-row", "field-reference-top"],
    ["form-field-label", "field-reference-label"],
    ["form-field-top-right-content", "field-reference-top-right"],
    ["form-field-bottom-row", "field-reference-bottom"],
    ["form-field-bottom-right-content", "field-reference-bottom-right"],
    ["form-field-validation-messages", "field-reference-validation"],
    ["form-field-description", "field-reference-description"],
  ]
  const properties = [
    "width",
    "height",
    "padding",
    "gap",
    "flexDirection",
    "flexShrink",
    "justifyContent",
    "alignItems",
    "overflow",
    "borderWidth",
    "maxWidth",
    "boxShadow",
    "fontSize",
    "fontWeight",
    "fontFamily",
    "fontStyle",
    "lineHeight",
  ]
  for (const name of FIELD_STYLES) {
    expect(state().case).toBe(name)
    if (name === "long-narrow") {
      expect(screen.getByTestId("field-native-target")).toHaveStyle({ width: 160 })
      expect(screen.getByTestId("field-native-parent")).toHaveStyle({ height: 261 })
      expect(screen.getByTestId("field-native-reference-parent")).toHaveStyle({ height: 261 })
      expect(screen.getByTestId("field-native-pair")).toHaveStyle({ height: 530 })
    }
    if (name === "dark") await press("Dark theme")
    if (name === "light-restored") await press("Light theme")
    await act(() => jest.advanceTimersByTime(1000))
    for (const [actualID, expectedID] of owners) {
      const actual = StyleSheet.flatten(screen.getByTestId(actualID).props.style),
        expected = StyleSheet.flatten(screen.getByTestId(expectedID).props.style)
      for (const key of properties)
        expect({ name, actualID, key, value: actual[key] }).toEqual({ name, actualID, key, value: expected[key] })
      for (const key of [
        "backgroundColor",
        "borderColor",
        ...(actualID === "form-field-label" || actualID === "form-field-description" ? ["color"] : []),
      ])
        expect({ name, actualID, key, value: processColor(actual[key]) }).toEqual({
          name,
          actualID,
          key,
          value: processColor(expected[key]),
        })
    }
    if (name !== FIELD_STYLES.at(-1)) await press("Next Field check")
  }
})
it("prepares actual Field foreground interruption, removal, fresh lifetime and reduction listener", async () => {
  const press = await enter()
  await press("Field motion checks")
  await press("Arm Field motion and retirement")
  await act(() => jest.advanceTimersByTime(8800))
  expect(state().visible).toBe(false)
  expect(screen.queryByTestId("field-native-target")).toBeNull()
  await act(() => jest.advanceTimersByTime(2000))
  expect(state().visible).toBe(true)
  expect(state().motionTrace.map((row: { name: string }) => row.name)).toEqual([
    ...Array.from({ length: 40 }, (_, i) => `retarget-${i}`),
    "settle",
    "retire",
    "fresh",
  ])
  expect(state().motionEvents).toEqual([true])
})

it("uses an independent two-pixel Field marker reference without a whitespace spacer", async () => {
  const press = await enter()
  await press("Field styles checks")
  expect(state().case).toBe("style-baseline")
  expect(screen.getByTestId("field-canonical-marker-row")).toHaveStyle({ flexDirection: "row", gap: 2 })
  expect(screen.getByTestId("field-canonical-marker-row").props.collapsable).toBe(false)
  expect(screen.getByTestId("field-canonical-marker-label").props.children).toBe("Email")
  expect(screen.getByTestId("field-canonical-marker-indicator").props.children).toBe("*")
})
