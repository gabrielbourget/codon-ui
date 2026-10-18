import { act, render, screen, userEvent } from "@testing-library/react-native"
import { AccessibilityInfo, Dimensions } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"

import { NativeShowcase } from "../NativeShowcase"

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

const enterScene = async () => {
  await render(
    <SafeAreaInsetsContext.Provider value={{ top: 20, bottom: 10, left: 0, right: 0 }}>
      <NativeShowcase />
    </SafeAreaInsetsContext.Provider>,
  )
  const user = userEvent.setup()
  const press = async (name: string) => user.press(screen.getByRole("button", { name }))
  await press("Progress/Meter scene")
  return press
}

it("composes controlled progress/measurement and preserves zero across theme and layout changes", async () => {
  const press = await enterScene()
  expect(screen.getByRole("progressbar", { name: "Task progress" })).toHaveAccessibilityValue({ now: 25, text: "25%" })
  expect(screen.getByRole("meter", { name: "Measured capacity" })).toHaveAccessibilityValue({
    min: -50,
    max: 50,
    now: -25,
    text: "-25",
  })
  await press("Advance range by 25")
  expect(screen.getByRole("progressbar")).toHaveAccessibilityValue({ now: 50 })
  await press("Reset range to zero")
  await press("Dark theme")
  await press("Compact width")
  const window = Dimensions.get("window")
  await act(() => Dimensions.set({ window: { ...window, width: 800, height: 400, fontScale: 2 } }))
  try {
    expect(screen.getByTestId("range-state")).toHaveTextContent(/Progress: 0%\. Measurement: -50\./)
    expect(screen.getByRole("progressbar")).toHaveAccessibilityValue({ now: 0, text: "0%" })
    expect(screen.getByRole("meter")).toHaveAccessibilityValue({ now: -50, text: "-50" })
    expect(screen.getByTestId("range-meter-track")).toHaveStyle({ borderColor: "#474747" })
  } finally {
    await act(() => Dimensions.set({ window }))
  }
})

it("isolates unknown progress and changes dimensions, direction, geometry and all style slots", async () => {
  const press = await enterScene()
  await press("Toggle unknown progress")
  expect(screen.getByRole("progressbar").props.accessibilityValue).toEqual({})
  expect(screen.getByRole("meter")).toHaveAccessibilityValue({ now: -25 })
  await press("Toggle range orientation")
  await press("Reverse range direction")
  await press("Next range geometry")
  await press("Next range order")
  expect(screen.getByTestId("range-state")).toHaveTextContent(
    /Vertical, reversed\. Geometry: orthogonal\. Order: primary\./,
  )
  expect(screen.getByTestId("range-meter")).toHaveStyle({ width: 18, height: 140 })
  expect(screen.getByTestId("range-meter-bar", { includeHiddenElements: true })).toHaveStyle({
    top: 0,
    height: "25%",
    borderRadius: 0,
  })
  await press("Toggle range styles")
  expect(screen.getByTestId("range-meter")).toHaveStyle({ opacity: 0.85 })
  expect(screen.getByTestId("range-meter-track")).toHaveStyle({ borderColor: "#a66b00", elevation: 2 })
  expect(screen.getByTestId("range-meter-bar", { includeHiddenElements: true })).toHaveStyle({
    backgroundColor: "#2f7d18",
    borderRadius: 2,
  })
  await press("Toggle authored value labels")
  expect(screen.getByRole("meter")).toHaveAccessibilityValue({ text: "-25 units" })
  await press("Toggle unknown progress")
  expect(screen.getByRole("progressbar")).toHaveAccessibilityValue({ now: 25, text: "25 of 100 tasks" })
  await press("Reset scene")
  await press("Progress/Meter scene")
  expect(screen.getByTestId("range-state")).toHaveTextContent(
    /Progress: 25%.*Known progress\. Horizontal, forward\. Geometry: round\. Order: semantic\./,
  )
})
