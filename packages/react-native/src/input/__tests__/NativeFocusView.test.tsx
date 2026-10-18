import { act, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { TextInput, View, type NativeSyntheticEvent } from "react-native"

import { blurNativeTarget, focusNativeTarget, registerNativeFocusTarget } from "../focus"
import { NativeFocusView } from "../NativeFocusView"
import { Commands, type NativeFocusData, type NativeKeyData } from "../specs/CUIFocusViewNativeComponent"
import type { TNativeKeyboardData } from "../types"

jest.mock("../specs/CUIFocusViewNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
  Commands: { requestKeyboardFocus: jest.fn(), requestKeyboardBlur: jest.fn() },
}))

const keyData = (ownerId: string, extra: Partial<TNativeKeyboardData> = {}): TNativeKeyboardData => ({
  kind: "keyboard",
  ownerId,
  target: 17,
  key: "ArrowRight",
  nativeCode: 79,
  characters: "",
  phase: "down",
  repeat: false,
  cancelled: false,
  shiftKey: false,
  altKey: false,
  ctrlKey: false,
  metaKey: true,
  capsLock: false,
  nativeModifierData: "1048576",
  nativeDefaultHandled: false,
  timestamp: 0,
  ...extra,
})
const nativeEvent = <T,>(data: T) => ({ nativeEvent: data }) as NativeSyntheticEvent<T>
const host = () => screen.getByTestId("focus")

it("keeps the actual root ref and zero styles, admitting commands without changing View.focus", async () => {
  const ref = createRef<View>()
  await render(<NativeFocusView ref={ref} testID="focus" style={{ width: 0, height: 0 }} />)
  const target = ref.current
  const upstreamFocus = target?.focus
  expect(target).not.toBeNull()
  expect(host().props.style).toEqual({ width: 0, height: 0 })
  expect(focusNativeTarget(target)).toBe(true)
  expect(Commands.requestKeyboardFocus).toHaveBeenLastCalledWith(target, host().props.ownerId)
  expect(blurNativeTarget(target)).toBe(true)
  expect(Commands.requestKeyboardBlur).toHaveBeenLastCalledWith(target, host().props.ownerId)
  expect(target?.focus).toBe(upstreamFocus)
  await screen.unmount()
  expect(focusNativeTarget(target)).toBe(false)
})

it("forwards the same key object with full modifiers and the current callback, without a debounce", async () => {
  const first = jest.fn()
  const next = jest.fn()
  const up = jest.fn()
  await render(<NativeFocusView testID="focus" onKeyDown={first} onKeyUp={up} />)
  const event = nativeEvent(keyData(host().props.ownerId, { shiftKey: true, repeat: true }))
  await act(() => host().props.onNativeKey(event))
  expect(first).toHaveBeenCalledWith(event)
  expect(first.mock.calls[0][0]).toBe(event)
  await screen.rerender(<NativeFocusView testID="focus" onKeyDown={next} onKeyUp={up} />)
  await act(() => host().props.onNativeKey(event))
  expect(next).toHaveBeenCalledWith(event)
  expect(first).toHaveBeenCalledTimes(1)
  const cancelled = nativeEvent(keyData(host().props.ownerId, { phase: "up", cancelled: true }))
  await act(() => host().props.onNativeKey(cancelled))
  expect(up.mock.calls[0][0]).toBe(cancelled)
})

it("rejects retired native owners and invalid key kind without fabricating a touch event", async () => {
  const onKeyDown = jest.fn()
  await render(<NativeFocusView testID="focus" onKeyDown={onKeyDown} />)
  await act(() => host().props.onNativeKey(nativeEvent(keyData("retired"))))
  const invalid: NativeKeyData = { ...keyData(host().props.ownerId), kind: "touch" }
  await act(() => host().props.onNativeKey(nativeEvent(invalid)))
  expect(onKeyDown).not.toHaveBeenCalled()
})

it("keeps native focus acknowledgement separate from a request and forwards the original object", async () => {
  const ref = createRef<View>()
  const onFocus = jest.fn()
  const onBlur = jest.fn()
  await render(<NativeFocusView ref={ref} testID="focus" onFocus={onFocus} onBlur={onBlur} />)
  focusNativeTarget(ref.current)
  expect(onFocus).not.toHaveBeenCalled()
  const event = nativeEvent<NativeFocusData>({
    ownerId: host().props.ownerId,
    target: 17,
    isFocused: true,
    origin: "programmatic",
    timestamp: 0,
  })
  await act(() => host().props.onNativeFocusChange(event))
  expect(onFocus.mock.calls[0][0]).toBe(event)
  const blurred = nativeEvent({ ...event.nativeEvent, isFocused: false })
  await act(() => host().props.onNativeFocusChange(blurred))
  expect(onBlur.mock.calls[0][0]).toBe(blurred)
})

