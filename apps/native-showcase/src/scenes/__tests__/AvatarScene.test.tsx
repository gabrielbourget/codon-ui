import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import { Dimensions } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"

import { NativeShowcase } from "../NativeShowcase"

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

const graphic = (id: string) => screen.getByTestId(id, { includeHiddenElements: true })
const fallback = () => screen.queryByTestId("avatar-fallback", { includeHiddenElements: true })
const enterAvatarScene = async () => {
  await render(
    <SafeAreaInsetsContext.Provider value={{ top: 20, bottom: 10, left: 0, right: 0 }}>
      <NativeShowcase />
    </SafeAreaInsetsContext.Provider>,
  )
  const user = userEvent.setup()
  const press = async (name: string) => user.press(screen.getByRole("button", { name }))
  await press("Avatar scene")
  return press
}

it("retains host activations, false guards and zero size through theme/window/fixture changes and explicit reset", async () => {
  const press = await enterAvatarScene()
  await press("Alice Smith")
  expect(screen.getByTestId("avatar-state")).toHaveTextContent(/Activations: 1\./)
  await press("Toggle avatar disabled")
  await press("Alice Smith")
  expect(screen.getByTestId("avatar-state")).toHaveTextContent(/Activations: 1\./)
  await press("Toggle avatar activation")
  expect(screen.getByRole("img", { name: "Alice Smith" })).toBeOnTheScreen()
  await press("Toggle avatar zero size")
  await press("Dark theme")
  await press("Compact width")
  const window = Dimensions.get("window")
  try {
    await act(() => Dimensions.set({ window: { ...window, width: 800, height: 400, fontScale: 2 } }))
    expect(screen.getByTestId("avatar-example")).toHaveStyle({ width: 0, height: 0, backgroundColor: "#ffffff" })
    expect(screen.getByTestId("avatar-state")).toHaveTextContent(
      /Activations: 1\. Names: 0\. Size: 0.*Passive\. Disabled\./,
    )
    await press("Toggle avatar disabled")
    await press("Toggle avatar activation")
    await press("Next avatar name")
    expect(screen.getByRole("button", { name: "Alice" })).toBeOnTheScreen()
    await press("Reset scene")
    await press("Avatar scene")
    expect(screen.getByTestId("avatar-state")).toHaveTextContent(
      /Activations: 0\. Names: 0\. Size: 30.*Clickable\. Enabled\./,
    )
  } finally {
    await act(() => Dimensions.set({ window }))
  }
})

it("composes image success/error/replacement and a fresh delayed lifetime using the real public Avatar", async () => {
  const press = await enterAvatarScene()
  await press("Next avatar image")
  expect(graphic("avatar-image").props.source.uri).toMatch(/^data:image\/png;base64,/)
  expect(fallback()).not.toBeNull()
  await fireEvent(graphic("avatar-image"), "load", {})
  expect(fallback()).toBeNull()
  await press("Next avatar image")
  expect(fallback()).not.toBeNull()
  await fireEvent(graphic("avatar-image"), "error", { nativeEvent: { error: "invalid fixture" } })
  expect(fallback()).not.toBeNull()
  await press("Toggle avatar fallback delay")
  expect(fallback()).not.toBeNull()
  await press("Restart avatar lifetime")
  expect(fallback()).toBeNull()
  await act(() => jest.advanceTimersByTime(1000))
  expect(fallback()).not.toBeNull()
  await press("Next avatar image")
  expect(screen.queryByTestId("avatar-image", { includeHiddenElements: true })).toBeNull()
  expect(fallback()).not.toBeNull()
})

it("composes all geometries, names, explicit colors and four style owners", async () => {
  const press = await enterAvatarScene()
  await press("Next avatar geometry")
  expect(screen.getByTestId("avatar-example")).toHaveStyle({ borderRadius: 0 })
  await press("Next avatar geometry")
  await press("Next avatar size")
  await press("Toggle avatar raised")
  await press("Toggle avatar colors")
  await press("Toggle avatar styles")
  expect(screen.getByTestId("avatar-example")).toHaveStyle({
    width: 48,
    height: 48,
    borderRadius: 5,
    elevation: 2,
    opacity: 0.9,
    backgroundColor: "#b73434",
  })
  expect(graphic("avatar-fallback")).toHaveStyle({ backgroundColor: "#a66b00" })
  expect(graphic("avatar-initials")).toHaveStyle({ fontSize: 20, color: "#2f7d18" })
  await press("Next avatar image")
  await fireEvent(graphic("avatar-image"), "load", {})
  expect(graphic("avatar-image")).toHaveStyle({ opacity: 0.8, resizeMode: "cover" })
  for (let index = 0; index < 3; index++) await press("Next avatar name")
  expect(screen.getByRole("button", { name: "Anonymous Person" })).toBeOnTheScreen()
  await press("Next avatar image")
  expect(graphic("avatar-initials")).toHaveTextContent("AP")
})
