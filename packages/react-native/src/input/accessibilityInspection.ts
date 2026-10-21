import type { NativeSyntheticEvent, View } from "react-native"

import type { NativeAccessibilityData } from "./specs/CUIFocusViewNativeComponent"

type TSnapshot = NativeSyntheticEvent<NativeAccessibilityData>
type TInspector = { inspect: () => void; receive?: (event: TSnapshot) => void }
const inspectors = new WeakMap<View, TInspector>()

export const registerNativeAccessibilityInspector = (target: View, inspect: () => void) => {
  const entry: TInspector = { inspect }
  inspectors.set(target, entry)
  return () => {
    if (inspectors.get(target) === entry) inspectors.delete(target)
  }
}

// Private maintained-scene/native acceptance hook; the command still checks the mounted native owner.
export const inspectNativeAccessibility = (target: View | null, receive?: (event: TSnapshot) => void): boolean => {
  const entry = target && inspectors.get(target)
  if (!entry) return false
  entry.receive = receive
  try {
    entry.inspect()
  } catch (error) {
    entry.receive = undefined
    throw error
  }
  return true
}

export const receiveNativeAccessibilityInspection = (target: View, event: TSnapshot) => {
  const entry = inspectors.get(target)
  const receive = entry?.receive
  if (entry) entry.receive = undefined
  receive?.(event)
}
