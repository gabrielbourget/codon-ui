import { act, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { View } from "react-native"

import { bindNativeDescription, registerNativeDescriptionSource } from "../nativeDescription"
import { NativeFocusHost } from "../NativeFocusView"

jest.mock("../specs/CUIFocusViewNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
  Commands: { requestKeyboardFocus: jest.fn(), requestKeyboardBlur: jest.fn(), inspectAccessibility: jest.fn() },
}))
const ReactNative = jest.requireActual<typeof import("react-native")>("react-native")
beforeEach(() => jest.spyOn(ReactNative, "findNodeHandle").mockReturnValue(71))
afterEach(() => jest.restoreAllMocks())

const targets = async () => {
  const target = createRef<View>(),
    description = createRef<View>()
  await render(
    <>
      <View ref={target} />
      <View ref={description} />
    </>,
  )
  return { target: target.current!, description: description.current! }
}

it("binds the actual description tag into an owned host while retaining label, hint, value and ref identity", async () => {
  const target = createRef<View>(),
    description = createRef<View>()
  await render(
    <>
      <NativeFocusHost
        testID="target"
        ref={target}
        accessibilityLabel=""
        accessibilityHint="Hint"
        accessibilityValue={{ now: 0, text: "" }}
      />
      <View ref={description} />
    </>,
  )
  const actual = target.current
  let release: ReturnType<typeof bindNativeDescription>
  await act(() => {
    release = bindNativeDescription(actual, description.current, "")
  })
  expect(target.current).toBe(actual)
  expect(ReactNative.findNodeHandle).toHaveBeenCalledWith(description.current)
  expect(screen.getByTestId("target").props).toMatchObject({
    nativeDescriptionTag: 71,
    nativeDescriptionLabel: "",
    accessibilityLabel: "",
    accessibilityHint: "Hint",
    accessibilityValue: { now: 0, text: "" },
  })
  await act(() => release?.())
  expect(screen.getByTestId("target").props.nativeDescriptionTag).toBe(0)
})

it("keeps explicit owned tag/empty caption overrides authoritative over an automatic description", async () => {
  const target = createRef<View>(),
    description = createRef<View>()
  await render(
    <>
      <NativeFocusHost testID="target" ref={target} nativeDescriptionTag={0} nativeDescriptionLabel="" />
      <View ref={description} />
    </>,
  )
  let release: ReturnType<typeof bindNativeDescription>
  await act(() => {
    release = bindNativeDescription(target.current, description.current, "Description")
  })
  expect(screen.getByTestId("target").props.nativeDescriptionTag).toBe(0)
  expect(screen.getByTestId("target").props.nativeDescriptionLabel).toBe("")
  await act(() => release?.())
})

it("restores the previous live binding when the latest retires and ignores duplicate cleanup", async () => {
  const { target, description } = await targets()
  const update = jest.fn()
  const unregister = registerNativeDescriptionSource(target, update)
  const first = bindNativeDescription(target, description, "First")!
  jest.mocked(ReactNative.findNodeHandle).mockReturnValue(72)
  const second = bindNativeDescription(target, description, "Second")!
  expect(update).toHaveBeenLastCalledWith({ tag: 72, label: "Second" })
  second()
  expect(update).toHaveBeenLastCalledWith({ tag: 71, label: "First" })
  first()
  expect(update).toHaveBeenLastCalledWith(null)
  const count = update.mock.calls.length
  first()
  second()
  expect(update).toHaveBeenCalledTimes(count)
  unregister()
})

it("does not let stale binding cleanup clear a newer description", async () => {
  const { target, description } = await targets()
  const update = jest.fn()
  const unregister = registerNativeDescriptionSource(target, update)
  const old = bindNativeDescription(target, description, "Old")!
  const current = bindNativeDescription(target, description, "Current")!
  old()
  expect(update).toHaveBeenLastCalledWith({ tag: 71, label: "Current" })
  current()
  unregister()
})

it("preserves the live description across a callback-ref handoff on the same actual target", async () => {
  const target = createRef<View>(),
    next = createRef<View>(),
    description = createRef<View>()
  const node = (ref = target) => (
    <>
      <NativeFocusHost testID="target" ref={ref} />
      <View ref={description} />
    </>
  )
  await render(node())
  const actual = target.current
  let release: ReturnType<typeof bindNativeDescription>
  await act(() => {
    release = bindNativeDescription(actual, description.current, "Details")
  })
  await screen.rerender(node(next))
  expect(next.current).toBe(actual)
  expect(screen.getByTestId("target").props.nativeDescriptionTag).toBe(71)
  await act(() => release?.())
  expect(screen.getByTestId("target").props.nativeDescriptionTag).toBe(0)
})

it("retires updates when the owned host detaches without admitting generic View or editor targets", async () => {
  const { target, description } = await targets()
  expect(bindNativeDescription(target, description, "Unavailable")).toBeUndefined()
  expect(ReactNative.findNodeHandle).not.toHaveBeenCalled()
  const update = jest.fn()
  const unregister = registerNativeDescriptionSource(target, update)
  const release = bindNativeDescription(target, description, "Live")!
  unregister()
  const count = update.mock.calls.length
  expect(bindNativeDescription(target, description, "Retired")).toBeUndefined()
  release()
  expect(update).toHaveBeenCalledTimes(count)
})

it.each([null, 0, -1, Number.NaN, 1.5])("rejects unavailable native description tag %s", async (tag) => {
  const { target, description } = await targets()
  const update = jest.fn()
  const unregister = registerNativeDescriptionSource(target, update)
  jest.mocked(ReactNative.findNodeHandle).mockReturnValue(tag)
  expect(bindNativeDescription(target, description, "Description")).toBeUndefined()
  expect(update).toHaveBeenCalledTimes(1)
  expect(update).toHaveBeenLastCalledWith(null)
  unregister()
})
