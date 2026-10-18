import type { TextInput, View } from "react-native"
// @ts-expect-error RN0.86.3 publishes this inspected registry without TypeScript declarations.
import upstreamTextInputState from "react-native/Libraries/Components/TextInput/TextInputState"

type TTarget = View | TextInput
const textInputState: Readonly<{ isTextInput: (target: TTarget) => boolean }> = upstreamTextInputState
type TBinding = Readonly<{ focus: () => void; blur: () => void; canFocus: () => boolean }>
const bindings = new WeakMap<TTarget, TBinding>()

export const isNativeFocusTarget = (target: object | null): target is TTarget =>
  target !== null && (bindings.has(target as TTarget) || textInputState.isTextInput(target as TTarget))

export const registerNativeFocusTarget = (target: TTarget, binding: TBinding) => {
  bindings.set(target, binding)
  return () => {
    if (bindings.get(target) === binding) bindings.delete(target)
  }
}

const request = (target: TTarget | null, action: "focus" | "blur") => {
  if (target === null) return false
  const binding = bindings.get(target)
  if (binding) {
    if (action === "focus" && !binding.canFocus()) return false
    binding[action]()
    return true
  }
  if (!textInputState.isTextInput(target)) return false
  target[action]()
  return true
}

// Admission is synchronous; completion is acknowledged by the target's native focus event.
export const focusNativeTarget = (target: TTarget | null): boolean => request(target, "focus")
export const blurNativeTarget = (target: TTarget | null): boolean => request(target, "blur")
