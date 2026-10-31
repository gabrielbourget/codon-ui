import { act, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import * as RN from "react-native"

import { NativeFloatingScopeContext } from "../../overlays/floating/scope"
import {
  captureNativeFocusTarget,
  focusNativeTarget,
  getNativeFocusedTarget,
  getNativePreviousFocusTarget,
  subscribeNativeFocus,
} from "../focus"
import { NativeFocusView } from "../NativeFocusView"
import { Commands } from "../specs/CUIFocusViewNativeComponent"

const row = (id: string) => screen.getByTestId(id)
const event = (id: string, target: RN.View | null, focused: boolean) => ({
  nativeEvent: {
    ownerId: row(id).props.ownerId,
    target: RN.findNodeHandle(target),
    isFocused: focused,
    isFocusVisible: true,
    origin: "keyboard",
    timestamp: 100,
  },
})
beforeEach(() => {
  jest.spyOn(Commands, "requestKeyboardFocus").mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())

it("records actual owner/target-matched refs before forwarding the identical native focus callback", async () => {
  const first = createRef<RN.View>(),
    second = createRef<RN.View>(),
    caller = jest.fn()
  await render(
    <>
      <NativeFocusView ref={first} testID="first" onFocus={caller} />
      <NativeFocusView ref={second} testID="second" />
    </>,
  )
  const listener = jest.fn(),
    release = subscribeNativeFocus(listener)
  try {
    const observed = event("first", first.current, true)
    await act(() => row("first").props.onNativeFocusChange(observed))
    expect(getNativeFocusedTarget()).toBe(first.current)
    expect(caller).toHaveBeenCalledWith(observed)
    await act(() => row("second").props.onNativeFocusChange(event("second", second.current, true)))
    expect(getNativeFocusedTarget()).toBe(second.current)
    expect(getNativePreviousFocusTarget()).toBe(first.current)
    await act(() => row("first").props.onNativeFocusChange(event("first", first.current, false)))
    expect(getNativeFocusedTarget()).toBe(second.current)
    expect(listener).toHaveBeenCalledTimes(2)
  } finally {
    release()
  }
})
it("rejects foreign target/owner observations without suppressing an ordinary owner-matched caller event", async () => {
  const target = createRef<RN.View>(),
    caller = jest.fn()
  await render(<NativeFocusView ref={target} testID="target" onFocus={caller} />)
  const valid = event("target", target.current, true)
  await act(() =>
    row("target").props.onNativeFocusChange({ nativeEvent: { ...valid.nativeEvent, ownerId: "foreign" } }),
  )
  expect(caller).not.toHaveBeenCalled()
  await act(() => row("target").props.onNativeFocusChange({ nativeEvent: { ...valid.nativeEvent, target: 999999 } }))
  expect(caller).toHaveBeenCalledTimes(1)
  expect(getNativeFocusedTarget()).toBeNull()
})
it("retires leases on guard takeover and unmount", async () => {
  const target = createRef<RN.View>()
  const node = (allowed: boolean) => (
    <NativeFloatingScopeContext.Provider value={{ id: "branch", canAct: () => allowed }}>
      <NativeFocusView ref={target} testID="target" />
    </NativeFloatingScopeContext.Provider>
  )
  const { rerender, unmount } = await render(node(true))
  await act(() => row("target").props.onNativeFocusChange(event("target", target.current, true)))
  const lease = captureNativeFocusTarget(target.current!)
  expect(lease?.()).toBe(true)
  await rerender(node(false))
  expect(lease?.()).toBe(false)
  expect(focusNativeTarget(target.current)).toBe(false)
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
  await unmount()
  expect(lease?.()).toBe(false)
  expect(getNativeFocusedTarget()).toBeNull()
})
it("retires the old registration when the forwarded ref owner changes without inventing a focus acknowledgment", async () => {
  const first = createRef<RN.View>(),
    second = createRef<RN.View>(),
    caller = jest.fn()
  const node = (replacement: boolean) => (
    <NativeFocusView ref={replacement ? second : first} testID="target" onFocus={caller} />
  )
  const { rerender } = await render(node(false))
  const target = first.current!
  await act(() => row("target").props.onNativeFocusChange(event("target", target, true)))
  const lease = captureNativeFocusTarget(target)
  await rerender(node(true))
  expect(first.current).toBeNull()
  expect(second.current).toBe(target)
  expect(lease?.()).toBe(false)
  expect(captureNativeFocusTarget(target)?.()).toBe(true)
  expect(caller).toHaveBeenCalledTimes(1)
})
