import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import type { ComponentType } from "react"
import { Dimensions } from "react-native"

const { App } = jest.requireActual<{ App: ComponentType }>(
  "../../../../../planning/component-library/fixtures/native-query-delivery/App",
)

jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual("react-native")
  return { SafeAreaProvider: View, SafeAreaView: View }
})
beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())
const press = async (name: string) => userEvent.setup().press(screen.getByRole("button", { name }))
const state = () => JSON.parse(screen.getByTestId("diag-field-option-string:status").props.accessibilityLabel.slice(4))
const open = async () => {
  await press("Choose")
  await fireEvent(screen.getByTestId("diag-field-window"), "show")
}
const close = async () => {
  const dismissed = screen.getByTestId("diag-field-window").props.onDismiss as () => void
  await press("Close choices")
  await act(() => dismissed())
}

it("keeps the maintained public ComboBox editor, owner query and selection through deferred results and live window changes", async () => {
  await render(<App />)
  await press("Case combo")
  await open()
  const editor = screen.getByTestId("diag-field-input")
  await fireEvent.changeText(editor, "pending results")
  const originalNativeInput = state().input
  expect(originalNativeInput.instance).toBeGreaterThan(0)
  expect(state().query).toBe("pending results")
  expect(state().value).toBe(0)
  expect(state().requests).toMatchObject({ query: 1, selection: 0, closes: 0 })
  await act(() => jest.advanceTimersByTime(120))
  expect(screen.getByRole("radio", { name: "Result for pending results" })).toBeOnTheScreen()
  expect(screen.getByTestId("diag-field-input")).toBe(editor)
  expect(state().input).toEqual(originalNativeInput)
  expect(editor).toHaveDisplayValue("pending results")
  const window = Dimensions.get("window")
  try {
    await act(() => Dimensions.set({ window: { ...window, width: 844, height: 390, fontScale: 2 } }))
    expect(screen.getByTestId("diag-field-input")).toBe(editor)
    expect(state().input).toEqual(originalNativeInput)
    expect(state()).toMatchObject({
      query: "pending results",
      value: 0,
      requests: { query: 1, selection: 0, closes: 0 },
    })
    await userEvent.setup().press(screen.getByRole("radio", { name: "Result for pending results" }))
    expect(screen.queryByTestId("diag-field-input")).toBeNull()
    await open()
    expect(state()).toMatchObject({
      query: "pending results",
      value: "remote",
      requests: { query: 1, selection: 1, closes: 1 },
    })
  } finally {
    await act(() => Dimensions.set({ window }))
  }
})

it("retains the maintained ComboBox owner across theme changes and restores its full state with normal diagnostic reset", async () => {
  await render(<App />)
  await press("Case combo")
  const root = screen.getByTestId("diag-field")
  await open()
  await fireEvent.changeText(screen.getByTestId("diag-field-input"), "kept owner")
  await act(() => jest.advanceTimersByTime(120))
  await close()
  await press("Toggle diagnostic theme")
  expect(screen.getByTestId("diag-field")).toBe(root)
  expect(screen.getByTestId("diag-theme")).toHaveTextContent("dark")
  await open()
  expect(state()).toMatchObject({
    query: "kept owner",
    value: 0,
    witness: { context: "caller-form", mode: "dark" },
    requests: { query: 1, selection: 0, closes: 1 },
  })
  expect(screen.getByTestId("diag-field-input")).toHaveDisplayValue("kept owner")
  await close()
  await press("Reset query diagnostic")
  expect(screen.getByTestId("diag-configuration")).toHaveTextContent("Query delivery diagnostic")
  expect(screen.getByTestId("diag-theme")).toHaveTextContent("light")
  expect(screen.queryByTestId("diag-field")).toBeNull()
  await press("Case combo")
  expect(screen.getByTestId("diag-field")).not.toBe(root)
  await open()
  expect(state()).toMatchObject({
    query: "",
    value: 0,
    witness: { context: "caller-form", mode: "light" },
    requests: { query: 0, selection: 0, opens: 1, closes: 0 },
  })
  expect(screen.getByTestId("diag-field-input")).toHaveDisplayValue("")
})
