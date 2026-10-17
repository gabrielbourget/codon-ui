import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import { Dimensions } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"

import { NativeShowcase } from "../NativeShowcase"

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())
const enter = async () => {
  await render(
    <SafeAreaInsetsContext.Provider value={{ top: 20, bottom: 10, left: 0, right: 0 }}>
      <NativeShowcase />
    </SafeAreaInsetsContext.Provider>,
  )
  const user = userEvent.setup()
  const press = async (name: string) => user.press(screen.getByRole("button", { name }))
  await press("Thumbnail scene")
  return press
}
const image = () => screen.getByTestId("thumbnail-example")
const load = async (width = 48, height = 24) =>
  fireEvent(image(), "load", { nativeEvent: { source: { width, height, uri: image().props.src } } })
const fail = async () => fireEvent(image(), "error", { nativeEvent: { error: "fixture decode failure" } })

it("retains fallback progress and caller values through equivalent lists, theme/window/fixture changes and reset", async () => {
  const press = await enter()
  const failedURI = image().props.src
  await fail()
  const successfulURI = image().props.src
  expect(successfulURI).not.toBe(failedURI)
  await load()
  await fireEvent(image(), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 48, height: 24 } } })
  expect(screen.getByTestId("thumbnail-state")).toHaveTextContent(
    /Errors: 1\. Loads: 1\. Last load: 48 x 24.*Frame: 48 x 24/,
  )
  await press("Toggle equivalent thumbnail candidates")
  await press("Dark theme")
  await press("Vertical blocked region")
  await act(() =>
    Dimensions.set({
      window: { width: 844, height: 390, scale: 1, fontScale: 1 },
      screen: { width: 844, height: 390, scale: 1, fontScale: 1 },
    }),
  )
  expect(image().props.src).toBe(successfulURI)
  expect(screen.getByTestId("thumbnail-state")).toHaveTextContent(/Errors: 1\. Loads: 1/)
  await press("Toggle thumbnail zero size")
  expect(image()).toHaveStyle({ width: 0, height: 0 })
  await press("Reset scene")
  await press("Thumbnail scene")
  expect(image().props.src).toBe(failedURI)
  expect(screen.getByTestId("thumbnail-state")).toHaveTextContent(/Zero size: false\. Errors: 0\. Loads: 0/)
})

it("exhausts failed candidates, preserves explicit zero fallback and starts new source contents immediately", async () => {
  const press = await enter()
  await press("Next thumbnail sources")
  await fail()
  await fail()
  expect(screen.getByTestId("thumbnail-fallback")).toBeOnTheScreen()
  await press("Toggle zero thumbnail fallback")
  expect(screen.getByText("0")).toBeOnTheScreen()
  expect(screen.queryByTestId("thumbnail-example")).toBeNull()
  await press("Next thumbnail sources")
  expect(screen.getByText("0")).toBeOnTheScreen()
  await press("Next thumbnail sources")
  expect(image().props.src).toBeTruthy()
  await load(32, 32)
  expect(screen.getByTestId("thumbnail-state")).toHaveTextContent(
    /Sources: square.*Errors: 2\. Loads: 1\. Last load: 32 x 32/,
  )
})

it("exercises native/adapter style and alt ownership, zero geometry receipts and deliberate lifetime restart", async () => {
  const press = await enter()
  await fail()
  await load()
  await press("Toggle thumbnail styles")
  expect(image()).toHaveStyle({ width: 120, height: 80, borderWidth: 2, resizeMode: "contain" })
  await press("Toggle thumbnail width constraint")
  expect(image()).toHaveStyle({ width: 140, aspectRatio: 2 })
  await press("Toggle thumbnail renderer")
  expect(image()).toHaveStyle({ width: 140, height: "auto" })
  await press("Toggle empty thumbnail alt")
  expect(image().props.accessibilityLabel).toBe("")
  expect(image().props.accessible).toBe(false)
  await press("Toggle thumbnail zero size")
  expect(image()).toHaveStyle({ width: 0, height: 0 })
  await fireEvent(image(), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 0, height: 0 } } })
  expect(screen.getByTestId("thumbnail-state")).toHaveTextContent(/Frame: 0 x 0/)
  await press("Restart thumbnail lifetime")
  expect(screen.getByTestId("thumbnail-state")).toHaveTextContent(/Lifetime: 1/)
  expect(image().props.src).toBe("data:image/png;base64,AA==")
})
