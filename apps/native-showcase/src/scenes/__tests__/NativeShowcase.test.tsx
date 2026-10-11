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
