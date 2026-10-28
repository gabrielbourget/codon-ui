import type { View } from "react-native"

import type { TNativeActivationPacket } from "./NativeFocusView"

type TNativeActivationPolicy = (target: View, event: TNativeActivationPacket) => boolean
const policies = new Map<object, TNativeActivationPolicy>()

// Policies consume one original owned-host activation before its default callback.
export const registerNativeActivationPolicy = (policy: TNativeActivationPolicy) => {
  const owner = {}
  policies.set(owner, policy)
  return () => {
    policies.delete(owner)
  }
}
export const dispatchNativeActivationPolicy = (target: View, event: TNativeActivationPacket) => {
  for (const policy of [...policies.values()].reverse()) if (policy(target, event)) return true
  return false
}
