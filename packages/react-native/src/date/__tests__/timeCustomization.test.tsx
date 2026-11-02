import "./temporalNativeModel"

import { fireEvent, render, screen, within } from "@testing-library/react-native"
import { createRef } from "react"
import { AccessibilityInfo, processColor, StyleSheet, type View } from "react-native"

import { TimePickerFixture } from "./fixtures/TimePickerFixture"
import { admitTemporal, temporalTarget } from "./temporalNativeModel"

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => jest.restoreAllMocks())

const press = (name: string) => fireEvent.press(screen.getByRole("button", { name }))
const owner = () => JSON.parse(screen.getByTestId("temporal-time-owner").props.children as string)
const appearance = () => JSON.parse(screen.getByTestId("temporal-time-appearance").props.children as string)
const hour = () =>
  screen.getAllByTestId(/^temporal-time-segment-/).find((node) => node.props.segmentId?.endsWith(":hour"))!

it("exposes all maintained TimePicker style owners and custom icon while retaining held values and original hosts", async () => {
  const root = createRef<View>()
  const view = await render(<TimePickerFixture rootRef={root} />)
  await admitTemporal()
  const originalRoot = root.current,
    originalHour = temporalTarget(hour().props.testID)
  expect(originalRoot).not.toBeNull()
  await press("Toggle time style owners")
  await press("Toggle time custom icon")
  await press("Toggle time theme")
  await admitTemporal()
  expect(screen.getByTestId("temporal-time")).toHaveStyle({ padding: 0, margin: 0 })
  expect(screen.getByTestId("temporal-time-group")).toHaveStyle({ borderWidth: 3, padding: 0 })
  expect(screen.getByTestId("temporal-time-input")).toHaveStyle({ padding: 0 })
  expect(screen.queryByTestId("temporal-time-clock")).toBeNull()
  const icon = screen.getByTestId("temporal-time-custom-icon")
  expect(icon).toHaveTextContent("Clock")
  expect(icon.props.accessible).toBe(false)
  expect(processColor(StyleSheet.flatten(icon.props.style).color)).toBe(processColor("#008000"))
  const text = within(hour()).getByText("13")
  expect(processColor(StyleSheet.flatten(text.props.style).color)).toBe(processColor("#0000ff"))
  expect(owner()).toMatchObject({ value: "13:45:07", requests: [], dark: true })
  expect(root.current).toBe(originalRoot)
  expect(temporalTarget(hour().props.testID)).toBe(originalHour)
  await press("Reset time scene")
  await admitTemporal()
  expect(screen.queryByTestId("temporal-time-custom-icon")).toBeNull()
  expect(screen.getByTestId("temporal-time-clock")).toBeOnTheScreen()
  expect(screen.getByTestId("temporal-time")).not.toHaveStyle({ padding: 0, margin: 0 })
  expect(screen.getByTestId("temporal-time-group")).toHaveStyle({ borderWidth: 1 })
  expect(screen.getByTestId("temporal-time-input")).toHaveStyle({ padding: 3.5 })
  expect(appearance()).toEqual({ customStyles: false, customIcon: false, geometry: "rounded", textSize: "medium" })
  expect(owner()).toEqual({
    value: "13:45:07",
    requests: [],
    echo: false,
    dark: false,
    readOnly: false,
    disabled: false,
    large: false,
  })
  expect(root.current).toBe(originalRoot)
  expect(temporalTarget(hour().props.testID)).toBe(originalHour)
  await view.unmount()
  expect(root.current).toBeNull()
})

it("cycles every maintained TimePicker geometry and text size on the same held original field", async () => {
  const root = createRef<View>()
  const view = await render(<TimePickerFixture rootRef={root} />)
  await admitTemporal()
  const originalRoot = root.current,
    originalHour = temporalTarget(hour().props.testID)
  expect(originalRoot).not.toBeNull()
  for (const [geometry, radius] of [
    ["rounded", 5],
    ["round", "50%"],
    ["orthogonal", undefined],
  ] as const) {
    expect(appearance().geometry).toBe(geometry)
    expect(StyleSheet.flatten(screen.getByTestId("temporal-time-group").props.style).borderRadius).toBe(radius)
    await press("Next time geometry")
    await admitTemporal()
  }
  for (const [size, fontSize] of [
    ["medium", 14],
    ["large", 16],
    ["small", 12],
  ] as const) {
    expect(appearance().textSize).toBe(size)
    expect(within(hour()).getByText("13")).toHaveStyle({ fontSize })
    await press("Next time text size")
    await admitTemporal()
  }
  expect(appearance()).toEqual({ customStyles: false, customIcon: false, geometry: "rounded", textSize: "medium" })
  expect(owner()).toMatchObject({ value: "13:45:07", requests: [] })
  expect(root.current).toBe(originalRoot)
  expect(temporalTarget(hour().props.testID)).toBe(originalHour)
  await view.unmount()
  expect(root.current).toBeNull()
})
