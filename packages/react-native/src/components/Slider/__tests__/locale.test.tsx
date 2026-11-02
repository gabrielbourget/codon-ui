import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { AccessibilityInfo, type MeasureOnSuccessCallback } from "react-native"

import { NativeLocaleProvider, Slider, type TNativeSliderRef, type TNativeSliderStyleState } from "../../.."

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

const nativeMethods: { measure: jest.Mock } = jest.requireActual(
  "@react-native/jest-preset/jest/MockNativeMethods",
).default
let state: TNativeSliderStyleState
const observe = (value: TNativeSliderStyleState) => {
  state = value
  return {}
}
beforeEach(() => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => jest.restoreAllMocks())

it("inherits live native locale formatting and keeps explicit locale authoritative without replacing the root", async () => {
  const ref = createRef<TNativeSliderRef>()
  const onChange = jest.fn()
  const node = (locale: string, explicit?: string) => (
    <NativeLocaleProvider locale={locale}>
      <Slider
        label="Value"
        ref={ref}
        value={1234.5}
        maxValue={2000}
        step={0.5}
        locale={explicit}
        style={observe}
        onChange={onChange}
      />
    </NativeLocaleProvider>
  )
  const result = await render(node("de-DE"))
  const original = ref.current
  expect(screen.getByTestId("slider-output")).toHaveTextContent(new Intl.NumberFormat("de-DE").format(1234.5))
  await result.rerender(node("ar-EG"))
  expect(screen.getByTestId("slider-output")).toHaveTextContent(new Intl.NumberFormat("ar-EG").format(1234.5))
  await result.rerender(node("ar-EG", "en-US"))
  expect(screen.getByTestId("slider-output")).toHaveTextContent(new Intl.NumberFormat("en-US").format(1234.5))
  expect(state.state.getFormattedValue(1234.5)).toBe(new Intl.NumberFormat("en-US").format(1234.5))
  expect(ref.current).toBe(original)
  expect(state.state.values).toEqual([1234.5])
  expect(onChange).not.toHaveBeenCalled()
})

it("inherits locale direction for horizontal placement while explicit direction keeps precedence", async () => {
  const node = (locale: string, direction?: "ltr" | "rtl") => (
    <NativeLocaleProvider locale={locale}>
      <Slider label="Value" value={0} direction={direction} />
    </NativeLocaleProvider>
  )
  const result = await render(node("en-US"))
  await fireEvent(screen.getByTestId("slider-track"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 48 } },
  })
  const target = () => screen.getByTestId("slider-thumb-1-target")
  const inset = target().props.style[1].width / 2
  expect(target()).toHaveStyle({ left: inset })
  await result.rerender(node("ar-EG"))
  expect(target()).toHaveStyle({ left: 300 - inset })
  await result.rerender(node("ar-EG", "ltr"))
  expect(target()).toHaveStyle({ left: inset })
})

it.each([
  ["de-DE", true],
  ["ar-EG", false],
] as const)(
  "resolves all delayed measurements after locale %s and admits the gesture only when direction survives",
  async (locale, survives) => {
    const onChange = jest.fn(),
      onChangeEnd = jest.fn()
    const measurements: (() => void)[] = []
    nativeMethods.measure.mockImplementation(function (
      this: { props: { testID: string } },
      callback: MeasureOnSuccessCallback,
    ) {
      const frame =
        this.props.testID === "slider-track"
          ? [100, 200, 300, 48]
          : this.props.testID.endsWith("-target")
            ? [100, 200, 48, 48]
            : [115, 215, 18, 18]
      measurements.push(() => callback(0, 0, frame[2], frame[3], frame[0], frame[1]))
    })
    const node = (locale: string) => (
      <NativeLocaleProvider locale={locale}>
        <Slider label="Value" onChange={onChange} onChangeEnd={onChangeEnd} />
      </NativeLocaleProvider>
    )
    const result = await render(node("en-US"))
    const event = { nativeEvent: { pageX: 200, pageY: 224, identifier: 1 } }
    await fireEvent(screen.getByTestId("slider-track"), "responderGrant", event)
    await fireEvent(screen.getByTestId("slider-track"), "responderRelease", event)
    expect(measurements).toHaveLength(3)
    await result.rerender(node(locale))
    await act(() => measurements.forEach((resolve) => resolve()))
    expect(onChange.mock.calls).toEqual(survives ? [[[30]]] : [])
    expect(onChangeEnd.mock.calls).toEqual(survives ? [[[30]]] : [])
  },
)
