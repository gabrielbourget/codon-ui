import type { TextInput, View } from "react-native"
// @ts-expect-error RN0.86.3 publishes this inspected registry without TypeScript declarations.
import upstreamTextInputState from "react-native/Libraries/Components/TextInput/TextInputState"

type TTarget = View | TextInput
const textInputState: Readonly<{
  isTextInput: (target: TTarget) => boolean
  currentlyFocusedInput: () => TextInput | null
}> = upstreamTextInputState
type TBinding = Readonly<{
  focus: () => void
  focusContainer?: () => void
  blur: () => void
  canFocus: () => boolean
  // An owned control can retain SDK focus while refusing new focus requests.
  canObserveFocus?: () => boolean
  window?: () => string
}>
const bindings = new WeakMap<TTarget, TBinding>()
const focusObservers = new Set<() => void>()
let observedFocus: TTarget | null = null
let previousFocus: TTarget | null = null
const publishFocus = () => {
  for (const observer of [...focusObservers]) observer()
}

export const getNativeFocusedTarget = (): TTarget | null => {
  const input = textInputState.currentlyFocusedInput()
  if (input && textInputState.isTextInput(input)) return input
  if (observedFocus) {
    const binding = bindings.get(observedFocus)
    if (binding && (binding.canObserveFocus?.() ?? binding.canFocus())) return observedFocus
  }
  return null
}
export const getNativeFocusTargetWindow = (target: TTarget) => bindings.get(target)?.window?.()
export const captureNativeFocusTarget = (target: TTarget): (() => boolean) | null => {
  const binding = bindings.get(target)
  if (binding) {
    if (!binding.canFocus()) return null
    const window = binding.window?.()
    return () => bindings.get(target) === binding && binding.canFocus() && binding.window?.() === window
  }
  return textInputState.isTextInput(target) ? () => textInputState.isTextInput(target) : null
}
export const getNativePreviousFocusTarget = (): TTarget | null =>
  previousFocus && bindings.get(previousFocus)?.canFocus() ? previousFocus : null
export const subscribeNativeFocus = (observer: () => void) => {
  focusObservers.add(observer)
  return () => {
    focusObservers.delete(observer)
  }
}
export const observeNativeFocus = (target: TTarget, focused: boolean) => {
  const binding = bindings.get(target)
  if (!binding || (focused && !(binding.canObserveFocus?.() ?? binding.canFocus()))) return
  if (focused) {
    if (observedFocus === target) return
    previousFocus = observedFocus ?? previousFocus
    observedFocus = target
  } else {
    if (observedFocus !== target) return
    previousFocus = target
    observedFocus = null
  }
  publishFocus()
}
export const retireNativeFocusObservation = (target: TTarget) => {
  const changed = observedFocus === target || previousFocus === target
  if (observedFocus === target) observedFocus = null
  if (previousFocus === target) previousFocus = null
  if (changed) publishFocus()
}

export const isNativeFocusTarget = (target: object | null): target is TTarget =>
  target !== null && (bindings.has(target as TTarget) || textInputState.isTextInput(target as TTarget))

export const registerNativeFocusTarget = (target: TTarget, binding: TBinding) => {
  bindings.set(target, binding)
  return () => {
    if (bindings.get(target) === binding) bindings.delete(target)
    if (!bindings.has(target)) retireNativeFocusObservation(target)
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
export const focusNativeContainer = (target: TTarget | null): boolean => {
  if (!target) return false
  const binding = bindings.get(target)
  if (!binding || !binding.canFocus()) return false
  const requestFocus = binding.focusContainer ?? binding.focus
  requestFocus()
  return true
}
export const blurNativeTarget = (target: TTarget | null): boolean => request(target, "blur")

// Pinned RN ReadOnlyNode childNodes are original native hosts, not a JS hierarchy mirror.
export const containsNativeView = (root: View, target: TTarget): boolean => {
  const visited = new Set<object>()
  const contains = (node: object): boolean => {
    if (node === target) return true
    if (visited.has(node)) return false
    visited.add(node)
    for (const child of (node as { readonly childNodes?: Iterable<object> }).childNodes ?? [])
      if (contains(child)) return true
    return false
  }
  return contains(root)
}
