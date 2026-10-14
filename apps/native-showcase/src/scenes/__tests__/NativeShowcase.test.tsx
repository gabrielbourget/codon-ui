import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
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

it("composes basic controls, mixed/group selection, text entry and blocked changes", async () => {
  const user = userEvent.setup()
  await renderShowcase()
  const press = async (name: string) => user.press(screen.getByRole("button", { name }))
  await press("Basic controls scene")
  await user.press(screen.getByRole("switch", { name: "Controlled switch" }))
  await user.press(screen.getByRole("checkbox", { name: "Controlled checkbox" }))
  await user.press(screen.getByRole("checkbox", { name: "Group first" }))
  await user.press(screen.getByRole("checkbox", { name: "Group second" }))
  await user.type(screen.getByTestId("basic-input"), "Bonjour", { skipBlur: true })
  await fireEvent(screen.getByTestId("basic-input"), "submitEditing", { nativeEvent: { text: "Bonjour" } })
  expect(screen.getByTestId("basic-control-state")).toHaveTextContent(
    /Switch: on.*Checkbox: on.*Group: first,second.*Input: Bonjour.*Submits: 1/,
  )
  await press("Toggle mixed display")
  expect(screen.getByRole("checkbox", { name: "Controlled checkbox" }).props.accessibilityState.checked).toBe("mixed")
  await press("Toggle controls disabled")
  await user.press(screen.getByRole("switch", { name: "Controlled switch" }))
  await user.press(screen.getByRole("checkbox", { name: "Group first" }))
  await fireEvent.changeText(screen.getByTestId("basic-input"), "Changed")
  expect(screen.getByTestId("basic-control-state")).toHaveTextContent(
    /Switch: on.*Group: first,second.*Input: Bonjour.*State: disabled/,
  )
  await press("Toggle controls disabled")
  await press("Toggle controls read-only")
  await user.press(screen.getByRole("checkbox", { name: "Controlled checkbox" }))
  await fireEvent.changeText(screen.getByTestId("basic-input"), "Changed")
  expect(screen.getByTestId("basic-control-state")).toHaveTextContent(/Checkbox: on.*Input: Bonjour.*State: read-only/)
})

it("preserves basic-control state across themes, fixtures and live dimensions and resets it explicitly", async () => {
  const previous = { window: Dimensions.get("window"), screen: Dimensions.get("screen") }
  const user = userEvent.setup()
  await renderShowcase()
  const press = async (name: string) => user.press(screen.getByRole("button", { name }))
  await press("Basic controls scene")
  await user.press(screen.getByRole("switch", { name: "Uncontrolled switch" }))
  await user.press(screen.getByRole("checkbox", { name: "Group first" }))
  await press("Toggle control styles")
  await press("Next control order")
  await press("Next control geometry")
  await press("Dark theme")
  await press("Vertical blocked region")
  expect(screen.getByTestId("basic-switch-track", { includeHiddenElements: true })).toHaveStyle({
    width: 60,
    height: 24,
    backgroundColor: "#123456",
  })
  expect(screen.getByTestId("basic-control-state")).toHaveTextContent(/Group: first/)
  expect(screen.getByText(/Order: secondary.*Geometry: round.*Uncontrolled switch: on/)).toBeOnTheScreen()
  try {
    await act(async () =>
      Dimensions.set({ window: { width: 844, height: 390, scale: 3, fontScale: 2 }, screen: previous.screen }),
    )
    expect(screen.getByTestId("basic-control-state")).toHaveTextContent(/Group: first/)
    await press("Reset scene")
    await press("Basic controls scene")
    expect(screen.getByTestId("basic-control-state")).toHaveTextContent(
      /Switch: off.*Checkbox: off.*Group: none.*Input: empty.*Submits: 0.*State: enabled.*Mixed: no/,
    )
    expect(screen.getByRole("switch", { name: "Uncontrolled switch" }).props.accessibilityState.checked).toBe(false)
  } finally {
    await act(async () => Dimensions.set(previous))
  }
})

it("uses native submitted text when the final edit precedes a rendered controlled value", async () => {
  await renderShowcase()
  await userEvent.setup().press(screen.getByRole("button", { name: "Basic controls scene" }))
  await fireEvent.changeText(screen.getByTestId("basic-input"), "B")
  await fireEvent(screen.getByTestId("basic-input"), "submitEditing", { nativeEvent: { text: "Bonjour" } })
  expect(screen.getByTestId("basic-input")).toHaveDisplayValue("Bonjour")
  expect(screen.getByTestId("basic-control-state")).toHaveTextContent(/Input: Bonjour.*Submits: 1/)
  const user = userEvent.setup()
  await user.press(screen.getByRole("button", { name: "Compare core input" }))
  expect(screen.getByTestId("basic-input")).toHaveDisplayValue("Bonjour")
  await fireEvent.changeText(screen.getByTestId("basic-input"), "Salut")
  await user.press(screen.getByRole("button", { name: "Compare core input" }))
  expect(screen.getByTestId("basic-input")).toHaveDisplayValue("Salut")
  expect(screen.getByTestId("basic-control-state")).toHaveTextContent(/Input: Salut.*Submits: 1/)
})
