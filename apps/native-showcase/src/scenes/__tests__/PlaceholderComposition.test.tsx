import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { Dimensions } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"

import { NativeShowcase } from "../NativeShowcase"

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

it("retains the public placeholder and owner count through alignment, empty content and live showcase changes, then resets", async () => {
  await render(
    <SafeAreaInsetsContext.Provider value={{ top: 20, bottom: 10, left: 0, right: 0 }}>
      <NativeShowcase />
    </SafeAreaInsetsContext.Provider>,
  )
  const press = async (name: string) => fireEvent.press(screen.getByRole("button", { name }))
  await press("Text/Button scene")
  const placeholder = screen.getByTestId("library-placeholder")
  expect(placeholder).toHaveTextContent("Choose an item")
  expect(placeholder).toHaveStyle({ textAlign: "left", fontStyle: "italic", color: "#707070" })
  await fireEvent(placeholder, "press", { nativeEvent: { target: 17, timestamp: 100 } })
  await press("Toggle placeholder alignment")
  await press("Toggle empty placeholder")
  await press("Dark theme")
  expect(placeholder).toHaveStyle({ color: "#707070" })
  await act(async () => jest.advanceTimersByTime(250))
  await press("Compact width")
  const window = Dimensions.get("window")
  try {
    await act(() => Dimensions.set({ window: { ...window, width: 844, height: 390, fontScale: 2 } }))
    expect(screen.getByTestId("library-placeholder")).toBe(placeholder)
    expect(placeholder).toHaveTextContent(/^$/)
    expect(placeholder).toHaveStyle({ textAlign: "center", fontStyle: "italic", color: "#878787" })
    expect(screen.getByTestId("library-state")).toHaveTextContent(/Library action count: 1/)
    await press("Toggle empty placeholder")
    expect(placeholder).toHaveTextContent("Choose an item")
    expect(screen.getByTestId("library-state")).toHaveTextContent(/Library action count: 1/)
    await press("Reset scene")
    expect(screen.queryByTestId("library-placeholder")).toBeNull()
    await press("Text/Button scene")
    expect(screen.getByTestId("library-placeholder")).toHaveTextContent("Choose an item")
    expect(screen.getByTestId("library-placeholder")).toHaveStyle({ textAlign: "left", color: "#707070" })
    expect(screen.getByTestId("library-state")).toHaveTextContent(/Library action count: 0/)
  } finally {
    await act(() => Dimensions.set({ window }))
  }
})
