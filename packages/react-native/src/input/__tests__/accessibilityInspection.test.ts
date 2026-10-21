import type { NativeSyntheticEvent, View } from "react-native"

import {
  inspectNativeAccessibility,
  receiveNativeAccessibilityInspection,
  registerNativeAccessibilityInspector,
} from "../accessibilityInspection"
import type { NativeAccessibilityData } from "../specs/CUIFocusViewNativeComponent"

const target = () => ({}) as View
const snapshot = () =>
  ({ nativeEvent: { collection: "actual SDK read" } }) as NativeSyntheticEvent<NativeAccessibilityData>

it("delivers the original SDK packet once to the requested actual receiver", () => {
  const view = target()
  const other = target()
  const inspect = jest.fn()
  const receive = jest.fn()
  const release = registerNativeAccessibilityInspector(view, inspect)
  const event = snapshot()
  expect(inspectNativeAccessibility(null, receive)).toBe(false)
  expect(inspectNativeAccessibility(other, receive)).toBe(false)
  expect(inspectNativeAccessibility(view, receive)).toBe(true)
  expect(inspect).toHaveBeenCalledTimes(1)
  receiveNativeAccessibilityInspection(other, event)
  expect(receive).not.toHaveBeenCalled()
  receiveNativeAccessibilityInspection(view, event)
  expect(receive.mock.calls).toEqual([[event]])
  expect(receive.mock.calls[0][0]).toBe(event)
  receiveNativeAccessibilityInspection(view, snapshot())
  expect(receive).toHaveBeenCalledTimes(1)
  release()
  expect(inspectNativeAccessibility(view)).toBe(false)
})

it("retires a pending receiver without letting old cleanup remove its replacement", () => {
  const view = target()
  const first = jest.fn()
  const release = registerNativeAccessibilityInspector(view, () => {})
  inspectNativeAccessibility(view, first)
  const second = jest.fn()
  const releaseReplacement = registerNativeAccessibilityInspector(view, () => {})
  release()
  inspectNativeAccessibility(view, second)
  receiveNativeAccessibilityInspection(view, snapshot())
  expect(first).not.toHaveBeenCalled()
  expect(second).toHaveBeenCalledTimes(1)
  releaseReplacement()
})

it("keeps command-only callers and drops pending delivery when the command fails", () => {
  const view = target()
  const receive = jest.fn()
  const error = new Error("retired command")
  const release = registerNativeAccessibilityInspector(view, () => {
    throw error
  })
  expect(() => inspectNativeAccessibility(view, receive)).toThrow(error)
  receiveNativeAccessibilityInspection(view, snapshot())
  expect(receive).not.toHaveBeenCalled()
  release()
  const inspect = jest.fn()
  const stop = registerNativeAccessibilityInspector(view, inspect)
  expect(inspectNativeAccessibility(view)).toBe(true)
  receiveNativeAccessibilityInspection(view, snapshot())
  expect(inspect).toHaveBeenCalledTimes(1)
  stop()
})
