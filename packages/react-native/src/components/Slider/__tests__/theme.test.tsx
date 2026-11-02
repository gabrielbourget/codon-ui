import { act, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { AccessibilityInfo, PlatformColor, StyleSheet, type ColorValue, type View } from "react-native"

import { NativeThemeProvider, Slider, type TNativeSliderStyleState, type SliderProps } from "../../.."
import { resolveNativeTheme } from "../../../theme/defaults"

jest.mock("../../../input/specs/CUIFocusViewNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
  Commands: {
    requestKeyboardFocus: jest.fn(),
    requestKeyboardBlur: jest.fn(),
    requestContainerFocus: jest.fn(),
    inspectAccessibility: jest.fn(),
  },
}))
let state: TNativeSliderStyleState
const observe = (current: TNativeSliderStyleState) => {
  state = current
  return {}
}
const body = () => screen.getByTestId("slider-thumb-1")
beforeEach(() => jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true))
afterEach(() => jest.restoreAllMocks())

it.each(["light", "dark"] as const)("preserves omitted-role rest/drag colors in %s", async (mode) => {
  await render(
    <NativeThemeProvider mode={mode}>
      <Slider label="Value" style={observe} />
    </NativeThemeProvider>,
  )
  expect(body()).toHaveStyle({ backgroundColor: resolveNativeTheme(mode).colors.controlForeground })
  await act(() => state.state.setThumbDragging(0, true))
  expect(body()).toHaveStyle({ backgroundColor: mode === "dark" ? "#9e9e9e" : "#474747" })
})

it("uses the live unordered role only while dragging and preserves original refs/values without value or end callbacks", async () => {
  const ref = createRef<View>(),
    changed = jest.fn(),
    ended = jest.fn()
  const node = (value?: ColorValue) => (
    <NativeThemeProvider overrides={{ colors: { controlDraggedBackground: value } }}>
      <Slider label="Value" ref={ref} value={25} style={observe} onChange={changed} onChangeEnd={ended} />
    </NativeThemeProvider>
  )
  const result = await render(node("red")),
    original = ref.current
  expect(body()).toHaveStyle({ backgroundColor: resolveNativeTheme("light").colors.controlForeground })
  await act(() => state.state.setThumbDragging(0, true))
  expect(body()).toHaveStyle({ backgroundColor: "red" })
  await result.rerender(node("blue"))
  expect(body()).toHaveStyle({ backgroundColor: "blue" })
  await result.rerender(node())
  expect(body()).toHaveStyle({ backgroundColor: "#474747" })
  expect(ref.current).toBe(original)
  expect(state.state.values).toEqual([25])
  expect(changed).not.toHaveBeenCalled()
  expect(ended).not.toHaveBeenCalled()
})

it("keeps final custom paint and explicit thumbColor ahead of the role, and ordered colors independent", async () => {
  const node = (props: Partial<SliderProps>) => (
    <NativeThemeProvider overrides={{ colors: { controlDraggedBackground: "red" } }}>
      <Slider label="Value" style={observe} {...props} />
    </NativeThemeProvider>
  )
  const result = await render(node({ thumbColor: "green", customThumbStyles: { backgroundColor: "purple" } }))
  await act(() => state.state.setThumbDragging(0, true))
  expect(body()).toHaveStyle({ backgroundColor: "purple" })
  await result.rerender(node({ thumbColor: "green" }))
  expect(body()).toHaveStyle({ backgroundColor: "green" })
  await result.rerender(node({ order: "primary" }))
  expect(body()).toHaveStyle({ backgroundColor: resolveNativeTheme("light").actions.primary.hoverBackground })
})

it("retains opaque native ColorValue identity for the new role without inventing a browser color", async () => {
  const color = PlatformColor("labelColor")
  await render(
    <NativeThemeProvider overrides={{ colors: { controlDraggedBackground: color } }}>
      <Slider label="Value" style={observe} />
    </NativeThemeProvider>,
  )
  await act(() => state.state.setThumbDragging(0, true))
  expect(StyleSheet.flatten(body().props.style).backgroundColor).toBe(color)
})
