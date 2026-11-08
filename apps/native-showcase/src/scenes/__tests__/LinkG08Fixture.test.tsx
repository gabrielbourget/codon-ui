import { act, fireEvent, render, screen, userEvent, within } from "@testing-library/react-native"
import { AccessibilityInfo, Linking, StyleSheet, processColor } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"

import { NativeShowcase } from "../NativeShowcase"

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  jest.spyOn(Linking, "openURL").mockResolvedValue(undefined)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})
const state = () => JSON.parse(screen.getByTestId("link-native-state").props.accessibilityLabel)
const target = () => screen.getByTestId("link-native-target")
const enter = async () => {
  await render(
    <SafeAreaInsetsContext.Provider value={{ top: 20, bottom: 10, left: 0, right: 0 }}>
      <NativeShowcase />
    </SafeAreaInsetsContext.Provider>,
  )
  const user = userEvent.setup()
  const press = (name: string) => user.press(screen.getByRole("button", { name }))
  await press("Link scene")
  await press("Prepare standalone Link checks")
  return press
}
const activate = async () => {
  let prevented = false
  const event = {
    target: 79,
    currentTarget: 81,
    nativeEvent: { timestamp: Date.now() },
    preventDefault: () => {
      prevented = true
    },
    isDefaultPrevented: () => prevented,
  }
  await fireEvent(target(), "press", event)
  return event
}
it("prepares exact Link URI vetoes, original transient event snapshots and owned visited echo", async () => {
  const press = await enter()
  await activate()
  await activate()
  expect(state()).toMatchObject({ visited: false })
  expect(state().requests).toHaveLength(2)
  expect(state().requests[0]).toMatchObject({
    href: "codon-lab-unhandled://destination?value=0&empty=",
    target: 79,
    currentTarget: 81,
    before: false,
    after: true,
  })
  expect(Linking.openURL).not.toHaveBeenCalled()
  await press("Next Link check")
  await activate()
  expect(state().visited).toBe(true)
  await press("Next Link check")
  await activate()
  expect(state().requests).toHaveLength(3)
  for (let index = 0; index < 6; index++) await press("Next Link check")
  expect(state().case).toBe("small-hit-target")
  await fireEvent(target(), "layout", {
    target: 79,
    currentTarget: 81,
    nativeEvent: { layout: { x: 12, y: 12, width: 24, height: 24 } },
  })
  expect(StyleSheet.flatten(target().props.style)).toMatchObject({ width: 24, height: 24 })
  expect(target().props.hitSlop).toEqual({ left: 10, right: 10, top: 10, bottom: 10 })
})
it("preflights all Link reference layout, typography, paint and decoration inputs before native execution", async () => {
  const press = await enter()
  await press("Link styles checks")
  for (let i = 0; i < 18; i++) {
    let row = state()
    if (row.case === "dark") await press("Dark theme")
    if (row.case === "light-restored") await press("Light theme")
    await act(() => jest.advanceTimersByTime(1000))
    row = state()
    const actual = StyleSheet.flatten(target().props.style),
      referenceNode = screen.getByTestId("link-native-reference"),
      reference = StyleSheet.flatten(referenceNode.props.style)
    for (const property of [
      "width",
      "height",
      "minWidth",
      "minHeight",
      "padding",
      "paddingHorizontal",
      "flexDirection",
      "alignItems",
      "gap",
      "borderRadius",
      "opacity",
      "overflow",
      "borderWidth",
    ]) {
      const fallback = property === "paddingHorizontal" ? reference.padding : undefined
      expect({ case: row.case, property, value: actual[property] }).toEqual({
        case: row.case,
        property,
        value: reference[property] ?? fallback,
      })
    }
    for (const property of ["backgroundColor", "borderColor"])
      expect(processColor(actual[property])).toEqual(processColor(reference[property]))
    const text = StyleSheet.flatten(within(target()).getByText(row.display).props.style),
      raw = StyleSheet.flatten(within(referenceNode).getByText(row.display).props.style)
    for (const property of [
      "fontSize",
      "fontFamily",
      "fontWeight",
      "fontStyle",
      "lineHeight",
      "textDecorationLine",
      "flexShrink",
    ])
      expect({ case: row.case, property, value: text[property] }).toEqual({
        case: row.case,
        property,
        value: raw[property],
      })
    expect(processColor(text.color)).toEqual(processColor(raw.color))
    if (i !== 17) await press("Next Link check")
  }
})
it("prepares Link matched-origin endpoint controls, sustained125ms retargets and real retirement states", async () => {
  const press = await enter()
  await press("Link motion checks")
  await press("Second")
  expect(state().foreground).toBe("#117733")
  await press("Show Link reference")
  expect(screen.getByTestId("link-native-reference-parent")).toHaveStyle({ position: "absolute", top: 0, left: 0 })
  await press("Show Link component")
  await press("Arm Link motion and retirement")
  await act(() => jest.advanceTimersByTime(8250))
  expect(screen.queryByTestId("link-native-target")).toBeNull()
  expect(state().motionTrace).toHaveLength(42)
  await act(() => jest.advanceTimersByTime(2000))
  expect(target()).toBeOnTheScreen()
  expect(state().motionTrace.at(-1).name).toBe("fresh")
})
