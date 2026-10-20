import { act, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { TextInput, View, type NativeSyntheticEvent } from "react-native"

import { inspectNativeAccessibility, registerNativeAccessibilityInspector } from "../accessibilityInspection"
import { nativeAccessibilityIDs } from "../accessibilityReferences"
import { blurNativeTarget, focusNativeTarget, registerNativeFocusTarget } from "../focus"
import { NativeFocusHost, NativeFocusView } from "../NativeFocusView"
import {
  Commands,
  type NativeAccessibilityData,
  type NativeFocusData,
  type NativeKeyData,
} from "../specs/CUIFocusViewNativeComponent"
import type { TNativeKeyboardData } from "../types"

jest.mock("../specs/CUIFocusViewNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
  Commands: { requestKeyboardFocus: jest.fn(), requestKeyboardBlur: jest.fn(), inspectAccessibility: jest.fn() },
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
beforeEach(() => jest.clearAllMocks())

it("keeps raw bubbling focus observations distinct from direct native acknowledgments and retires both after unmount", async () => {
  const observed = jest.fn(),
    acknowledged = jest.fn()
  await render(<NativeFocusHost testID="focus" onBubbledFocus={observed} onFocus={acknowledged} />)
  const raw = nativeEvent({ target: 29 })
  const notify = host().props.onFocus
  await act(() => notify(raw))
  expect(observed.mock.calls[0][0]).toBe(raw)
  expect(acknowledged).not.toHaveBeenCalled()
  await act(() => host().props.onNativeFocusChange(nativeEvent({ ownerId: host().props.ownerId, isFocused: true })))
  expect(acknowledged).toHaveBeenCalledTimes(1)
  expect(observed).toHaveBeenCalledTimes(1)
  await screen.unmount()
  await act(() => notify(raw))
  expect(observed).toHaveBeenCalledTimes(1)
})

it("routes native ID lists and explicit empty descriptions without replacing the native label, hint or value", async () => {
  const ids = ["first", "second"]
  await render(
    <NativeFocusHost
      testID="focus"
      accessibilityLabel=""
      accessibilityHint="Hint"
      accessibilityValue={{ now: 0, text: "" }}
      nativeLabelledBy={ids}
      nativeDescribedBy={[]}
      nativeDetailsBy={["details"]}
      nativeDescriptionTag={0}
      nativeDescriptionLabel=""
      nativeDetailsLabel="Détails"
    />,
  )
  expect(host().props).toMatchObject({
    accessibilityLabel: "",
    accessibilityHint: "Hint",
    accessibilityValue: { now: 0, text: "" },
    nativeLabelledBy: ids,
    nativeDescribedBy: [],
    nativeDetailsBy: ["details"],
    nativeDescriptionTag: 0,
    nativeDescriptionLabel: "",
    nativeDetailsLabel: "Détails",
  })
  expect(host().props.nativeLabelledBy).toBe(ids)
})

it("routes inherited labelled-by aliases through the owned host while retaining core View precedence", async () => {
  await render(<NativeFocusView testID="focus" accessibilityLabelledBy="native" aria-labelledby="first,second" />)
  expect(host().props.nativeLabelledBy).toEqual(["first", "second"])
  await screen.rerender(<NativeFocusView testID="focus" accessibilityLabelledBy={["native"]} />)
  expect(host().props.nativeLabelledBy).toEqual(["native"])
  await screen.rerender(<NativeFocusView testID="focus" />)
  expect(host().props.nativeLabelledBy).toBeUndefined()
})

it("inspects only the registered actual native target and retires the command on unmount", async () => {
  const ref = createRef<View>()
  await render(<NativeFocusHost testID="focus" ref={ref} focusable={false} />)
  const target = ref.current!
  expect(inspectNativeAccessibility(target)).toBe(true)
  expect(Commands.inspectAccessibility).toHaveBeenCalledWith(target, host().props.ownerId)
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
  await screen.unmount()
  expect(inspectNativeAccessibility(target)).toBe(false)
  expect(inspectNativeAccessibility(null)).toBe(false)
  expect(Commands.inspectAccessibility).toHaveBeenCalledTimes(1)
})

it("cannot retire a replacement inspector with an older registration's cleanup", async () => {
  const ref = createRef<View>()
  await render(<View ref={ref} />)
  const inspect = jest.fn()
  const releaseOld = registerNativeAccessibilityInspector(ref.current!, jest.fn())
  const release = registerNativeAccessibilityInspector(ref.current!, inspect)
  releaseOld()
  expect(inspectNativeAccessibility(ref.current)).toBe(true)
  expect(inspect).toHaveBeenCalledTimes(1)
  release()
  expect(inspectNativeAccessibility(ref.current)).toBe(false)
})

it("forwards the original native accessibility snapshot only to its current live owner", async () => {
  const first = jest.fn(),
    next = jest.fn()
  await render(<NativeFocusHost testID="focus" onNativeAccessibilitySnapshot={first} />)
  const record = nativeEvent<NativeAccessibilityData>({
    ownerId: host().props.ownerId,
    target: 17,
    windowId: "native-window",
    platform: "ios",
    selected: false,
    containerType: 0,
    containerTitle: "",
    roleDescription: "",
    label: "",
    hint: "Hint",
    value: "0",
    description: "",
    details: "Native details",
    descriptionAvailable: true,
    detailsAvailable: true,
    collection: "{}",
    observedAt: 0,
  })
  await act(() => host().props.onNativeAccessibilitySnapshot(record))
  expect(first.mock.calls[0][0]).toBe(record)
  await screen.rerender(<NativeFocusHost testID="focus" onNativeAccessibilitySnapshot={next} />)
  const deliver = host().props.onNativeAccessibilitySnapshot
  await act(() => deliver(nativeEvent({ ...record.nativeEvent, ownerId: "retired" })))
  expect(next).not.toHaveBeenCalled()
  await act(() => deliver(record))
  expect(next.mock.calls[0][0]).toBe(record)
  await screen.unmount()
  await act(() => deliver(record))
  expect(next).toHaveBeenCalledTimes(1)
})

it("tokenizes canonical ARIA whitespace lists while preserving authored native lists and empty values", () => {
  const ids = ["native-one", "native-two"]
  expect(nativeAccessibilityIDs(" first\nsecond\tthird ")).toEqual(["first", "second", "third"])
  expect(nativeAccessibilityIDs("")).toEqual([])
  expect(nativeAccessibilityIDs(undefined)).toBeUndefined()
  expect(nativeAccessibilityIDs(ids)).toBe(ids)
})

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
    isFocusVisible: false,
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

it("NAV.001 keeps private navigation fields, actual refs and empty native metadata independent", async () => {
  const ref = createRef<View>()
  await render(
    <NativeFocusHost
      ref={ref}
      testID="focus"
      nativeNavigation
      nativeNavigationLabel=""
      accessible={false}
      focusable={false}
      accessibilityValue={{ now: 0, text: "" }}
    />,
  )
  const actual = ref.current
  expect(host().props).toMatchObject({
    nativeNavigation: true,
    nativeNavigationLabel: "",
    accessible: false,
    keyboardFocusable: false,
    accessibilityValue: { now: 0, text: "" },
  })
  await screen.rerender(<NativeFocusHost ref={ref} testID="focus" nativeNavigation={false} />)
  expect(host().props.nativeNavigation).toBe(false)
  expect(host().props.nativeNavigationLabel).toBeUndefined()
  expect(ref.current).toBe(actual)
})

it.each(["android", "ios"] as const)(
  "NAV.004 preserves the actual %s inspector record and platform-specific unsupported fields",
  async (platform) => {
    const callback = jest.fn()
    await render(<NativeFocusHost testID="focus" onNativeAccessibilitySnapshot={callback} />)
    const record = nativeEvent<NativeAccessibilityData>({
      ownerId: host().props.ownerId,
      target: 17,
      windowId: "observed-window",
      platform,
      selected: false,
      containerType: platform === "ios" ? 3 : -1,
      containerTitle: platform === "android" ? "Observed title" : "",
      roleDescription: platform === "android" ? "Observed role" : "",
      label: "Observed label",
      hint: "",
      value: "0",
      description: "",
      details: "",
      descriptionAvailable: false,
      detailsAvailable: false,
      collection: "{}",
      observedAt: 0,
    })
    await act(() => host().props.onNativeAccessibilitySnapshot(record))
    expect(callback.mock.calls[0][0]).toBe(record)
    expect(callback.mock.calls[0][0].nativeEvent).toBe(record.nativeEvent)
    expect(record.nativeEvent.selected).toBe(false)
    expect(record.nativeEvent.observedAt).toBe(0)
  },
)
