import { Platform } from "react-native"

import NativeDefaults from "./specs/NativeCUIEditorKeyboardDefaults"

type TFieldFocusRuntime = typeof globalThis & {
  __cuiNativeFieldInputMoveFocus?: (lease: string, request: string) => string
}

// Android's generated Java method has no current JSI runtime. The supported
// bindings installer supplies this private runtime entry, not a feature flag.
export const getNativeFieldInputModule = () => {
  const native = NativeDefaults
  if (!native) throw new Error("native-field-input-module-unavailable")
  const lease = native.getLease()
  const move = Platform.OS === "android" ? (globalThis as TFieldFocusRuntime).__cuiNativeFieldInputMoveFocus : null
  if (!lease || (Platform.OS === "android" && typeof move !== "function"))
    throw new Error("native-field-input-runtime-unavailable")
  return {
    getLease: () => native.getLease(),
    acceptsField: (request: string) => native.acceptsField(request),
    settleField: (request: string) => native.settleField(request),
    moveFieldFocus: (request: string) => (move ? move(lease, request) : native.moveFieldFocus(request)),
  }
}
