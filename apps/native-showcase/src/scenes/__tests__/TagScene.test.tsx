import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
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

const enterTagScene = async () => {
  await render(
    <SafeAreaInsetsContext.Provider value={{ top: 20, bottom: 10, left: 0, right: 0 }}>
      <NativeShowcase />
    </SafeAreaInsetsContext.Provider>,
  )
  const user = userEvent.setup()
  const press = async (name: string) => user.press(screen.getByRole("button", { name }))
  await press("Tag scene")
  return press
}

it("composes first activation, repeated owner veto, disabled/programmatic changes and exact typed IDs", async () => {
  const press = await enterTagScene()
  await press("Controlled tag")
  expect(screen.getByTestId("tag-state")).toHaveTextContent(/Owner: true\. Echo: true\. Requests: 1\. Last: number 0\./)
  await press("Toggle tag owner echo")
  await press("Toggle tag owner value")
  await press("Controlled tag")
  await press("Controlled tag")
  expect(screen.getByTestId("tag-state")).toHaveTextContent(
    /Owner: false\. Echo: false\. Requests: 3\. Last: number 0\./,
  )
  await press("Next tag ID")
  await press("Controlled tag")
  expect(screen.getByTestId("tag-state")).toHaveTextContent(/Requests: 4\. Last: string "0"\./)
  await press("Next tag ID")
  await press("Controlled tag")
  expect(screen.getByTestId("tag-state")).toHaveTextContent(/Requests: 5\. Last: string ""\./)
  await press("Next tag ID")
  await press("Controlled tag")
  expect(screen.getByTestId("tag-state")).toHaveTextContent(/Requests: 6\. Last: undefined\./)
  await press("Toggle tag disabled")
  await press("Controlled tag")
  expect(screen.getByTestId("tag-state")).toHaveTextContent(/Requests: 6\./)
  await press("Toggle tag owner value")
  expect(screen.getByTestId("tag-example").props.accessibilityState.checked).toBe(true)
  expect(screen.getByTestId("tag-example")).toBeDisabled()
})

it("preserves false/zero/empty owner state across live theme/window/fixture changes and resets explicitly", async () => {
  const press = await enterTagScene()
  await press("Toggle tag owner echo")
  await press("Next tag ID")
  await press("Next tag ID")
  await press("Controlled tag")
  await press("Toggle tag zero dimensions")
  await press("Dark theme")
  await press("Compact width")
  const window = Dimensions.get("window")
  try {
    await act(() => Dimensions.set({ window: { ...window, width: 800, height: 400, fontScale: 2 } }))
    expect(screen.getByTestId("tag-state")).toHaveTextContent(
      /Owner: false\. Echo: false\. Requests: 1\. Last: string ""\. ID: string "".*Size: zero/,
    )
    expect(screen.getByTestId("tag-example")).toHaveStyle({ width: 0, height: 0, borderColor: "#3d3d3d" })
    await press("Reset scene")
    await press("Tag scene")
    expect(screen.getByTestId("tag-state")).toHaveTextContent(
      /Owner: false\. Echo: true\. Requests: 0\. Last: none\. ID: number 0.*Size: automatic/,
    )
  } finally {
    await act(() => Dimensions.set({ window }))
  }
})

it("composes geometry, borders, colors, native text/final styles and exposed-state overrides independently", async () => {
  const press = await enterTagScene()
  await press("Toggle tag owner value")
  await press("Next tag accessibility override")
  expect(screen.getByTestId("tag-example").props.accessibilityState.checked).toBe(false)
  expect(screen.getByTestId("tag-state")).toHaveTextContent(/Owner: true/)
  await press("Next tag geometry")
  await press("Toggle tag borders")
  await press("Next tag border style")
  await press("Toggle tag colors")
  await press("Toggle tag raised")
  await press("Toggle tag styles")
  await press("Toggle tag width constraint")
  expect(screen.getByTestId("tag-example")).toHaveStyle({
    width: 140,
    borderRadius: 10000,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#2f7d18",
    backgroundColor: "#2f7d18",
    opacity: 0.8,
    elevation: 2,
  })
  expect(screen.getByText("Request this tag")).toHaveStyle({ color: "#b73434", fontSize: 20 })
  await press("Toggle long tag label")
  expect(screen.getByText(/Étiquette longue/)).toBeOnTheScreen()
  await press("Next tag transition")
  await press("Next tag transition")
  expect(screen.getByText(/background 1 s linear, delay 20 ms/)).toBeOnTheScreen()
  await press("Next tag geometry")
  expect(screen.getByTestId("tag-example")).toHaveStyle({ borderRadius: 0 })
  await press("Next tag accessibility override")
  await press("Next tag accessibility override")
  expect(screen.getByTestId("tag-example").props.accessibilityState.checked).toBe("mixed")
})

it("reports native layout separately from authored zero dimensions and their padding-box minimum", async () => {
  const press = await enterTagScene()
  await fireEvent(screen.getByTestId("tag-example"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 110.123456, height: 48 } },
  })
  expect(screen.getByTestId("tag-state")).toHaveTextContent(
    /Owner: false\. Echo: true\. Requests: 0.*Frame: 110.123 x 48\./,
  )
  await press("Toggle tag zero dimensions")
  await fireEvent(screen.getByTestId("tag-example"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 10, height: 10 } },
  })
  expect(screen.getByTestId("tag-state")).toHaveTextContent(/Requests: 0.*Size: zero.*Frame: 10 x 10\./)
  expect(screen.getByTestId("tag-example")).toHaveStyle({ width: 0, height: 0 })
})

it("can arm an owner-disabled takeover during a real press lifecycle without manufacturing a request", async () => {
  const press = await enterTagScene()
  await press("Arm tag disable during press")
  expect(screen.getByTestId("tag-state")).toHaveTextContent(/Armed guard: true/)
  const event = { nativeEvent: { timestamp: 10 } }
  await fireEvent(screen.getByTestId("tag-example"), "pressIn", event)
  await fireEvent.press(screen.getByTestId("tag-example"), event)
  expect(screen.getByTestId("tag-example")).toBeDisabled()
  expect(screen.getByTestId("tag-state")).toHaveTextContent(/Owner: false.*Requests: 0.*Armed guard: false/)
})
