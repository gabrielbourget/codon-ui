import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import * as RN from "react-native"

import { NativeThemeProvider, Text } from "../../.."
import { NativeFloatingScopeContext } from "../../../overlays/floating/scope"
import { Toast } from "../Toast"
import type { TNativeToast, TNativeToastProps } from "../types"

const hidden = { includeHiddenElements: true }
const row = (id = "toast-number-0") => screen.getByTestId(id, hidden)
const advance = async (time: number) => act(() => jest.advanceTimersByTime(time))
const base = (toast: Partial<TNativeToast> = {}, props: Partial<TNativeToastProps> = {}): TNativeToastProps => ({
  toast: { id: 0, duration: "persistent", ...toast },
  index: 0,
  numToasts: 1,
  position: "top-right",
  offset: 0,
  firstHeight: 0,
  maxVisibleToasts: 5,
  toasterExpanded: false,
  interacting: false,
  removeToast: jest.fn(),
  onHeight: jest.fn(),
  ...props,
})
const node = (props: TNativeToastProps, canAct = true) => (
  <NativeThemeProvider>
    <NativeFloatingScopeContext.Provider value={{ id: null, canAct: () => canAct }}>
      <Toast {...props} />
    </NativeFloatingScopeContext.Provider>
  </NativeThemeProvider>
)
beforeEach(() => {
  jest.useFakeTimers()
  Object.defineProperty(RN.AppState, "currentState", { configurable: true, get: () => "active" })
  jest.spyOn(RN.AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})

it("CAP.toast.001/.002/.005/.006 renders actual native controls with authored dimensions and geometry", async () => {
  await render(node(base({ height: 300, width: 500, geometry: "orthogonal", raised: false })))
  expect(row()).toHaveStyle({ height: 300, width: 500, borderRadius: 0, elevation: 0 })
  expect(screen.getByRole("button", { name: "Close Toast" })).toBeOnTheScreen()
  expect(screen.getByText("Placeholder Title Text")).toBeOnTheScreen()
})
it.each([
  ["info", "#2563eb", false],
  ["warning", "#a66b00", false],
  ["success", "#2f7d18", false],
  ["error", "#b73434", true],
  ["danger", "#b73434", true],
  ["delete", "#b73434", true],
] as const)(
  "CAP.toast.003/.010 maps %s palette, faithful icon and default importance",
  async (type, color, important) => {
    await render(node(base({ type })))
    expect(row("toast-ribbon")).toHaveStyle({ backgroundColor: color })
    expect(row(`toast-default-${type}-icon`)).toBeOnTheScreen()
    expect(row().props.accessibilityLiveRegion).toBe(important ? "assertive" : "polite")
    expect(row().props.role).toBe(important ? "alert" : undefined)
  },
)
it("CAP.toast.004/.008 replaces both icons with caller nodes", async () => {
  await render(node(base({ ToastIcon: <Text>Custom status</Text>, CloseIcon: <Text>Custom close</Text> })))
  expect(screen.getByText("Custom status")).toBeOnTheScreen()
  expect(screen.getByText("Custom close")).toBeOnTheScreen()
  expect(screen.queryByTestId("toast-default-info-icon")).toBeNull()
  expect(screen.queryByTestId("toast-default-close-icon")).toBeNull()
})
it("CAP.toast.007/.013/.014 suppresses only the authored close/cancel/action controls", async () => {
  const { rerender } = await render(node(base({ dismissable: false, showCancelAction: false })))
  expect(screen.queryByRole("button", { name: "Close Toast" })).toBeNull()
  expect(screen.queryByRole("button", { name: "Cancel Action" })).toBeNull()
  expect(screen.getByRole("button", { name: "Confirm Action" })).toBeOnTheScreen()
  await rerender(node(base({ showButtons: false })))
  expect(screen.queryByRole("button", { name: "Confirm Action" })).toBeNull()
  expect(screen.getByRole("button", { name: "Close Toast" })).toBeOnTheScreen()
})
it("CAP.toast.010/.011/.012 preserves explicit false importance and layered empty/localized labels", async () => {
  await render(
    node(
      base(
        {
          type: "error",
          important: false,
          titleText: "",
          bodyText: "Body",
          labels: { confirmActionButton: "Valider" },
        },
        {
          toastLabels: {
            closeButtonAriaLabel: "Fermer",
            cancelActionButtonAriaLabel: "Annuler",
            confirmActionButtonAriaLabel: "Confirmer",
            cancelActionButton: "Annuler texte",
          },
        },
      ),
    ),
  )
  expect(row().props.accessibilityLiveRegion).toBe("polite")
  expect(screen.getByRole("button", { name: "Fermer" })).toBeOnTheScreen()
  expect(screen.getByRole("button", { name: "Annuler" })).toHaveTextContent("Annuler texte")
  expect(screen.getByRole("button", { name: "Confirmer" })).toHaveTextContent("Valider")
  expect(screen.queryByText("Placeholder Title Text")).toBeNull()
})
it.each([
  ["Close Toast", "close"],
  ["Cancel Action", "cancel"],
  ["Confirm Action", "confirm"],
] as const)(
  "CAP.toast.015/.019/.020/.021 %s invokes current callbacks once and retains its original payload until retirement",
  async (label, action) => {
    const order: string[] = []
    const onDismiss = jest.fn(() => order.push("dismiss"))
    const props = base({
      onDismiss,
      cancelAction: () => order.push("cancel"),
      confirmAction: () => order.push("confirm"),
    })
    await render(node(props))
    await userEvent.setup().press(screen.getByRole("button", { name: label }))
    expect(order).toEqual(action === "close" ? ["dismiss"] : [action, "dismiss"])
    expect(onDismiss).toHaveBeenCalledWith(props.toast)
    expect(props.removeToast).not.toHaveBeenCalled()
    expect(row().props.pointerEvents).toBe("none")
    await advance(249)
    expect(props.removeToast).not.toHaveBeenCalled()
    await advance(1)
    expect(props.removeToast).toHaveBeenCalledTimes(1)
    expect(props.removeToast).toHaveBeenCalledWith(props.toast)
  },
)
it("CAP.toast.009/.016 preserves zero duration and separates auto-close from user dismissal", async () => {
  const props = base({ duration: 0, onAutoClose: jest.fn(), onDismiss: jest.fn() }, { duration: 100 })
  await render(node(props))
  await advance(0)
  expect(props.toast.onAutoClose).toHaveBeenCalledWith(props.toast)
  expect(props.toast.onDismiss).not.toHaveBeenCalled()
  await advance(250)
  expect(props.removeToast).toHaveBeenCalledTimes(1)
})
it("NATIVE.toast.003 retains elapsed time across expansion and rerenders with current callbacks", async () => {
  const old = jest.fn(),
    next = jest.fn()
  const props = base({ duration: 100, onAutoClose: old })
  const { rerender } = await render(node(props))
  await advance(40)
  await rerender(node({ ...props, toasterExpanded: true }))
  await advance(500)
  expect(old).not.toHaveBeenCalled()
  const latest = { ...props.toast, onAutoClose: next }
  await rerender(node({ ...props, toast: latest }))
  await advance(59)
  expect(next).not.toHaveBeenCalled()
  await advance(1)
  expect(next).toHaveBeenCalledWith(latest)
  expect(old).not.toHaveBeenCalled()
})
it("NATIVE.toast.004 pauses for AppState inactivity and respects the explicit false pause flag", async () => {
  let changed: ((state: RN.AppStateStatus) => void) | undefined
  const remove = jest.fn()
  jest.spyOn(RN.AppState, "addEventListener").mockImplementation((_, callback) => {
    changed = callback
    return { remove }
  })
  const props = base({ duration: 100, onAutoClose: jest.fn() })
  const { rerender, unmount } = await render(node(props))
  await advance(30)
  await act(() => changed?.("background"))
  await advance(500)
  expect(props.toast.onAutoClose).not.toHaveBeenCalled()
  await rerender(node({ ...props, pauseWhenPageIsHidden: false }))
  await advance(69)
  expect(props.toast.onAutoClose).not.toHaveBeenCalled()
  await advance(1)
  expect(props.toast.onAutoClose).toHaveBeenCalledTimes(1)
  await unmount()
  expect(remove).toHaveBeenCalledTimes(1)
})
it("NATIVE.toast.005 cancels deadlines and rejects actual stale native activation delivery on unmount", async () => {
  const props = base({ duration: 100, onAutoClose: jest.fn(), onDismiss: jest.fn() })
  const { unmount } = await render(node(props))
  const button = screen.getByRole("button", { name: "Close Toast" })
  const activate = button.props.onNativeActivation
  const packet = {
    nativeEvent: {
      kind: "activation",
      ownerId: button.props.ownerId,
      activationId: 1,
      source: "android-click",
      observedAt: 1,
      target: 1,
      windowId: "toast-window",
      scopeOwnerId: "",
      epoch: 1,
    },
  }
  expect(activate).toEqual(expect.any(Function))
  await unmount()
  await advance(1000)
  await act(() => activate(packet))
  expect(props.toast.onAutoClose).not.toHaveBeenCalled()
  expect(props.toast.onDismiss).not.toHaveBeenCalled()
  expect(props.removeToast).not.toHaveBeenCalled()
})
it("CAP.toast.017/.018 keeps every root, nested style and native prop slot independent", async () => {
  await render(
    node(
      base({
        width: 120,
        height: 0,
        customStyles: { backgroundColor: "teal", marginTop: 3 },
        style: { marginTop: 7 },
        customTopRibbonStyles: { backgroundColor: "purple" },
        customTopRibbonLeftContentStyles: { gap: 6 },
        customTitleStyles: { color: "yellow" },
        customContentStyles: { padding: 10 },
        customBodyTextProps: { testID: "body", customStyles: { color: "red", marginLeft: 2 } },
        customBodyTextStyles: { color: "blue" },
        customBottomRowStyles: { backgroundColor: "white" },
        customButtonRowStyles: { gap: 10 },
        customTimestampTextProps: { testID: "timestamp" },
        customTimestampStyles: { color: "green" },
        customCloseButtonProps: { customStyles: { marginTop: 3 }, testID: "close" },
        customCloseButtonStyles: { marginLeft: 5 },
        customCancelButtonStyles: { marginRight: 5 },
        customConfirmButtonStyles: { marginLeft: 6 },
      }),
    ),
  )
  expect(row()).toHaveStyle({ backgroundColor: "teal", width: 120, height: 0, marginTop: 7 })
  expect(row("toast-ribbon")).toHaveStyle({ backgroundColor: "purple" })
  expect(row("toast-ribbon-left")).toHaveStyle({ gap: 6 })
  expect(screen.getByRole("heading")).toHaveStyle({ color: "yellow" })
  expect(row("toast-content")).toHaveStyle({ padding: 10 })
  expect(row("body")).toHaveStyle({ color: "blue", marginLeft: 2 })
  expect(row("toast-bottom")).toHaveStyle({ backgroundColor: "white" })
  expect(row("timestamp")).toHaveStyle({ color: "green" })
  expect(row("toast-buttons")).toHaveStyle({ gap: 10 })
  expect(row("close")).toHaveStyle({ marginTop: 3, marginLeft: 5 })
  expect(screen.getByRole("button", { name: "Cancel Action" })).toHaveStyle({ marginRight: 5 })
  expect(screen.getByRole("button", { name: "Confirm Action" })).toHaveStyle({ marginLeft: 6 })
  expect(row().props.customStyles).toBeUndefined()
  expect(row().props.toast).toBeUndefined()
})
it("NATIVE.toast.006 rejects stale/invisible/modal-blocked actions", async () => {
  const onDismiss = jest.fn(),
    props = base({ onDismiss })
  const { rerender } = await render(node(props))
  const button = screen.getByRole("button", { name: "Close Toast" })
  const activate = button.props.onNativeActivation
  const packet = {
    nativeEvent: {
      kind: "activation",
      ownerId: button.props.ownerId,
      activationId: 1,
      source: "android-click",
      observedAt: 1,
      target: 1,
      windowId: "toast-window",
      scopeOwnerId: "",
      epoch: 1,
    },
  }
  expect(activate).toEqual(expect.any(Function))
  await rerender(node({ ...props, index: 5 }))
  await act(() => activate(packet))
  expect(onDismiss).not.toHaveBeenCalled()
  await rerender(node(props, false))
  await userEvent.setup().press(screen.getByRole("button", { name: "Close Toast" }))
  expect(onDismiss).not.toHaveBeenCalled()
  await rerender(node(props))
  await act(() => activate({ nativeEvent: { ...packet.nativeEvent, activationId: 2 } }))
  expect(onDismiss).toHaveBeenCalledTimes(1)
})
it("NATIVE.toast.007 measures the actual host and rejects stale layout delivery", async () => {
  const props = base(),
    { unmount } = await render(node(props))
  const onLayout = row().props.onLayout
  const event = { nativeEvent: { layout: { x: 0, y: 0, height: 45, width: 100 } } }
  await fireEvent(row(), "layout", event)
  expect(props.onHeight).toHaveBeenCalledWith(0, 45)
  await unmount()
  await act(() => onLayout(event))
  expect(props.onHeight).toHaveBeenCalledTimes(1)
})
it("NATIVE.toast.008 only swipes outward with the owned pointer and does not dismiss action descendants", async () => {
  const props = base({ onDismiss: jest.fn() })
  await render(node(props))
  const pointer = (y: number, id = 1, child = false) => ({
    target: child ? 2 : 1,
    currentTarget: 1,
    nativeEvent: { pointerId: id, pageX: 0, pageY: y, pointerType: "touch" },
  })
  await fireEvent(row(), "pointerDown", pointer(0, 1, true))
  await fireEvent(row(), "pointerMove", pointer(-40))
  await fireEvent(row(), "pointerUp", pointer(-40))
  expect(props.toast.onDismiss).not.toHaveBeenCalled()
  await fireEvent(row(), "pointerDown", pointer(0))
  await fireEvent(row(), "pointerMove", pointer(40))
  await fireEvent(row(), "pointerUp", pointer(40))
  expect(props.toast.onDismiss).not.toHaveBeenCalled()
  await fireEvent(row(), "pointerDown", pointer(0))
  await fireEvent(row(), "pointerMove", pointer(-40, 2))
  await fireEvent(row(), "pointerUp", pointer(-40, 2))
  expect(props.toast.onDismiss).not.toHaveBeenCalled()
  await advance(100)
  await fireEvent(row(), "pointerMove", pointer(-40))
  await fireEvent(row(), "pointerUp", pointer(-40))
  expect(props.toast.onDismiss).toHaveBeenCalledTimes(1)
})
it("NATIVE.toast.009 cancels an already pending exit retirement on unmount", async () => {
  const props = base({ onDismiss: jest.fn() })
  const { unmount } = await render(node(props))
  await userEvent.setup().press(screen.getByRole("button", { name: "Close Toast" }))
  expect(props.toast.onDismiss).toHaveBeenCalledTimes(1)
  expect(props.removeToast).not.toHaveBeenCalled()
  await unmount()
  await advance(1000)
  expect(props.removeToast).not.toHaveBeenCalled()
})
