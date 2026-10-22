import { Platform } from "react-native"

import { getNativeFieldInputModule } from "../fieldInputModule"
import NativeDefaults from "../specs/NativeCUIEditorKeyboardDefaults"

jest.mock("../specs/NativeCUIEditorKeyboardDefaults", () => ({
  __esModule: true,
  default: {
    getLease: jest.fn(() => "module:1"),
    acceptsField: jest.fn(() => true),
    settleField: jest.fn(() => true),
    moveFieldFocus: jest.fn(() => "original-result"),
  },
}))
type TRuntime = typeof globalThis & { __cuiNativeFieldInputMoveFocus?: (lease: string, request: string) => string }
const runtime = globalThis as TRuntime
const initial = runtime.__cuiNativeFieldInputMoveFocus
afterEach(() => {
  jest.restoreAllMocks()
  jest.clearAllMocks()
  runtime.__cuiNativeFieldInputMoveFocus = initial
})

it("uses the native current-runtime method on UIKit and preserves exact request/result data", () => {
  jest.replaceProperty(Platform, "OS", "ios")
  const native = getNativeFieldInputModule()
  expect(native.moveFieldFocus("original-request")).toBe("original-result")
  expect(NativeDefaults?.moveFieldFocus).toHaveBeenCalledWith("original-request")
  expect(native.acceptsField("accept")).toBe(true)
  expect(native.settleField("settle")).toBe(true)
})

it("uses only the installed current-runtime entry with its exact module lease on Android", () => {
  jest.replaceProperty(Platform, "OS", "android")
  const move = jest.fn(() => "runtime-result")
  runtime.__cuiNativeFieldInputMoveFocus = move
  const native = getNativeFieldInputModule()
  expect(native.moveFieldFocus("original-request")).toBe("runtime-result")
  expect(move).toHaveBeenCalledWith("module:1", "original-request")
  expect(NativeDefaults?.moveFieldFocus).not.toHaveBeenCalled()
})

it("rejects a missing Android runtime binding instead of substituting the generated Java method", () => {
  jest.replaceProperty(Platform, "OS", "android")
  delete runtime.__cuiNativeFieldInputMoveFocus
  expect(getNativeFieldInputModule).toThrow("native-field-input-runtime-unavailable")
  expect(NativeDefaults?.moveFieldFocus).not.toHaveBeenCalled()
})
