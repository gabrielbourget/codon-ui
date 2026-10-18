import { act, render, screen, userEvent } from "@testing-library/react-native"
import { Dimensions } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"

import { NativeShowcase } from "../NativeShowcase"

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

const enterDisplayScene = async () => {
  await render(
    <SafeAreaInsetsContext.Provider value={{ top: 20, bottom: 10, left: 0, right: 0 }}>
      <NativeShowcase />
    </SafeAreaInsetsContext.Provider>,
  )
  const user = userEvent.setup()
  const press = async (name: string) => user.press(screen.getByRole("button", { name }))
  await press("Indicator/Segment scene")
  return press
}

it("retains controlled false and zero through theme/window/fixture changes and resets explicitly", async () => {
  const press = await enterDisplayScene()
  expect(screen.getByTestId("display-indicator")).toHaveStyle({ width: 10, height: 10, backgroundColor: "#171717" })
  expect(screen.getByTestId("display-owned-indicator")).toHaveStyle({ backgroundColor: "#ffffff" })
  await press("Toggle indicator activity")
  await press("Toggle zero dimensions")
  await press("Dark theme")
  await press("Compact width")
  const window = Dimensions.get("window")
  try {
    await act(() => Dimensions.set({ window: { ...window, width: 800, height: 400, fontScale: 2 } }))
    expect(screen.getByTestId("display-state")).toHaveTextContent(
      /Indicator: inactive\. Shape: circle\. Size: 0\. Segment token: horizontal\./,
    )
    expect(screen.getByTestId("display-indicator")).toHaveStyle({
      width: 0,
      height: 0,
      backgroundColor: "transparent",
      borderColor: "#ffffff",
    })
    expect(screen.getByTestId("display-segment")).toHaveStyle({ width: 0, height: 0, backgroundColor: "#474747" })
    await press("Reset scene")
    await press("Indicator/Segment scene")
    expect(screen.getByTestId("display-state")).toHaveTextContent(
      /Indicator: active\. Shape: circle\. Size: 10\. Segment token: horizontal\./,
    )
  } finally {
    await act(() => Dimensions.set({ window }))
  }
})

it("composes every shape, native semantic opt-in, geometry, color and final override controls", async () => {
  const press = await enterDisplayScene()
  await press("Next indicator shape")
  await press("Next display size")
  await press("Toggle indicator border")
  await press("Toggle segment direction")
  await press("Toggle explicit display colors")
  expect(screen.getByTestId("display-indicator")).toHaveStyle({
    width: 14,
    height: 14,
    borderWidth: 2,
    borderRadius: 5,
    backgroundColor: "#2f7d18",
  })
  expect(screen.getByTestId("display-segment")).toHaveStyle({ width: 90, height: 3, backgroundColor: "#2f7d18" })
  expect(screen.getByTestId("display-segment").props.accessible).toBe(true)
  expect(screen.getByTestId("display-segment").props.accessibilityLabel).toBe("Example boundary")
  expect(screen.getByTestId("display-segment").props.role).toBeUndefined()
  expect(screen.getByTestId("display-indicator").props.accessibilityLabel).toBe("Availability active")
  await press("Toggle indicator activity")
  expect(screen.getByTestId("display-indicator")).toHaveStyle({ backgroundColor: "#a66b00", borderColor: "#2f7d18" })
  await press("Toggle display styles")
  expect(screen.getByTestId("display-indicator")).toHaveStyle({ backgroundColor: "#b73434", opacity: 0.8 })
  expect(screen.getByTestId("display-segment")).toHaveStyle({ backgroundColor: "#2f7d18", opacity: 0.75 })
  await press("Next indicator shape")
  expect(screen.getByTestId("display-indicator")).toHaveStyle({ borderRadius: 0 })
  await press("Toggle activity from example action")
  expect(screen.getByTestId("display-indicator").props.accessibilityLabel).toBe("Availability active")
  await press("Toggle display styles")
  await press("Toggle explicit display colors")
  expect(screen.getByTestId("display-indicator")).toHaveStyle({ backgroundColor: "#171717" })
})
