import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import { Dimensions } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"

import { NativeShowcase } from "../NativeShowcase"

const enter = async () => {
  await render(
    <SafeAreaInsetsContext.Provider value={{ top: 20, bottom: 10, left: 0, right: 0 }}>
      <NativeShowcase />
    </SafeAreaInsetsContext.Provider>,
  )
  const user = userEvent.setup()
  const press = (name: string) => user.press(screen.getByRole("button", { name }))
  await press("Slider scene")
  return press
}
const scalar = () => screen.getByTestId("slider-scalar-thumb-1-target")
const upper = () => screen.getByTestId("slider-range-thumb-2-target")
const state = () => screen.getByTestId("slider-state")
const increment = (node: ReturnType<typeof scalar>) =>
  fireEvent(node, "accessibilityAction", { nativeEvent: { actionName: "increment" } })
beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

it("keeps exact scalar/range/end requests through veto, theme/window/fixture changes and reset", async () => {
  const press = await enter()
  await increment(scalar())
  await increment(upper())
  expect(state()).toHaveTextContent(/Scalar: 0.05.*Range: \[0.25,0.8\].*Requests: 2.*End: range \[0.25,0.8\].*Ends: 2/)
  await press("Toggle slider owner veto")
  await increment(scalar())
  await increment(scalar())
  expect(state()).toHaveTextContent(/Scalar: 0.05.*Request: scalar 0.1.*Requests: 4.*End: scalar 0.1.*Ends: 4/)
  await press("Dark theme")
  await press("Compact width")
  await act(() =>
    Dimensions.set({
      window: { width: 844, height: 390, scale: 1, fontScale: 1 },
      screen: { width: 844, height: 390, scale: 1, fontScale: 1 },
    }),
  )
  expect(state()).toHaveTextContent(/Scalar: 0.05.*Range: \[0.25,0.8\].*Requests: 4.*Ends: 4/)
  await press("Reset scene")
  await press("Slider scene")
  expect(state()).toHaveTextContent(/Scalar: 0.*Range: \[0.25,0.75\].*Request: none.*Requests: 0.*End: none.*Ends: 0/)
})

it("exposes member/group guards and controlled empty/stacked/programmatic values without fake callbacks", async () => {
  const press = await enter()
  await press("Toggle slider upper editable")
  expect(upper().props.accessibilityState.disabled).toBe(true)
  await increment(upper())
  expect(state()).toHaveTextContent(/Requests: 0.*Ends: 0/)
  await press("Set stacked slider range")
  expect(upper().props.accessibilityState.disabled).toBe(false)
  expect(state()).toHaveTextContent(/Range: \[0.5,0.5\].*Requests: 0/)
  await press("Toggle empty slider range")
  expect(screen.queryByTestId("slider-range-thumb-1-target")).toBeNull()
  expect(state()).toHaveTextContent(/Range: \[\]/)
  await press("Toggle empty slider range")
  await increment(upper())
  expect(state()).toHaveTextContent(/Range: \[0.25,0.8\].*Requests: 1.*Ends: 1/)
  await press("Toggle slider disabled")
  expect(scalar().props.accessibilityState.disabled).toBe(true)
  await increment(scalar())
  await press("Set slider scalar maximum")
  expect(scalar()).toHaveAccessibilityValue({ now: 1 })
  expect(state()).toHaveTextContent(/Requests: 1.*Ends: 1/)
  await press("Set slider scalar zero")
  expect(scalar()).toHaveAccessibilityValue({ now: 0 })
})

it("exercises five style owners, direction/orientation/format, authored zero and observational native frames", async () => {
  const press = await enter()
  await press("Toggle slider styles")
  await press("Toggle slider orientation")
  await press("Toggle slider direction")
  await press("Next slider geometry")
  await press("Next slider order")
  await press("Toggle slider locale")
  await press("Toggle slider format")
  await press("Toggle slider shadow")
  await press("Toggle slider focus style")
  expect(state()).toHaveTextContent(
    /Orientation: vertical.*Direction: rtl.*Order: primary.*Geometry: rounded.*Locale: fr-CA.*Format: percent/,
  )
  expect(screen.getByTestId("slider-scalar")).toHaveStyle({ height: 240, padding: 6, borderWidth: 1 })
  expect(screen.getByTestId("slider-range")).toHaveStyle({ maxWidth: 280 })
  expect(screen.getByTestId("slider-range-output")).toHaveStyle({ fontSize: 16 })
  expect(screen.getByTestId("slider-range-output")).toHaveTextContent(/25.*75/)
  expect(screen.getByTestId("slider-range-thumb-1")).toHaveStyle({
    width: "100%",
    height: "100%",
    borderRadius: 5,
    minHeight: 0,
  })
  expect(screen.getByTestId("slider-range-thumb-1-target")).toHaveStyle({ width: 24, height: 24 })
  await press("Toggle slider zero width")
  expect(screen.getByTestId("slider-scalar")).toHaveStyle({ width: 0 })
  await fireEvent(screen.getByTestId("slider-scalar"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 0, height: 240 } },
  })
  expect(screen.getByTestId("slider-frame")).toHaveTextContent(/0 x 240/)
  expect(state()).toHaveTextContent(/Scalar: 0.*Range: \[0.25,0.75\].*Requests: 0.*Ends: 0/)
})
