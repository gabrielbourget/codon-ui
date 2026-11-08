import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { Dimensions, StyleSheet } from "react-native"
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

it("preflights the installed Placeholder batch setup/reset and every authored typography and edge input", async () => {
  await render(
    <SafeAreaInsetsContext.Provider value={{ top: 20, bottom: 10, left: 0, right: 0 }}>
      <NativeShowcase />
    </SafeAreaInsetsContext.Provider>,
  )
  const press = async (name: string) => {
    await fireEvent.press(screen.getByRole("button", { name }))
    await act(() => jest.advanceTimersByTime(400))
  }
  await press("Reset scene")
  await press("Live window")
  await press("Light theme")
  expect(screen.queryByTestId("library-placeholder")).toBeNull()
  await press("Text/Button scene")
  await press("G02 prepare placeholder")
  const original = screen.getByTestId("library-placeholder")
  const check = (color: string, fontSize: number, padding: number, vertical: number, align: string) => {
    const value = StyleSheet.flatten(original.props.style)
    expect(value).toMatchObject({ color, fontSize, fontStyle: "italic", fontWeight: "400", textAlign: align })
    expect(value.padding ?? 0).toBe(padding)
    expect(value.paddingVertical ?? value.padding ?? 0).toBe(vertical)
    expect(original.props.allowFontScaling).not.toBe(false)
  }
  check("#707070", 12, 0, 0, "left")
  await press("Toggle placeholder alignment")
  check("#707070", 12, 0, 0, "center")
  await press("Toggle placeholder custom styles")
  check("#a66b00", 18, 2, 4, "center")
  await press("Toggle placeholder final styles")
  check("#7e22ce", 22, 2, 4, "center")
  await press("Dark theme")
  check("#7e22ce", 22, 2, 4, "center")
  await press("Toggle placeholder final styles")
  check("#a66b00", 18, 2, 4, "center")
  await press("Toggle placeholder custom styles")
  check("#878787", 12, 0, 0, "center")
  await press("Light theme")
  check("#707070", 12, 0, 0, "center")
  expect(screen.getByTestId("library-placeholder")).toBe(original)
  await press("Reset scene")
  expect(screen.queryByTestId("library-placeholder")).toBeNull()
  await press("Text/Button scene")
  await press("G02 prepare placeholder")
  expect(screen.getByTestId("library-placeholder")).toHaveTextContent("Choose an item")
})
