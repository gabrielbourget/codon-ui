import { useEffect, useState } from "react"
import { AccessibilityInfo, Animated, Easing } from "react-native"

export const useRangeAnimation = (percentage: number | undefined) => {
  const [reduceMotion, setReduceMotion] = useState(true)
  const [fill] = useState(() => new Animated.Value(percentage ?? 0))

  useEffect(() => {
    let active = true
    let preferenceChanged = false
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
      preferenceChanged = true
      if (active) setReduceMotion(enabled)
    })
    void AccessibilityInfo.isReduceMotionEnabled().then(
      (enabled) => {
        if (active && !preferenceChanged) setReduceMotion(enabled)
      },
      () => undefined,
    )
    return () => {
      active = false
      subscription.remove()
    }
  }, [])

  useEffect(() => {
    fill.stopAnimation()
    if (reduceMotion || percentage === undefined) {
      fill.setValue(percentage ?? 0)
      return
    }
    const animation = Animated.timing(fill, {
      toValue: percentage,
      duration: 250,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    })
    animation.start()
    return () => animation.stop()
  }, [fill, percentage, reduceMotion])

  return {
    animatedFill: fill.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"], extrapolate: "clamp" }),
    reduceMotion,
  }
}
