import { useEffect, useRef, useState } from "react"
import { AccessibilityInfo, Animated, Easing, processColor, type ColorValue } from "react-native"

const linkColorEasing = Easing.bezier(0, 0, 0.58, 1)

export const useNativeLinkColor = (target: ColorValue, duration = 125, easing = linkColorEasing) => {
  const [reduced, setReduced] = useState(true)
  const [rendered, setRendered] = useState(target)
  const current = useRef(target)
  const [progress] = useState(() => new Animated.Value(0))
  useEffect(() => {
    let active = true
    let changed = false
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
      changed = true
      if (active) setReduced(value)
    })
    void AccessibilityInfo.isReduceMotionEnabled().then(
      (value) => {
        if (active && !changed) setReduced(value)
      },
      () => undefined,
    )
    return () => {
      active = false
      subscription.remove()
    }
  }, [])
  useEffect(() => {
    const from = processColor(current.current)
    const to = processColor(target)
    if (reduced || typeof from !== "number" || typeof to !== "number" || from === to) {
      current.current = target
      setRendered(target)
      return
    }
    let active = true
    progress.setValue(0)
    const listener = progress.addListener(({ value }) => {
      if (!active) return
      const channel = (shift: number) => ((from >>> shift) & 255) * (1 - value) + ((to >>> shift) & 255) * value
      const color = `rgba(${channel(16)}, ${channel(8)}, ${channel(0)}, ${channel(24) / 255})`
      current.current = color
      setRendered(color)
    })
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      easing,
      useNativeDriver: false,
      isInteraction: false,
    })
    animation.start(({ finished }) => {
      if (!active || !finished) return
      current.current = target
      setRendered(target)
    })
    return () => {
      active = false
      animation.stop()
      progress.removeListener(listener)
    }
  }, [target, reduced, progress, duration, easing])
  return reduced || typeof processColor(target) !== "number" ? target : rendered
}
