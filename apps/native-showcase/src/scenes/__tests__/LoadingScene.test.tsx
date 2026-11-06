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

it("keeps fractional ring, independent root, real layout state and removal controls in the maintained scene", async () => {
  const press = await enterLoadingScene()
  const state = () => JSON.parse(screen.getByTestId("loading-native-state").props.accessibilityLabel)
  await press("Toggle stopped motion")
  await press("Toggle fractional circle")
  expect(part("loading-circle-spinner")).toHaveStyle({ width: 33.25, height: 33.25 })
  await press("Toggle loader styles")
  expect(part("loading-circle")).toHaveStyle({ width: 72, height: 60 })
  expect(part("loading-circle-reference")).toHaveStyle({ width: 33.25, height: 33.25, borderTopColor: "#087f8c" })
  await act(() =>
    part("loading-circle").props.onLayout({
      target: 41,
      currentTarget: 41,
      nativeEvent: { layout: { x: 0, y: 0, width: 72, height: 60 } },
    }),
  )
  expect(state().layout).toEqual({
    eventTarget: 41,
    currentTarget: 41,
    nativeTarget: null,
    layout: { x: 0, y: 0, width: 72, height: 60 },
  })
  await press("Toggle circle presence")
  expect(screen.queryByTestId("loading-circle")).toBeNull()
  expect(state().visible).toBe(false)
  await press("Toggle circle presence")
  expect(part("loading-circle-spinner")).toHaveStyle({ width: 33.25 })
  expect(state()).toMatchObject({ visible: true, stopped: true, fractional: true, rootWidth: 72, rootHeight: 60 })
})

it("keeps LaggingLines fractional width, slide ownership, actual layout state and removal controls", async () => {
  const press = await enterLoadingScene()
  const state = () => JSON.parse(screen.getByTestId("loading-lines-native-state").props.accessibilityLabel)
  await press("Toggle stopped motion")
  await press("Toggle fractional lines")
  expect(part("loading-lines")).toHaveStyle({ width: 183.25, height: 50 })
  await press("Toggle loader styles")
  expect(part("loading-lines")).toHaveStyle({ height: 50, marginBottom: 10 })
  expect(part("loading-lines-slide-0")).toHaveStyle({ height: 7, borderRadius: 5, backgroundColor: "#a66b00" })
  await act(() =>
    part("loading-lines").props.onLayout({
      target: 51,
      currentTarget: 51,
      nativeEvent: { layout: { x: 5, y: 0, width: 183.25, height: 50 } },
    }),
  )
  expect(state().layout).toEqual({
    eventTarget: 51,
    currentTarget: 51,
    nativeTarget: null,
    layout: { x: 5, y: 0, width: 183.25, height: 50 },
  })
  await press("Toggle lines presence")
  expect(screen.queryByTestId("loading-lines")).toBeNull()
  expect(state().visible).toBe(false)
  await press("Toggle lines presence")
  expect(part("loading-lines")).toHaveStyle({ width: 183.25 })
  expect(screen.getByRole("button", { name: "Saving example action" })).toBeOnTheScreen()
  await press("Dark theme")
  expect(part("loading-lines-parent")).toHaveStyle({ backgroundColor: "#101010" })
  expect(part("loading-lines-reference-parent")).toHaveStyle({ backgroundColor: "#101010" })
  await press("Light theme")
  expect(part("loading-lines-parent")).toHaveStyle({ backgroundColor: "#ffffff" })
})
