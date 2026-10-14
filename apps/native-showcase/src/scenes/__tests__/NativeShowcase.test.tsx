import { act, render, screen, userEvent } from "@testing-library/react-native"
import { Dimensions } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"

import { NativeShowcase } from "../NativeShowcase"

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

const renderShowcase = async () =>
  render(
    <SafeAreaInsetsContext.Provider value={{ top: 20, bottom: 10, left: 0, right: 0 }}>
      <NativeShowcase />
    </SafeAreaInsetsContext.Provider>,
  )

it("composes public theme exports, fixture controls and reset without resetting actions on theme/layout changes", async () => {
  const user = userEvent.setup()
  await renderShowcase()
  await user.press(screen.getByRole("button", { name: "Increment scene action" }))
  await user.press(screen.getByRole("button", { name: "Dark theme" }))
  expect(screen.getByTestId("theme-preview")).toHaveTextContent("Active theme: dark. Action count: 1.")
  await user.press(screen.getByRole("button", { name: "Toggle customization" }))
  expect(screen.getByTestId("theme-preview")).toHaveStyle({ color: "#087f8c", fontSize: 18 })
  await user.press(screen.getByRole("button", { name: "Vertical blocked region" }))
  expect(screen.getByText("Simulated geometry; no hardware posture events.")).toBeOnTheScreen()
  expect(screen.getByTestId("theme-preview")).toHaveTextContent(/Action count: 1\./)
  await user.press(screen.getByRole("button", { name: "Reset scene" }))
  expect(screen.getByTestId("theme-preview")).toHaveTextContent("Active theme: light. Action count: 0.")
  expect(screen.getByTestId("theme-preview")).toHaveStyle({ color: "#171717", fontSize: 14 })
  expect(screen.queryByText("Simulated geometry; no hardware posture events.")).not.toBeOnTheScreen()
})

it("updates live window metadata while preserving scene state", async () => {
  const previous = { window: Dimensions.get("window"), screen: Dimensions.get("screen") }
  const user = userEvent.setup()
  await renderShowcase()
  await user.press(screen.getByRole("button", { name: "Increment scene action" }))
  try {
    await act(async () => {
      Dimensions.set({ window: { width: 900, height: 500, scale: 2, fontScale: 1.5 }, screen: previous.screen })
    })
    expect(screen.getByText(/Window 900 × 500 · font scale 1.5/)).toBeOnTheScreen()
    expect(screen.getByTestId("theme-preview")).toHaveTextContent(/Action count: 1\./)
  } finally {
    await act(async () => {
      Dimensions.set(previous)
    })
  }
})

it("composes library controls, blocks disabled/pending activation and resets scene defaults", async () => {
  const user = userEvent.setup()
  await renderShowcase()
  const press = async (name: string) => user.press(screen.getByRole("button", { name }))
  await press("Text/Button scene")
  await press("Library action")
  await press("Toggle library disabled")
  await press("Library action")
  expect(screen.getByTestId("library-state")).toHaveTextContent(/count: 1.*State: disabled/)
  await press("Toggle library disabled")
  await press("Toggle library pending")
  expect(screen.getByTestId("library-button").props.accessibilityState).toMatchObject({ busy: true, disabled: false })
  await press("Library action")
  expect(screen.getByTestId("library-state")).toHaveTextContent(/count: 1/)
  await press("Toggle library pending")
  await press("Next button order")
  await press("Toggle button outline")
  await press("Toggle library styles")
  await press("Toggle render children")
  expect(screen.getByText("Rendered library action 1")).toHaveStyle({ color: "#ffffff" })
  expect(screen.getByTestId("library-button")).toHaveStyle({ backgroundColor: "#123456" })
  await press("Dark theme")
  await press("Vertical blocked region")
  expect(screen.getByTestId("library-state")).toHaveTextContent(/count: 1.*secondary.*outline/)
  await press("Toggle constrained target")
  expect(screen.getByRole("button", { name: "Constrained library action" })).toHaveStyle({ width: 24, height: 24 })
  await press("Reset scene")
  expect(screen.getByTestId("theme-preview")).toHaveTextContent(/light.*count: 0/)
  await press("Text/Button scene")
  expect(screen.getByTestId("library-state")).toHaveTextContent(/count: 0.*primary.*fill.*enabled/)
  expect(screen.queryByText(/Rendered library action/)).toBeNull()
  expect(screen.queryByRole("button", { name: "Constrained library action" })).toBeNull()
})

it("renders mixed and callback phrases with valid shadow styles and stable activation labels", async () => {
  const user = userEvent.setup()
  await renderShowcase()
  const press = async (name: string) => user.press(screen.getByRole("button", { name }))
  await press("Text/Button scene")
  expect(screen.getByText("Library action 0")).toBeOnTheScreen()
  await press("Library action")
  expect(screen.getByText("Library action 1")).toBeOnTheScreen()
  await press("Toggle library styles")
  expect(screen.getByText("Library action 1")).toHaveStyle({ color: "#ffffff" })
  await press("Toggle render children")
  expect(screen.getByText("Rendered library action 1")).toHaveStyle({ color: "#ffffff" })
  await press("Library action")
  expect(screen.getByText("Rendered library action 2")).toBeOnTheScreen()
  expect(screen.getByTestId("library-state")).toHaveTextContent(/count: 2/)
})

it("retains library actions during live window changes", async () => {
  const previous = { window: Dimensions.get("window"), screen: Dimensions.get("screen") }
  const user = userEvent.setup()
  await renderShowcase()
  await user.press(screen.getByRole("button", { name: "Text/Button scene" }))
  await user.press(screen.getByRole("button", { name: "Library action" }))
  try {
    await act(async () =>
      Dimensions.set({ window: { width: 844, height: 390, scale: 3, fontScale: 2 }, screen: previous.screen }),
    )
    expect(screen.getByTestId("library-state")).toHaveTextContent(/count: 1/)
    expect(screen.getByText(/Window 844 × 390 · font scale 2/)).toBeOnTheScreen()
  } finally {
    await act(async () => Dimensions.set(previous))
  }
})
