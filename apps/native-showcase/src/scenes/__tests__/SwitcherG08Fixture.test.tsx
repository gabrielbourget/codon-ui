import { act, fireEvent, render, screen, userEvent, within } from "@testing-library/react-native"
import { AccessibilityInfo, StyleSheet, processColor } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"

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
const state = () => JSON.parse(screen.getByTestId("switcher-native-state").props.accessibilityLabel)
const root = () => screen.getByTestId("switcher-native-target")
const options = () => within(root()).getAllByTestId("switcher-native-target-option")
const enter = async () => {
  await render(
    <SafeAreaInsetsContext.Provider value={{ top: 20, bottom: 10, left: 0, right: 0 }}>
      <NativeShowcase />
    </SafeAreaInsetsContext.Provider>,
  )
  const user = userEvent.setup(),
    press = (name: string) => user.press(screen.getByRole("button", { name }))
  await press("Toggle scene")
  await press("Prepare standalone Switcher checks")
  return press
}
it("prepares Switcher veto echo guards empty keys and exactly one intended activation per action", async () => {
  const press = await enter()
  await fireEvent.press(options()[1])
  await fireEvent.press(options()[1])
  expect(state()).toMatchObject({ selected: "a", owner: "a" })
  expect(state().requests.map((x: { key: string }) => x.key)).toEqual(["b", "b"])
  await press("Next Switcher check")
  await fireEvent.press(options()[1])
  expect(state().selected).toBe("b")
  await press("Next Switcher check")
  await fireEvent.press(options()[1])
  expect(state().requests).toHaveLength(3)
  await press("Next Switcher check")
  await fireEvent.press(options()[0])
  expect(state().requests).toHaveLength(3)
  await press("Next Switcher check")
  await fireEvent(root(), "touchStart", { target: 79, currentTarget: 81, nativeEvent: { timestamp: Date.now() } })
  expect(state()).toMatchObject({ held: true, readonly: true })
  await fireEvent.press(options()[0])
  expect(state().requests).toHaveLength(3)
})
it("preflights every Switcher raw reference root row option typography minimum and selected slot before native execution", async () => {
  const press = await enter()
  await press("Switcher styles checks")
  for (let index = 0; index < 24; index++) {
    let row = state()
    if (row.case === "dark") await press("Dark theme")
    if (row.case === "light-restored") await press("Light theme")
    await act(() => jest.advanceTimersByTime(1000))
    row = state()
    const size = typeof row.rootWidth === "number" ? (row.zero ? 6 : row.rootWidth) : 240
    const insets = 2 * (row.padding + row.border)
    await fireEvent(screen.getByTestId("switcher-native-reference"), "layout", {
      nativeEvent: { layout: { x: 12, y: 12, width: size, height: 50 } },
    })
    await fireEvent(screen.getByTestId("switcher-native-target-row"), "layout", {
      nativeEvent: {
        layout: {
          x: row.padding + row.border,
          y: row.padding + row.border,
          width: Math.max(0, size - insets),
          height: 44,
        },
      },
    })
    const actualRoot = StyleSheet.flatten(root().props.style),
      referenceRoot = StyleSheet.flatten(screen.getByTestId("switcher-native-reference").props.style)
    for (const property of [
      "width",
      "height",
      "maxWidth",
      "alignSelf",
      "padding",
      "borderWidth",
      "borderRadius",
      "opacity",
      "flexDirection",
      "overflow",
      "shadowOffset",
      "shadowOpacity",
      "shadowRadius",
      "elevation",
    ])
      expect({ case: row.case, property, value: actualRoot[property] }).toEqual({
        case: row.case,
        property,
        value: referenceRoot[property],
      })
    for (const property of ["backgroundColor", "borderColor", "shadowColor"])
      expect({ case: row.case, property, value: processColor(actualRoot[property]) }).toEqual({
        case: row.case,
        property,
        value: processColor(referenceRoot[property]),
      })
    const actualRow = StyleSheet.flatten(screen.getByTestId("switcher-native-target-row").props.style),
      referenceRow = StyleSheet.flatten(screen.getByTestId("switcher-native-reference-row").props.style)
    for (const property of ["flexDirection", "gap", "alignItems", "alignSelf", "flexGrow"])
      expect({ case: row.case, property, value: actualRow[property] }).toEqual({
        case: row.case,
        property,
        value: referenceRow[property],
      })
    const references = screen.getAllByTestId(/^switcher-native-reference-option-/)
    for (const [index, option] of options().entries()) {
      const actual = StyleSheet.flatten(option.props.style),
        expected = StyleSheet.flatten(references[index].props.style)
      for (const property of [
        "width",
        "height",
        "minWidth",
        "minHeight",
        "flexShrink",
        "alignSelf",
        "alignItems",
        "justifyContent",
        "flexDirection",
        "paddingHorizontal",
        "paddingVertical",
        "overflow",
        "borderRadius",
        "borderWidth",
      ])
        expect({ case: row.case, index, property, value: actual[property] }).toEqual({
          case: row.case,
          index,
          property,
          value: expected[property],
        })
      for (const property of ["backgroundColor", "borderColor"])
        expect({ case: row.case, index, property, value: processColor(actual[property]) }).toEqual({
          case: row.case,
          index,
          property,
          value: processColor(expected[property]),
        })
      const text = within(option).getByText(row.items[index].text),
        expectedText = within(references[index]).getByText(row.items[index].text),
        actualText = StyleSheet.flatten(text.props.style),
        referenceText = StyleSheet.flatten(expectedText.props.style)
      for (const property of [
        "fontSize",
        "fontWeight",
        "fontFamily",
        "fontStyle",
        "lineHeight",
        "textTransform",
        "textAlign",
        "letterSpacing",
      ])
        expect({ case: row.case, index, property, value: actualText[property] }).toEqual({
          case: row.case,
          index,
          property,
          value: referenceText[property],
        })
      expect(processColor(actualText.color)).toBe(processColor(referenceText.color))
    }
    if (index < 23) await press("Next Switcher check")
  }
})
it("prepares Switcher same origin references actual timer epochs reduced events and bounded retirement schedule", async () => {
  const press = await enter()
  await press("Switcher motion checks")
  for (const control of ["First", "Second"]) {
    await press(control)
    await act(() => jest.advanceTimersByTime(1000))
    for (const text of ["First", "Second", "None"]) {
      const actual = StyleSheet.flatten(within(root()).getByText(text).props.style)
      const reference = StyleSheet.flatten(
        within(screen.getByTestId("switcher-native-reference")).getByText(text).props.style,
      )
      expect(processColor(actual.color)).toBe(processColor(reference.color))
    }
  }

  await press("Switcher reference")
  expect(state().referenceAtOrigin).toBe(true)
  await press("Second")
  expect(state().selected).toBe("b")
  await press("Switcher component")
  expect(state().referenceAtOrigin).toBe(false)
  await press("Arm Switcher motion and retirement")
  await act(() => jest.advanceTimersByTime(12000))
  expect(state().visible).toBe(false)
  expect(state().motionTrace).toHaveLength(42)
  await act(() => jest.advanceTimersByTime(2000))
  expect(state().visible).toBe(true)
  expect(state().motionTrace).toHaveLength(43)
  expect(state().motionTrace.every((x: { epochMs: number }) => Number.isFinite(x.epochMs))).toBe(true)
})

