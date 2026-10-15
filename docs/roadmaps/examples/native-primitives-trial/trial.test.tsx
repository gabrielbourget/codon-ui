import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import React from "react"

import { App } from "./App"

jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual("react-native")
  return { SafeAreaProvider: View, SafeAreaView: View }
})
jest.setTimeout(15000)
let mockWindowMode = false
beforeEach(() => {
  mockWindowMode = false
  jest.useFakeTimers()
})
afterEach(() => jest.useRealTimers())

const press = async (name: string) => {
  const user = userEvent.setup()
  const target = screen.getByRole("button", { name, includeHiddenElements: mockWindowMode })
  if (mockWindowMode) await act(() => target.props.onClick({ nativeEvent: {}, stopPropagation: () => undefined }))
  else await user.press(target)
  if (name === "Toggle host arrangement") mockWindowMode = !mockWindowMode
}
const show = async (identity: string) => {
  const window = screen.getByTestId(`${identity}-core-window`, { includeHiddenElements: true })
  await fireEvent(window, "show")
  return window.props.onDismiss as () => void
}

it("keeps zero and string-zero controlled values distinct through the native-window Select", async () => {
  await render(<App />)
  await press("Toggle host arrangement")
  await press("Open trial parent")
  await show("trial-parent")
  expect(screen.getByTestId("trial-parent-context")).toHaveTextContent(/Context: caller-local/)
  await press("Open trial selection")
  const dismissSelection1 = await show("trial-select")
  await act(() =>
    screen
      .getByTestId("option-s:0", { includeHiddenElements: true })
      .props.onClick({ nativeEvent: {}, stopPropagation: () => undefined }),
  )
  await act(() => dismissSelection1())
  expect(screen.getByTestId("selected-value", { includeHiddenElements: mockWindowMode })).toHaveTextContent(
    "Selection: string:0",
  )
  await press("Open trial selection")
  const dismissSelection2 = await show("trial-select")
  await act(() =>
    screen
      .getByTestId("option-n:0", { includeHiddenElements: true })
      .props.onClick({ nativeEvent: {}, stopPropagation: () => undefined }),
  )
  await act(() => dismissSelection2())
  expect(screen.getByTestId("selected-value", { includeHiddenElements: mockWindowMode })).toHaveTextContent(
    "Selection: number:0",
  )
})

it("preserves an explicitly empty controlled value when the parent rejects selection", async () => {
  await render(<App />)
  await press("Clear controlled value")
  await press("Toggle rejected values")
  await press("Toggle host arrangement")
  await press("Open trial parent")
  await show("trial-parent")
  await press("Open trial selection")
  const dismissSelection1 = await show("trial-select")
  await act(() =>
    screen
      .getByTestId("option-s:0", { includeHiddenElements: true })
      .props.onClick({ nativeEvent: {}, stopPropagation: () => undefined }),
  )
  await act(() => dismissSelection1())
  expect(screen.getByTestId("selected-value", { includeHiddenElements: mockWindowMode })).toHaveTextContent(
    "Selection: empty",
  )
  await press("Open trial selection")
  const dismissSelection2 = await show("trial-select")
  await act(() =>
    screen
      .getByTestId("option-n:0", { includeHiddenElements: true })
      .props.onClick({ nativeEvent: {}, stopPropagation: () => undefined }),
  )
  await act(() => dismissSelection2())
  expect(screen.getByTestId("selected-value", { includeHiddenElements: mockWindowMode })).toHaveTextContent(
    "Selection: empty",
  )
})

it("does not activate disabled selection rows or a disabled trigger", async () => {
  await render(<App />)
  await press("Toggle host arrangement")
  await press("Open trial parent")
  await show("trial-parent")
  await press("Toggle selection disabled")
  await press("Open trial selection")
  expect(screen.queryByTestId("trial-select")).toBeNull()
  await press("Toggle selection disabled")
  await press("Open trial selection")
  const dismissSelection1 = await show("trial-select")
  await act(() =>
    screen
      .getByTestId("option-n:7", { includeHiddenElements: true })
      .props.onClick({ nativeEvent: {}, stopPropagation: () => undefined }),
  )
  expect(screen.getByTestId("selection-requests", { includeHiddenElements: mockWindowMode })).toHaveTextContent(
    "Selection requests: 0",
  )
  await press("Close trial selection")
  await act(() => dismissSelection1())
})

it("keeps parent-local state and theme updates through a portal child and reports caller-context loss", async () => {
  await render(<App />)
  await press("Open trial parent")
  await press("Increment local counter")
  await press("Open trial child")
  expect(screen.getByTestId("trial-child-context", { includeHiddenElements: mockWindowMode })).toHaveTextContent(
    /Context: host-context/,
  )
  await press("Close trial-child")
  expect(screen.getByTestId("local-counter", { includeHiddenElements: mockWindowMode })).toHaveTextContent(
    "Local count: 1",
  )
  await press("Toggle overlay theme")
  expect(screen.getByTestId("trial-parent-context")).toHaveTextContent(/theme: dark/)
  await press("Close trial-parent")
  await press("Open trial parent")
  expect(screen.getByTestId("local-counter", { includeHiddenElements: mockWindowMode })).toHaveTextContent(
    "Local count: 0",
  )
})

it("retains caller-local context in the existing native-window host", async () => {
  await render(<App />)
  await press("Toggle host arrangement")
  await press("Open trial parent")
  await show("trial-parent")
  expect(screen.getByTestId("trial-parent-context")).toHaveTextContent(/Context: caller-local/)
  await press("Increment local counter")
  await press("Open trial child")
  const dismissChild = await show("trial-child")
  expect(screen.getByTestId("trial-child-context", { includeHiddenElements: mockWindowMode })).toHaveTextContent(
    /Context: caller-local/,
  )
  await press("Close trial-child")
  await act(() => dismissChild())
  expect(screen.getByTestId("local-counter", { includeHiddenElements: mockWindowMode })).toHaveTextContent(
    "Local count: 1",
  )
})

it("runs the Alert action before closure even with system dismissal blocked", async () => {
  await render(<App />)
  await press("Toggle system guard")
  await press("Open trial parent")
  await press("Open trial alert")
  await press("Confirm trial confirmation")
  expect(screen.queryByTestId("trial-alert")).toBeNull()
  expect(screen.getByTestId("parent-state")).toHaveTextContent(/confirms: 1/)
  await press("Open trial alert")
  await press("Cancel trial confirmation")
  await press("Close trial-parent")
  expect(screen.getByTestId("trial-state")).toHaveTextContent(/Confirms: 1; cancels: 1/)
})

it("allows repeated parent closure rejection without mutating controlled visibility", async () => {
  await render(<App />)
  await press("Toggle rejected closure")
  await press("Open trial parent")
  await press("Close trial-parent")
  await press("Close trial-parent")
  expect(screen.getByTestId("trial-parent")).toBeTruthy()
  await press("Toggle parent close rejection")
  await press("Close trial-parent")
  expect(screen.getByTestId("trial-state")).toHaveTextContent(/requests: 3/)
})
