import type { View } from "react-native"

const inspectors = new WeakMap<View, () => void>()

export const registerNativeAccessibilityInspector = (target: View, inspect: () => void) => {
  inspectors.set(target, inspect)
  return () => {
    if (inspectors.get(target) === inspect) inspectors.delete(target)
  }
}

// Private maintained-scene/native acceptance hook; the command still checks the mounted native owner.
export const inspectNativeAccessibility = (target: View | null): boolean => {
  const inspect = target && inspectors.get(target)
  if (!inspect) return false
  inspect()
  return true
}
