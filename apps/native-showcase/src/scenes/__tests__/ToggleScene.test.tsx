import { act, render, screen, userEvent } from "@testing-library/react-native"
import { Dimensions } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"

import { NativeShowcase } from "../NativeShowcase"

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

const enterToggleScene = async () => {
  await render(
    <SafeAreaInsetsContext.Provider value={{ top: 20, bottom: 10, left: 0, right: 0 }}>
      <NativeShowcase />
    </SafeAreaInsetsContext.Provider>,
  )
  const user = userEvent.setup()
  const press = async (name: string) => user.press(screen.getByRole("button", { name }))
  await press("Toggle scene")
  return press
}

it("retains controlled false and repeated veto requests through theme/window/fixture changes and reset", async () => {
  const press = await enterToggleScene()
  await press("Toggle caller veto")
  await press("Controlled flag")
  await press("Controlled flag")
  expect(screen.getByTestId("toggle-state")).toHaveTextContent(
    /Owner: false\. Request: true\. Requests: 2\. Activations: 2\./,
  )
  expect(screen.getByTestId("toggle-controlled").props.accessibilityState.checked).toBe(false)
  await press("Local flag")
  await press("Dark theme")
  await press("Compact width")
  const window = Dimensions.get("window")
  try {
    await act(() => Dimensions.set({ window: { ...window, width: 800, height: 400, fontScale: 2 } }))
    expect(screen.getByTestId("toggle-state")).toHaveTextContent(/Owner: false\. Request: true\. Requests: 2\./)
    expect(screen.getByTestId("toggle-uncontrolled").props.accessibilityState.checked).toBe(false)
    await press("Toggle toggle disabled")
    await press("Controlled flag")
    expect(screen.getByTestId("toggle-state")).toHaveTextContent(/Requests: 2\. Activations: 2\./)
    await press("Reset scene")
    await press("Toggle scene")
    expect(screen.getByTestId("toggle-state")).toHaveTextContent(
      /Owner: false\. Request: none\. Requests: 0\. Activations: 0\./,
    )
    expect(screen.getByTestId("toggle-uncontrolled").props.accessibilityState.checked).toBe(true)
  } finally {
    await act(() => Dimensions.set({ window }))
  }
})

it("composes accepted owner requests, render foreground, theme orders, geometry and final style controls", async () => {
  const press = await enterToggleScene()
  await press("Controlled flag")
  expect(screen.getByTestId("toggle-controlled").props.accessibilityState.checked).toBe(true)
  expect(screen.getByText("Flag on")).toHaveStyle({ color: "#ffffff" })
  await press("Next toggle order")
  await press("Next toggle geometry")
  await press("Toggle explicit toggle color")
  expect(screen.getByTestId("toggle-controlled")).toHaveStyle({ backgroundColor: "#2f7d18" })
  await press("Toggle toggle styles")
  expect(screen.getByTestId("toggle-controlled")).toHaveStyle({ marginTop: 5, marginBottom: 10 })
  expect(screen.getByText("Flag on")).toHaveStyle({ color: "#2f7d18" })
  await press("Controlled flag")
  expect(screen.getByText("Flag off")).toHaveStyle({ color: "#b73434" })
  await press("Toggle zero toggle dimensions")
  expect(screen.getByTestId("toggle-controlled")).toHaveStyle({ width: 0, height: 0 })
})
