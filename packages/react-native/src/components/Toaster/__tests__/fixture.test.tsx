import { act, cleanup, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import * as RN from "react-native"

import { ToasterObserver } from "../stateManagement"

import { ToasterInteractionFixture } from "./fixtures/ToasterInteractionFixture"

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: jest.requireActual("react-native").View,
  SafeAreaView: jest.requireActual("react-native").View,
  SafeAreaInsetsContext: jest.requireActual("react").createContext(null),
  initialWindowMetrics: null,
}))
const row = (id: string) => screen.getByTestId(id, { includeHiddenElements: true })
const press = (name: string) => userEvent.setup().press(screen.getByRole("button", { name }))
beforeEach(() => {
  jest.useFakeTimers()
  Object.defineProperty(RN.AppState, "currentState", { configurable: true, get: () => "active" })
  jest.spyOn(RN.AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(async () => {
  await cleanup()
  ToasterObserver.dismiss()
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})

it("SCENE.toaster.001 publishes original typed aliases and updates the same ID without a duplicate", async () => {
  await render(<ToasterInteractionFixture />)
  await press("Publish notification")
  await press("Cycle typed ID")
  await press("Publish notification")
  await press("Cycle typed ID")
  await press("Publish notification")
  expect(row("toast-number-0")).toBeOnTheScreen()
  expect(row("toast-string-0")).toBeOnTheScreen()
  expect(row("toast-string-")).toBeOnTheScreen()
  await press("Update current ID")
  expect(screen.getAllByTestId(/^toast-(number|string)-/, { includeHiddenElements: true })).toHaveLength(3)
  expect(screen.getByText('Updated string:"" 4')).toBeOnTheScreen()
  expect(row("toaster-fixture-events")).toHaveTextContent(/update:string:""/)
})
it("SCENE.toaster.002 composes independent root labels, per-toast labels, theme and custom slots", async () => {
  await render(<ToasterInteractionFixture />)
  await press("Toggle localized labels")
  await press("Toggle custom slots")
  await press("Toggle theme")
  await press("Publish notification")
  expect(row("toaster").props.accessibilityLabel).toBe("Notifications localisées - alt+E")
  expect(row("toaster").props.nativeLabelledBy).toEqual(["toaster-fixture-heading"])
  expect(row("toaster").props.nativeDescribedBy).toEqual(["toaster-fixture-description"])
  expect(row("fixture-toast-body-number:0")).toHaveStyle({ color: "#a66b00" })
  expect(row("toast-number-0")).toHaveStyle({ backgroundColor: "#171717", borderWidth: 1 })
  expect(screen.getByRole("button", { name: "Confirmer action" })).toHaveTextContent("Valider")
  expect(screen.getByRole("button", { name: "Fermer" })).toBeOnTheScreen()
})
it("SCENE.toaster.003 retains zero duration and false importance with auto-close alone", async () => {
  await render(<ToasterInteractionFixture />)
  await press("Toggle zero duration")
  await press("Publish notification")
  await act(() => jest.advanceTimersByTime(0))
  expect(row("toaster-fixture-events")).toHaveTextContent(/auto:number:0/)
  expect(row("toaster-fixture-events")).not.toHaveTextContent(/dismiss:/)
  await act(() => jest.advanceTimersByTime(250))
  expect(screen.queryByTestId("toast-number-0")).toBeNull()
})
it("SCENE.toaster.004 preserves action then dismissal callback order and original current payload", async () => {
  await render(<ToasterInteractionFixture />)
  await press("Publish notification")
  await press("Update current ID")
  await press("Confirm Action")
  expect(row("toaster-fixture-events")).toHaveTextContent(/confirm:number:0\s+dismiss:number:0:Owned payload 2/)
  await act(() => jest.advanceTimersByTime(250))
  expect(screen.queryByTestId("toast-number-0")).toBeNull()
})
it("SCENE.toaster.005 exercises visible limits, zero gap, moved groups and programmatic dismissal", async () => {
  await render(<ToasterInteractionFixture />)
  await press("Publish notification")
  await press("Cycle typed ID")
  await press("Publish notification")
  await press("Cycle visible limit")
  expect(row("toast-number-0").props.pointerEvents).toBe("none")
  expect(row("toast-string-0").props.pointerEvents).toBe("auto")
  await press("Cycle visible limit")
  expect(row("toast-string-0").props.pointerEvents).toBe("none")
  await press("Toggle zero gap")
  await press("Cycle position")
  expect(row("toaster-fixture-state")).toHaveTextContent(/Position bottom-right\. Limit 0\. Gap 0\./)
  expect(row("toaster-stack-bottom-right")).toBeOnTheScreen()
  await press("Dismiss all notifications")
  await act(() => jest.advanceTimersByTime(250))
  expect(screen.queryByTestId("toaster")).toBeNull()
  expect(row("toaster-fixture-events")).toHaveTextContent(/programmatic:all/)
})
it("SCENE.toaster.006 observes the real host layout and keeps an explicitly empty title", async () => {
  await render(<ToasterInteractionFixture />)
  await fireEvent(row("toaster-fixture-host"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } },
  })
  expect(row("toaster-fixture-state")).toHaveTextContent(/Frame 390x844/)
  await press("Toggle empty title")
  await press("Publish notification")
  expect(screen.queryByText("Notice number:0 1")).toBeNull()
  expect(row("toast-number-0").props.accessibilityLiveRegion).toBe("polite")
  expect(row("toaster-fixture-events")).toHaveTextContent(/publish:number:0/)
})
