import { act, render, screen, userEvent } from "@testing-library/react-native"
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
  await press("Text/Button scene")
  return press
}

it("closes only the caller preview and retains its count through theme/layout changes until reset", async () => {
  const press = await enter()
  await press("Close Carousel")
  expect(screen.queryByTestId("carousel-close-preview")).toBeNull()
  expect(screen.getByTestId("carousel-close-receipt")).toHaveTextContent("Close preview: closed. Close actions: 1.")
  expect(screen.getByTestId("library-state")).toHaveTextContent(/Library action count: 0/)
  await press("Dark theme")
  await press("Compact width")
  const window = Dimensions.get("window")
  try {
    await act(() => Dimensions.set({ window: { ...window, width: 800, height: 400, fontScale: 2 } }))
    expect(screen.queryByTestId("carousel-close-preview")).toBeNull()
    expect(screen.getByTestId("carousel-close-receipt")).toHaveTextContent(/Close actions: 1/)
    await press("Restore close preview")
    await press("Close Carousel")
    expect(screen.getByTestId("carousel-close-receipt")).toHaveTextContent(/Close actions: 2/)
    await press("Reset scene")
    await press("Text/Button scene")
    expect(screen.getByTestId("carousel-close-preview")).toBeOnTheScreen()
    expect(screen.getByTestId("carousel-close-receipt")).toHaveTextContent(/open\. Close actions: 0/)
  } finally {
    await act(() => Dimensions.set({ window }))
  }
})

it("uses the scene's actual disabled/pending guards and custom style owner", async () => {
  const press = await enter()
  await press("Toggle library disabled")
  expect(screen.getByRole("button", { name: "Close Carousel" })).toBeDisabled()
  await press("Close Carousel")
  expect(screen.getByTestId("carousel-close-receipt")).toHaveTextContent(/open\. Close actions: 0/)
  await press("Toggle library disabled")
  await press("Toggle library pending")
  expect(screen.getByRole("button", { name: "Close Carousel" }).props.accessibilityState.busy).toBe(true)
  await press("Close Carousel")
  expect(screen.getByTestId("carousel-close-receipt")).toHaveTextContent(/open\. Close actions: 0/)
  await press("Toggle library pending")
  await press("Toggle library styles")
  expect(screen.getByRole("button", { name: "Close Carousel" })).toHaveStyle({
    padding: 10,
    borderWidth: 2,
    borderColor: "#087f8c",
  })
  await press("Close Carousel")
  expect(screen.getByTestId("carousel-close-receipt")).toHaveTextContent(/closed\. Close actions: 1/)
})
