import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import type { View } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"

import { NativeShowcase } from "../NativeShowcase"

const scalar = () => screen.getByTestId("slider-scalar-thumb-1-target")
const paint = () => screen.getByTestId("slider-scalar-thumb-1")
const witness = () => screen.getByTestId("slider-layout-witness")
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
const originalHost = (element: ReturnType<typeof scalar>) => {
  let fiber = element.unstable_fiber
  while (fiber) {
    const value = fiber.stateNode as View | null
    if (typeof value?.measureInWindow === "function") return value
    fiber = fiber.return
  }
  throw new Error("Original native host unavailable")
}
beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

it("wires deterministic placement presets to the same original scalar target and paint without numeric requests", async () => {
  const press = await enter()
  const target = originalHost(scalar())
  const body = originalHost(paint())
  await press("Prepare scalar layout witness")
  expect(screen.getByTestId("slider-state")).toHaveTextContent(/Scalar: 0.5.*Requests: 0.*Ends: 0/)
  expect(scalar()).toHaveStyle({ width: 24, height: 24 })
  expect(paint()).toHaveStyle({ width: "100%", height: "100%" })
  await press("Use scalar layout translated")
  expect(scalar()).toHaveStyle({
    transform: [{ translateX: "-50%" }, { translateY: "-50%" }, { translateX: 48 }],
  })
  await press("Use scalar layout repositioned")
  expect(scalar()).toHaveStyle({ left: "35%", top: "50%" })
  await press("Use scalar layout rotated-scaled")
  expect(scalar()).toHaveStyle({
    transform: [
      { translateX: "-50%" },
      { translateY: "-50%" },
      { translateX: 48 },
      { rotate: "20deg" },
      { scale: 1.25 },
    ],
  })
  expect(originalHost(scalar())).toBe(target)
  expect(originalHost(paint())).toBe(body)
  expect(screen.getByTestId("slider-range-thumb-1-target")).not.toHaveStyle({ width: 24, height: 24 })
  expect(screen.getByTestId("slider-state")).toHaveTextContent(/Scalar: 0.5.*Requests: 0.*Ends: 0/)
  await press("Disable scalar layout witness")
  expect(witness()).toHaveTextContent(/preset: off/)
})

it("restores the finite baseline after other scene controls without generating request or end callbacks", async () => {
  const press = await enter()
  for (const name of [
    "Toggle slider owner veto",
    "Toggle slider disabled",
    "Toggle slider orientation",
    "Toggle slider direction",
    "Toggle slider styles",
    "Toggle slider zero width",
    "Toggle slider locale",
    "Toggle slider format",
    "Toggle slider shadow",
    "Toggle slider focus style",
    "Next slider order",
    "Next slider geometry",
  ])
    await press(name)
  await press("Prepare scalar layout witness")
  expect(screen.getByTestId("slider-state")).toHaveTextContent(
    /Scalar: 0.5.*Requests: 0.*Ends: 0.*Parent: echo.*Disabled: false.*Orientation: horizontal.*Direction: ltr.*Order: none.*Geometry: round.*Locale: en-US.*Format: decimal/,
  )
  expect(witness()).toHaveTextContent(/preset: baseline.*event\/callback receipts: none/)
  expect(screen.getByTestId("slider-scalar")).toHaveStyle({ width: "100%" })
  expect(scalar()).toHaveStyle({ width: 24, height: 24 })
  expect(scalar().props.accessibilityState.disabled).toBe(false)
  expect(paint()).toHaveStyle({ borderRadius: 5, shadowOpacity: 0.24, elevation: 2 })
  await fireEvent(scalar(), "focus")
  expect(scalar()).toHaveStyle({ outlineWidth: 2 })
})

it("records original-root measurements and actual callback arguments while rejecting a stale preset measurement", async () => {
  const press = await enter()
  await press("Prepare scalar layout witness")
  const root = screen.getByTestId("slider-scalar")
  const native = originalHost(root)
  let receive: Parameters<View["measureInWindow"]>[0] | undefined
  Object.defineProperty(native, "measureInWindow", {
    configurable: true,
    value: jest.fn((callback: Parameters<View["measureInWindow"]>[0]) => (receive = callback)),
  })
  await press("Measure scalar original root")
  await act(() => receive?.(31.25, 80.5, 300, 76))
  expect(witness()).toHaveTextContent(/"x":31.25,"y":80.5,"width":300,"height":76/)
  await press("Measure scalar original root")
  const stale = receive
  await press("Use scalar layout translated")
  await act(() => stale?.(999, 999, 999, 999))
  expect(witness()).toHaveTextContent(/window frame: unmeasured/)
  await press("Measure scalar original thumb geometry")
  expect(screen.getByTestId("slider-layout-native-geometry")).toHaveTextContent(/unavailable:/)
  const nativeEvent = {
    target: 901,
    identifier: 7,
    pageX: 201.25,
    pageY: 120.5,
    locationX: 14,
    locationY: 15,
    timestamp: 123,
  }
  await fireEvent(root, "touchStart", { nativeEvent })
  expect(witness()).toHaveTextContent(/"kind":"touch","phase":"start","target":901,"identifier":7/)
  expect(screen.getByTestId("slider-state")).toHaveTextContent(/Requests: 0.*Ends: 0/)
  await fireEvent(scalar(), "accessibilityAction", { nativeEvent: { actionName: "increment" } })
  expect(witness()).toHaveTextContent(/"sequence":2.*"kind":"request","value":0.55/)
  expect(witness()).toHaveTextContent(/"sequence":3.*"kind":"change-end","value":0.55/)
  expect(screen.getByTestId("slider-state")).toHaveTextContent(/Scalar: 0.55.*Requests: 1.*Ends: 1/)
  await fireEvent(root, "touchEnd", { nativeEvent: { ...nativeEvent, timestamp: 124 } })
  expect(witness()).toHaveTextContent(/"sequence":4.*"kind":"touch","phase":"end"/)
})
