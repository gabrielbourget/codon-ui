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

export const takeNativeFieldInputRecords = (): Readonly<{
  records: readonly Record<string, unknown>[]
  dropped: number
}> => {
  if (!NativeDefaults?.getLease()) throw new Error("native-field-input-module-unavailable")
  const batch = JSON.parse(NativeDefaults.takeFieldRecords()) as { records?: unknown; dropped?: unknown }
  if (
    !batch ||
    typeof batch !== "object" ||
    Object.keys(batch).length !== 2 ||
    !Array.isArray(batch.records) ||
    typeof batch.dropped !== "number" ||
    !Number.isSafeInteger(batch.dropped) ||
    batch.dropped < 0
  )
    throw new Error("native-field-input-receipts-invalid")
  const records = batch.records.map((encoded: unknown) => {
    if (typeof encoded !== "string") throw new Error("native-field-input-receipts-invalid")
    const record = JSON.parse(encoded) as unknown
    if (!record || typeof record !== "object" || Array.isArray(record))
      throw new Error("native-field-input-receipts-invalid")
    return Object.freeze(record as Record<string, unknown>)
  })
  return Object.freeze({ records: Object.freeze(records), dropped: batch.dropped })
}
