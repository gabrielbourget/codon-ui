import { useEffect, useState } from "react"
import { AccessibilityInfo } from "react-native"

import { useNativeMotionConfig } from "./NativeMotionConfig"

export const useNativeMotionReducedMotion = () => {
  const { reducedMotion } = useNativeMotionConfig()
  const [preference, setPreference] = useState(true)
  useEffect(() => {
    let active = true
    let changed = false
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
      changed = true
      if (active) setPreference(value)
    })
    void AccessibilityInfo.isReduceMotionEnabled().then(
      (value) => {
        if (active && !changed) setPreference(value)
      },
      () => undefined,
    )
    return () => {
      active = false
      subscription.remove()
    }
  }, [])
  return reducedMotion === "never" ? false : reducedMotion === "always" ? true : preference
}
