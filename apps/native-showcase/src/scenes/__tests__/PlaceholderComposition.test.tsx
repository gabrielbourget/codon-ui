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

it("exposes independent registered placeholder custom/final layers without changing its action or empty/reset semantics", async () => {
  await render(
    <SafeAreaInsetsContext.Provider value={{ top: 20, bottom: 10, left: 0, right: 0 }}>
      <NativeShowcase />
    </SafeAreaInsetsContext.Provider>,
  )
  const press = async (name: string) => {
    await fireEvent.press(screen.getByRole("button", { name }))
    await act(() => jest.advanceTimersByTime(250))
  }
  await press("Text/Button scene")
  const original = screen.getByTestId("library-placeholder")
  await fireEvent(original, "press", { nativeEvent: { target: 17, timestamp: 100 } })
  await press("Toggle placeholder custom styles")
  expect(original).toHaveStyle({ color: "#a66b00", fontSize: 18, padding: 2, paddingVertical: 4, fontStyle: "italic" })
  await press("Toggle placeholder final styles")
  expect(original).toHaveStyle({ color: "#7e22ce", fontSize: 22, padding: 2, paddingVertical: 4 })
  await press("Toggle placeholder alignment")
  await press("Dark theme")
  expect(original).toHaveStyle({ color: "#7e22ce", fontSize: 22, textAlign: "center" })
  await press("Toggle placeholder final styles")
  expect(original).toHaveStyle({ color: "#a66b00", fontSize: 18 })
  await press("Toggle placeholder custom styles")
  expect(original).toHaveStyle({ color: "#878787", textAlign: "center", fontStyle: "italic" })
  await press("Toggle empty placeholder")
  expect(original).toHaveTextContent(/^$/)
  expect(screen.getByTestId("library-placeholder")).toBe(original)
  expect(screen.getByTestId("library-state")).toHaveTextContent(/Library action count: 1/)
  await press("Reset scene")
  await press("Text/Button scene")
  expect(screen.getByTestId("placeholder-customization-state")).toHaveTextContent(
    "Placeholder custom: false. Final: false.",
  )
  expect(screen.getByTestId("library-state")).toHaveTextContent(/Library action count: 0/)
})