it("prepares the full Switcher collection default ownership and original internally growing child cases", async () => {
  const press = await enter()
  const until = async (name: string) => {
    for (let index = 0; state().case !== name && index < 20; index++) await press("Next Switcher check")
    expect(state().case).toBe(name)
  }
  await until("empty-key")
  expect(
    options().find((option) => option.props.accessibilityLabel === "Empty choice")?.props.accessibilityState.checked,
  ).toBe(true)
  await fireEvent.press(options().find((option) => option.props.accessibilityLabel === "Second choice")!)
  expect(state().selected).toBe("")
  await until("local")
  expect(state().owner).toBe("a")
  await fireEvent.press(options()[1])
  expect(state().owner).toBe("b")
  await until("default-changed")
  expect(options()[1].props.accessibilityState.checked).toBe(true)
  await until("authored")
  const label = within(root()).getByText("Short")
  await until("authored-grown")
  await press("Grow Switcher label")
  expect(state().items[0].text).toBe("Longer original label")
  expect(within(root()).getByText("Longer original label")).toBe(label)
})

it("preflights the independent selected reference surface inside every styled option border", async () => {
  const press = await enter()
  await press("Switcher styles checks")
  for (let index = 0; index < 24; index++) {
    if (state().case === "dark") await press("Dark theme")
    if (state().case === "light-restored") await press("Light theme")
    await act(() => jest.advanceTimersByTime(1000))
    const actual = screen.getAllByTestId("switcher-native-target-selected-surface", { includeHiddenElements: true })
    const expected = screen.queryAllByTestId("switcher-native-reference-selected-surface", {
      includeHiddenElements: true,
    })
    expect(expected).toHaveLength(actual.length)
    expect(actual).toHaveLength(1)
    const actualStyle = StyleSheet.flatten(actual[0].props.style)
    const expectedStyle = StyleSheet.flatten(expected[0].props.style)
    for (const property of ["position", "top", "right", "bottom", "left", "borderRadius"])
      expect({ case: state().case, property, value: expectedStyle[property] }).toEqual({
        case: state().case,
        property,
        value: actualStyle[property],
      })
    expect(processColor(expectedStyle.backgroundColor)).toBe(processColor(actualStyle.backgroundColor))
    if (index < 23) await press("Next Switcher check")
  }
})
