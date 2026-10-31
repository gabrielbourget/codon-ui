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

const part = (identity: string) => screen.getByTestId(identity, { includeHiddenElements: true })
const enterLoadingScene = async () => {
  await render(
    <SafeAreaInsetsContext.Provider value={{ top: 20, bottom: 10, left: 0, right: 0 }}>
      <NativeShowcase />
    </SafeAreaInsetsContext.Provider>,
  )
  const user = userEvent.setup()
  const press = async (name: string) => user.press(screen.getByRole("button", { name }))
  await press("Loading scene")
  return press
}

it("preserves stopped zero and authored state through live theme/window/fixture changes and resets explicitly", async () => {
  const press = await enterLoadingScene()
  expect(screen.getAllByRole("progressbar")).toHaveLength(2)
  expect(part("loading-circle-spinner")).toHaveStyle({ width: 25, borderTopColor: "#171717" })
  expect(part("loading-owned-circle-spinner")).toHaveStyle({ borderTopColor: "#ffffff" })
  await press("Toggle stopped motion")
  await press("Next loader duration")
  await press("Toggle loader styles")
  await press("Dark theme")
  await press("Compact width")
  const window = Dimensions.get("window")
  try {
    await act(() => Dimensions.set({ window: { ...window, width: 800, height: 400, fontScale: 2 } }))
    expect(screen.getByTestId("loading-state")).toHaveTextContent(/Duration: 0\..*Slide override: 0\./)
    expect(screen.getByRole("progressbar", { name: "Fetching lines" }).props.accessibilityState).toEqual({ busy: true })
    expect(part("loading-lines-slide-0")).toHaveStyle({ backgroundColor: "#a66b00", borderRadius: 5 })
    await press("Reset scene")
    await press("Loading scene")
    expect(screen.getByTestId("loading-state")).toHaveTextContent(/Duration: defaults\..*Slide override: none\./)
    expect(part("loading-circle-spinner")).toHaveStyle({ borderTopColor: "#171717" })
  } finally {
    await act(() => Dimensions.set({ window }))
  }
})

it("composes duration strings, percent and zero dimensions, track transparency and independent style slots", async () => {
  const press = await enterLoadingScene()
  await press("Next loader duration")
  await press("Next circle size")
  await press("Next line width")
  await press("Toggle loader colors")
  await press("Toggle transparent track")
  expect(screen.getByTestId("loading-state")).toHaveTextContent(/Duration: 0.45s\. Circle size: 40\. Line width: 100%/)
  expect(part("loading-circle-spinner")).toHaveStyle({
    width: 40,
    borderColor: "transparent",
    borderTopColor: "#2f7d18",
  })
  expect(screen.getByTestId("loading-lines")).toHaveStyle({ width: "100%", height: 50 })
  expect(part("loading-lines-slide-2")).toHaveStyle({ backgroundColor: "#2f7d18", height: 5 })
  await press("Toggle loader styles")
  expect(screen.getByTestId("loading-circle")).toHaveStyle({ marginTop: 5, opacity: 0.8 })
  expect(screen.getByTestId("loading-lines")).toHaveStyle({ height: 50, marginBottom: 10 })
  expect(part("loading-lines-slide-2")).toHaveStyle({ backgroundColor: "#a66b00", height: 7, borderRadius: 5 })
  await press("Toggle loader colors")
  expect(part("loading-circle-spinner")).toHaveStyle({ borderTopColor: "#087f8c" })
  await press("Next circle size")
  await press("Next line width")
  expect(part("loading-circle-spinner")).toHaveStyle({ width: 0, height: 0, borderWidth: 0 })
  expect(screen.getByTestId("loading-lines")).toHaveStyle({ width: 0 })
  await press("Toggle loader styles")
  await press("Toggle transparent track")
  expect(part("loading-circle-spinner")).toHaveStyle({ borderColor: "rgba(127, 127, 127, 0.22)" })
})
