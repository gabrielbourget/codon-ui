import { act, fireEvent, render, screen } from "@testing-library/react-native"
import * as RN from "react-native"

import { NativeFloatingLayerHost, NativeThemeProvider } from "../../.."
import { NativeFloatingScopeContext } from "../../../overlays/floating/scope"
import { NativeContentContext } from "../../NativeContentContext"
import { Toast } from "../Toast"
import type { TNativeToastProps } from "../types"

const row = (id = "toast-number-0") => screen.getByTestId(id, { includeHiddenElements: true })
const props = (extra: Partial<TNativeToastProps> = {}): TNativeToastProps => ({
  toast: { id: 0, duration: "persistent", onDismiss: jest.fn() },
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
  ...extra,
})
const node = (value: TNativeToastProps, enabled = true) => (
  <NativeThemeProvider>
    <NativeFloatingLayerHost>
      <NativeFloatingScopeContext.Provider value={{ id: null, canAct: () => enabled }}>
        <Toast {...value} />
      </NativeFloatingScopeContext.Provider>
    </NativeFloatingLayerHost>
  </NativeThemeProvider>
)
const pointer = (y: number, nativeEvent = { pointerId: 1, pageX: 0, pageY: y, pointerType: "touch" }) => ({
  target: 2,
  currentTarget: 1,
  nativeEvent,
})
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

it.each(["Close Toast", "Cancel Action", "Confirm Action"])(
  "CAP.toast.007/.018 excludes actual %s descendants and forwards the same native pointer event",
  async (label) => {
    const onPointerDown = jest.fn(),
      value = props()
    value.toast.customCloseButtonProps = { onPointerDown }
    value.toast.customCancelButtonProps = { onPointerDown }
    value.toast.customConfirmButtonProps = { onPointerDown }
    await render(node(value))
    const event = pointer(0)
    await fireEvent(screen.getByRole("button", { name: label }), "pointerDown", event)
    expect(onPointerDown).toHaveBeenCalledWith(event)
    await fireEvent(row(), "pointerDown", event)
    await fireEvent(row(), "pointerMove", pointer(-40))
    await fireEvent(row(), "pointerUp", pointer(-40))
    expect(value.toast.onDismiss).not.toHaveBeenCalled()
    await fireEvent(row(), "pointerDown", pointer(0))
    await fireEvent(row(), "pointerMove", pointer(-40))
    await fireEvent(row(), "pointerUp", pointer(-40))
    expect(value.toast.onDismiss).toHaveBeenCalledTimes(1)
  },
)
it("CAP.toast.007 permits body descendants and uses the current original payload at dismissal", async () => {
  const value = props(),
    oldDismiss = value.toast.onDismiss,
    nextDismiss = jest.fn()
  const { rerender } = await render(node(value))
  await fireEvent(row(), "pointerDown", pointer(0))
  const current = { ...value.toast, titleText: "Updated during gesture", onDismiss: nextDismiss }
  await rerender(node({ ...value, toast: current }))
  await fireEvent(row(), "pointerMove", pointer(-40))
  await fireEvent(row(), "pointerUp", pointer(-40))
  expect(oldDismiss).not.toHaveBeenCalled()
  expect(nextDismiss).toHaveBeenCalledWith(current)
})
it("NATIVE.toast.interaction.001 retires a gesture when eligibility changes and ignores saved late handlers", async () => {
  const value = props(),
    { rerender, unmount } = await render(node(value))
  const move = row().props.onPointerMove,
    up = row().props.onPointerUp
  await fireEvent(row(), "pointerDown", pointer(0))
  await rerender(node({ ...value, toast: { ...value.toast, dismissable: false } }))
  await act(() => {
    move(pointer(-40))
    up(pointer(-40))
  })
  expect(value.toast.onDismiss).not.toHaveBeenCalled()
  await rerender(node(value))
  await fireEvent(row(), "pointerDown", pointer(0))
  await rerender(node(value, false))
  await act(() => {
    move(pointer(-40))
    up(pointer(-40))
  })
  expect(value.toast.onDismiss).not.toHaveBeenCalled()
  await unmount()
  await act(() => {
    move(pointer(-40))
    up(pointer(-40))
  })
  expect(value.toast.onDismiss).not.toHaveBeenCalled()
})
it("NATIVE.toast.interaction.002 preserves the latest authored action pointer callback", async () => {
  const first = jest.fn(),
    latest = jest.fn(),
    value = props()
  value.toast.customCloseButtonProps = { onPointerDown: first }
  const { rerender } = await render(node(value))
  const down = screen.getByRole("button", { name: "Close Toast" }).props.onPointerDown
  await rerender(node({ ...value, toast: { ...value.toast, customCloseButtonProps: { onPointerDown: latest } } }))
  const event = pointer(0)
  await act(() => down(event))
  expect(first).not.toHaveBeenCalled()
  expect(latest).toHaveBeenCalledWith(event)
})
it("CAP.toast.003/.017/.018 owns the surface foreground and preserves root/slot color precedence", async () => {
  const registered = RN.StyleSheet.create({ color: { color: "orange" } })
  const value = props({
    toast: {
      id: 0,
      duration: "persistent",
      customStyles: [registered.color, false],
      style: { color: "blue" },
      customBodyTextProps: { testID: "body" },
    },
  })
  const { rerender } = await render(
    <NativeThemeProvider>
      <NativeContentContext.Provider value={{ foregroundColor: "pink", isButton: true }}>
        <NativeFloatingLayerHost>
          <Toast {...value} />
        </NativeFloatingLayerHost>
      </NativeContentContext.Provider>
    </NativeThemeProvider>,
  )
  expect(row("body")).toHaveStyle({ color: "blue" })
  expect(RN.StyleSheet.flatten(row().props.style).color).toBeUndefined()
  expect(screen.getByRole("heading")).toHaveStyle({ color: "#ffffff" })
  await rerender(node({ ...value, toast: { ...value.toast, customBodyTextStyles: { color: "green" } } }))
  expect(row("body")).toHaveStyle({ color: "green" })
})
it("CAP.toast.003 owns existing light/dark surface roles across provider updates", async () => {
  const value = props({ toast: { id: 0, duration: "persistent", customBodyTextProps: { testID: "body" } } })
  const { rerender } = await render(
    <NativeThemeProvider>
      <NativeFloatingLayerHost>
        <Toast {...value} />
      </NativeFloatingLayerHost>
    </NativeThemeProvider>,
  )
  expect(row()).toHaveStyle({ backgroundColor: "#ffffff" })
  expect(row("body")).toHaveStyle({ color: "#171717" })
  await rerender(
    <NativeThemeProvider mode="dark">
      <NativeFloatingLayerHost>
        <Toast {...value} />
      </NativeFloatingLayerHost>
    </NativeThemeProvider>,
  )
  expect(row()).toHaveStyle({ backgroundColor: "#171717" })
  expect(row("body")).toHaveStyle({ color: "#ffffff" })
})
it("CAP.toast.002 measures natural content independently from allocated collapsed height, including zero", async () => {
  const value = props({ index: 1, numToasts: 2, firstHeight: 0 })
  const { rerender } = await render(node(value))
  expect(row()).toHaveStyle({ height: 0 })
  const event = { nativeEvent: { layout: { x: 0, y: 0, width: 325, height: 80 } } }
  await fireEvent(row("toast-natural-content"), "layout", event)
  expect(value.onHeight).toHaveBeenCalledWith(0, 80)
  expect(row()).toHaveStyle({ height: 0 })
  await rerender(node({ ...value, firstHeight: 30 }))
  expect(row()).toHaveStyle({ height: 30 })
})