it.each([{ focusable: false }, { tabIndex: -1 as const }])(
  "does not admit focus when %j, while permitting blur",
  async (guard) => {
    const ref = createRef<View>()
    const onKeyDown = jest.fn()
    await render(<NativeFocusView ref={ref} testID="focus" onKeyDown={onKeyDown} />)
    await screen.rerender(<NativeFocusView {...guard} ref={ref} testID="focus" onKeyDown={onKeyDown} />)
    expect(focusNativeTarget(ref.current)).toBe(false)
    expect(blurNativeTarget(ref.current)).toBe(true)
    await act(() => host().props.onNativeKey(nativeEvent(keyData(host().props.ownerId))))
    expect(onKeyDown).not.toHaveBeenCalled()
  },
)

it("does not substitute generic View or null focus, and an old release cannot retire a newer registration", async () => {
  const ref = createRef<View>()
  await render(<View ref={ref} />)
  const target = ref.current!
  expect(focusNativeTarget(null)).toBe(false)
  expect(blurNativeTarget(null)).toBe(false)
  expect(focusNativeTarget(target)).toBe(false)
  const old = registerNativeFocusTarget(target, { focus: jest.fn(), blur: jest.fn(), canFocus: () => true })
  const focus = jest.fn()
  const release = registerNativeFocusTarget(target, { focus, blur: jest.fn(), canFocus: () => true })
  old()
  expect(focusNativeTarget(target)).toBe(true)
  expect(focus).toHaveBeenCalledTimes(1)
  release()
  expect(focusNativeTarget(target)).toBe(false)
})

it("leaves original pointer events on their native callback path", async () => {
  const onPointerEnter = jest.fn()
  await render(<NativeFocusView testID="focus" onPointerEnter={onPointerEnter} />)
  const pointer = { nativeEvent: { pointerType: "mouse", clientX: 0, clientY: 0 } }
  await act(() => host().props.onPointerEnter(pointer))
  expect(onPointerEnter.mock.calls[0][0]).toBe(pointer)
})

it("retires queued native callbacks after unmount", async () => {
  const onKeyDown = jest.fn()
  const onFocus = jest.fn()
  await render(<NativeFocusView testID="focus" onKeyDown={onKeyDown} onFocus={onFocus} />)
  const nativeKey = host().props.onNativeKey
  const nativeFocus = host().props.onNativeFocusChange
  const ownerId = host().props.ownerId
  await screen.unmount()
  await act(() => {
    nativeKey(nativeEvent(keyData(ownerId)))
    nativeFocus(nativeEvent({ ownerId, isFocused: true }))
  })
  expect(onKeyDown).not.toHaveBeenCalled()
  expect(onFocus).not.toHaveBeenCalled()
})

it("preserves React19 callback-ref cleanup on the actual native instance", async () => {
  const cleanup = jest.fn()
  const ref = jest.fn((_target: View | null) => cleanup)
  await render(<NativeFocusView ref={ref} testID="focus" />)
  const target = ref.mock.calls[0]![0]
  expect(target).toBeDefined()
  expect(focusNativeTarget(target)).toBe(true)
  await screen.unmount()
  expect(cleanup).toHaveBeenCalledTimes(1)
  expect(ref).toHaveBeenCalledTimes(1)
  expect(focusNativeTarget(target)).toBe(false)
})

it("requests an existing registered TextInput's unchanged focus methods without writing its controlled value", async () => {
  const ref = createRef<TextInput>()
  const onChangeText = jest.fn()
  await render(<TextInput ref={ref} testID="input" value="" onChangeText={onChangeText} />)
  const target = ref.current!
  const state = jest.requireActual<{
    default: {
      registerInput: (target: TextInput) => void
      unregisterInput: (target: TextInput) => void
    }
  }>("react-native/Libraries/Components/TextInput/TextInputState").default
  state.registerInput(target)
  const focus = jest.spyOn(target, "focus")
  const blur = jest.spyOn(target, "blur")
  const write = jest.spyOn(target, "setNativeProps")
  try {
    expect(focusNativeTarget(target)).toBe(true)
    expect(blurNativeTarget(target)).toBe(true)
    expect(focus).toHaveBeenCalledTimes(1)
    expect(blur).toHaveBeenCalledTimes(1)
    expect(write).not.toHaveBeenCalled()
    expect(onChangeText).not.toHaveBeenCalled()
    expect(screen.getByTestId("input").props.value).toBe("")
  } finally {
    state.unregisterInput(target)
  }
  expect(focusNativeTarget(target)).toBe(false)
})
