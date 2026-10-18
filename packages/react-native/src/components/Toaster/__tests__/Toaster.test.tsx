import { act, cleanup, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import * as RN from "react-native"

import { NativeFloatingLayerHost, NativeThemeProvider } from "../../.."
import { Commands } from "../../../input/specs/CUIFocusViewNativeComponent"
import { toast, ToasterObserver } from "../stateManagement"
import { Toaster } from "../Toaster"
import { AVAILABLE_TOAST_POSITIONS, type TNativeExternalToast, type TNativeToasterProps } from "../types"

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: jest.requireActual("react-native").View,
  SafeAreaView: jest.requireActual("react-native").View,
  SafeAreaInsetsContext: jest.requireActual("react").createContext({ top: 10, bottom: 12, left: 0, right: 0 }),
}))
const row = (id: string) => screen.getByTestId(id, { includeHiddenElements: true })
const root = () => row("toaster")
const stack = () => row("toaster-stack-top-right")
const advance = async (time: number) => act(() => jest.advanceTimersByTime(time))
const publish = async (...toasts: TNativeExternalToast[]) =>
  act(() => {
    for (const payload of toasts) toast({ duration: "persistent", ...payload })
  })
const node = (props: TNativeToasterProps = {}) => (
  <NativeThemeProvider>
    <NativeFloatingLayerHost testID="host">
      <Toaster {...props} />
    </NativeFloatingLayerHost>
  </NativeThemeProvider>
)
beforeEach(() => {
  jest.useFakeTimers()
  Object.defineProperty(RN.AppState, "currentState", { configurable: true, get: () => "active" })
  jest.spyOn(RN.AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  jest.spyOn(Commands, "requestKeyboardFocus").mockImplementation(() => {})
})
afterEach(async () => {
  await cleanup()
  ToasterObserver.dismiss()
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})

it("CAP.toaster.002/.012 stays absent when empty, forwards the actual native ref and consumes root aliases", async () => {
  const ref = createRef<RN.View>()
  await render(
    <NativeThemeProvider>
      <NativeFloatingLayerHost>
        <Toaster
          ref={ref}
          accessibilityLabel=""
          ariaLabel="Alias"
          customRootStyles={{ marginTop: 5 }}
          style={{ marginBottom: 10 }}
          nativeID="notifications"
        />
      </NativeFloatingLayerHost>
    </NativeThemeProvider>,
  )
  expect(screen.queryByTestId("toaster")).toBeNull()
  await publish({ id: 0, titleText: "Original" })
  expect(root().props.accessibilityLabel).toBe(" - alt+E")
  expect(root().props.nativeID).toBe("notifications")
  expect(root()).toHaveStyle({ marginTop: 5, marginBottom: 10 })
  expect(typeof ref.current?.measureInWindow).toBe("function")
  expect(root().props.ariaLabel).toBeUndefined()
  expect(root().props.customRootStyles).toBeUndefined()
  expect(screen.getByText("Original")).toBeOnTheScreen()
})
it("CAP.toaster.003 root duration retires the rendered toast after its own deadline", async () => {
  await render(node({ duration: 10 }))
  await act(() => {
    toast({ id: "timed" })
  })
  await advance(9)
  expect(row("toast-string-timed").props.pointerEvents).toBe("auto")
  await advance(1)
  expect(row("toast-string-timed").props.pointerEvents).toBe("none")
  await advance(250)
  expect(screen.queryByTestId("toaster")).toBeNull()
})
it.each(AVAILABLE_TOAST_POSITIONS)("CAP.toaster.004 positions %s with safe-area offsets", async (position) => {
  await render(node({ position, offset: 30 }))
  await publish({ id: 0 })
  const [vertical, horizontal] = position.split("-")
  expect(row(`toaster-stack-${position}`)).toHaveStyle({ [vertical]: 30 })
  expect(row(`toaster-stack-${position}`)).toHaveStyle(horizontal === "center" ? { left: "50%" } : { [horizontal]: 30 })
})
it("CAP.toaster.001 held pointer expansion, cancelable collapse and bridge re-entry use current state", async () => {
  await render(node())
  await publish({ id: 0 }, { id: "" })
  const current = () => row("toast-number-0")
  const scale = () => RN.StyleSheet.flatten(current().props.style).transform[1].scale
  await fireEvent(stack(), "pointerEnter", {})
  expect(scale()).toBe(1)
  await fireEvent(stack(), "pointerDown", {})
  await fireEvent(stack(), "pointerLeave", {})
  await advance(150)
  expect(scale()).toBe(1)
  await fireEvent(stack(), "pointerUp", {})
  await fireEvent(stack(), "pointerLeave", {})
  await advance(60)
  await fireEvent(row("toaster-bridge-number:0"), "pointerEnter", {})
  await advance(150)
  expect(scale()).toBe(1)
  await fireEvent(stack(), "pointerLeave", {})
  await advance(120)
  expect(scale()).toBe(-1.05)
})
it("CAP.toaster.007/.008 renders expanded-by-default independently and hides overflow from hit testing/accessibility", async () => {
  await render(node({ expandByDefault: true, maxVisibleToasts: 1 }))
  await publish({ id: 0 }, { id: "" })
  expect(row("toast-number-0").props.pointerEvents).toBe("none")
  expect(row("toast-number-0").props.accessibilityElementsHidden).toBe(true)
  expect(row("toast-string-").props.pointerEvents).toBe("auto")
  expect(RN.StyleSheet.flatten(row("toast-number-0").props.style).transform[1]).toEqual({ scale: 1 })
})
it("CAP.toaster.009/.010/.011/.013 keeps zero gap/offset and all root/stack/bridge owners independent", async () => {
  await render(
    node({
      toastGap: 0,
      offset: 0,
      customRootStyles: { marginTop: 2 },
      customStyles: { backgroundColor: "red", borderWidth: 1 },
      customStackStyles: { backgroundColor: "gold" },
      customToastBridgeStyles: { backgroundColor: "pink" },
    }),
  )
  await publish({ id: 0 }, { id: "" })
  expect(root()).toHaveStyle({ marginTop: 2 })
  expect(stack()).toHaveStyle({ top: 10, right: 0, backgroundColor: "gold", borderWidth: 1 })
  expect(row("toaster-bridge-number:0")).toHaveStyle({ height: 1, backgroundColor: "pink" })
  expect(RN.StyleSheet.flatten(row("toast-number-0").props.style).transform[0]).toEqual({ translateY: 0 })
})
it("CAP.toaster.016 updates rendered IDs in place without confusing typed aliases", async () => {
  await render(node())
  await publish({ id: 0, titleText: "Numeric" }, { id: "0", titleText: "String" }, { id: "", titleText: "Empty" })
  await publish({ id: 0, titleText: "Updated", bodyText: "New body" })
  expect(screen.queryByText("Numeric")).toBeNull()
  expect(screen.getByText("Updated")).toBeOnTheScreen()
  expect(screen.getByText("String")).toBeOnTheScreen()
  expect(screen.getByText("Empty")).toBeOnTheScreen()
  expect(screen.getAllByTestId(/^toast-(number|string)-/, { includeHiddenElements: true })).toHaveLength(3)
})
it("CAP.toaster.017 preserves same-turn publish/dismiss ordering and 250ms programmatic retirement", async () => {
  await render(node())
  const onDismiss = jest.fn()
  await act(() => {
    toast({ id: 0, duration: "persistent", onDismiss })
    ToasterObserver.dismiss(0)
  })
  expect(row("toast-number-0").props.pointerEvents).toBe("none")
  await advance(249)
  expect(row("toast-number-0")).toBeOnTheScreen()
  await advance(1)
  expect(screen.queryByTestId("toaster")).toBeNull()
  expect(onDismiss).not.toHaveBeenCalled()
})
it("CAP.toaster.005 native focused dismissal uses current key configuration without invented user callbacks", async () => {
  await render(node({ dismissalHotkey: ["KeyQ"] }))
  const onDismiss = jest.fn()
  await publish({ id: 0, onDismiss })
  const target = row("toast-number-0").props
  await act(() =>
    target.onNativeKey({
      nativeEvent: {
        kind: "keyboard",
        ownerId: target.ownerId,
        key: "q",
        phase: "down",
        repeat: false,
        cancelled: false,
      },
    }),
  )
  expect(row("toast-number-0").props.pointerEvents).toBe("none")
  await advance(250)
  expect(screen.queryByTestId("toaster")).toBeNull()
  expect(onDismiss).not.toHaveBeenCalled()
})
it("CAP.toaster.006 registers the actual same-window expand policy and focuses a native stack on accepted input", async () => {
  await render(node())
  await publish({ id: 0 }, { id: "" })
  for (const ready of [false, true]) {
    const host = row("host").props
    await act(() =>
      host.onNativeScopeStatus({
        nativeEvent: {
          ownerId: host.ownerId,
          windowId: "toaster-window",
          epoch: 1,
          policyRevision: host.policyRevision,
          ready,
          windowActive: true,
        },
      }),
    )
  }
  const host = row("host").props
  const policy = host.policies.find((entry: { tokens: string[] }) => entry.tokens.includes("0100:e"))
  expect(policy).toBeDefined()
  await act(() =>
    host.onNativeScopedKey({
      nativeEvent: {
        kind: "keyboard",
        ownerId: host.ownerId,
        policyId: policy.id,
        windowId: "toaster-window",
        epoch: 1,
        policyRevision: host.policyRevision,
        target: 17,
        focusedTarget: 17,
        key: "e",
        phase: "down",
        repeat: false,
        cancelled: false,
        shiftKey: false,
        altKey: true,
        ctrlKey: false,
        metaKey: false,
        observedAt: 20,
        nativeCode: 33,
        nativeDefaultHandled: true,
        timestamp: 20,
      },
    }),
  )
  expect(Commands.requestKeyboardFocus).toHaveBeenCalledTimes(1)
  expect(RN.StyleSheet.flatten(row("toast-number-0").props.style).transform[1]).toEqual({ scale: 1 })
})
it("NATIVE.toaster.004 unmount retires subscriptions and pending collapse before later publications", async () => {
  const { unmount } = await render(node())
  await publish({ id: 0 }, { id: "" })
  await fireEvent(stack(), "pointerEnter", {})
  await fireEvent(stack(), "pointerLeave", {})
  await unmount()
  await advance(1000)
  await publish({ id: "later" })
  expect(screen.queryByTestId("toaster")).toBeNull()
})
