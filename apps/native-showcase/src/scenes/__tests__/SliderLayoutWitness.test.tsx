import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import type { View } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"

import { NativeShowcase } from "../NativeShowcase"
import * as layoutObserver from "../sliderLayoutObserver"

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

it("marks a fresh geometry read pending without replacing the measured output during acquisition", async () => {
  const frame = { x: 26, y: 300, width: 300, height: 58 }
  const bounds = { root: frame, track: frame, target: frame, paint: frame }
  const receipt = {
    coordinateSpace: "stock-native-viewport-bounds-with-original-root-window-offset",
    targetID: "scalar:thumb:0",
    tags: [101, 102, 103, 104],
    viewport: bounds,
    rootWindow: frame,
    window: { track: frame, target: frame, paint: frame },
    qualification: "fixture sequencing control",
  }
  const read = jest.spyOn(layoutObserver, "readSliderLayoutOriginalGeometry").mockResolvedValueOnce(receipt)
  try {
    const press = await enter()
    await press("Prepare scalar layout witness")
    await press("Measure scalar original thumb geometry")
    const geometry = () => screen.getByTestId("slider-layout-native-geometry")
    expect(geometry()).toHaveTextContent(`Original native thumb geometry: ${JSON.stringify(receipt)}.`)
    let receive: ((value: typeof receipt) => void) | undefined
    read.mockImplementationOnce(() => new Promise((resolve) => (receive = resolve)))
    await press("Measure scalar original thumb geometry")
    expect(geometry()).toHaveTextContent(`Original native thumb geometry: ${JSON.stringify(receipt)}.`)
    expect(geometry().props.accessibilityLabel).toBe("Original native thumb geometry: pending.")
    const next = { ...receipt, rootWindow: { ...frame, x: 42 } }
    await act(() => receive?.(next))
    expect(geometry()).toHaveTextContent(`Original native thumb geometry: ${JSON.stringify(next)}.`)
    expect(geometry().props.accessibilityLabel).toBe(`Original native thumb geometry: ${JSON.stringify(next)}.`)
  } finally {
    read.mockRestore()
  }
})

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
  const held = () => JSON.parse(screen.getByTestId("slider-layout-held-json").props.accessibilityLabel)
  expect(held()).toMatchObject({ preset: "translated", scalar: 0.5, requests: 0, ends: 0, dropped: 0 })
  await fireEvent(root, "touchMove", { nativeEvent: { ...nativeEvent, pageX: 202.25, timestamp: 123.5 } })
  expect(held().receipts).toEqual([
    expect.objectContaining({ sequence: 1, phase: "start", target: 901, identifier: 7, pageX: 201.25, timestamp: 123 }),
    expect.objectContaining({
      sequence: 2,
      phase: "move",
      target: 901,
      identifier: 7,
      pageX: 202.25,
      timestamp: 123.5,
    }),
  ])
  expect(held()).toMatchObject({ scalar: 0.5, requests: 0, ends: 0, dropped: 0 })
  await fireEvent(scalar(), "accessibilityAction", { nativeEvent: { actionName: "increment" } })
  expect(witness()).toHaveTextContent(/"sequence":3.*"kind":"request","value":0.55/)
  expect(witness()).toHaveTextContent(/"sequence":4.*"kind":"change-end","value":0.55/)
  expect(screen.getByTestId("slider-state")).toHaveTextContent(/Scalar: 0.55.*Requests: 1.*Ends: 1/)
  await fireEvent(root, "touchEnd", { nativeEvent: { ...nativeEvent, timestamp: 124 } })
  expect(witness()).toHaveTextContent(/"sequence":5.*"kind":"touch","phase":"end"/)
  expect(held().receipts[4]).toMatchObject({ phase: "end", target: 901, identifier: 7, timestamp: 124 })
})
