import { useEffect, useState } from "react"
import { Animated, Easing } from "react-native"

import { useNativeLoaderReducedMotion } from "../Loaders/motion"

export const useNativeCircularOffset = (target: number | undefined) => {
  const reduced = useNativeLoaderReducedMotion()
  const [offset] = useState(() => new Animated.Value(target ?? 0))
  useEffect(() => {
    offset.stopAnimation()
    if (reduced || target === undefined) {
      offset.setValue(target ?? 0)
      return
    }
    const animation = Animated.timing(offset, {
      toValue: target,
      duration: 350,
      easing: Easing.bezier(0.42, 0, 0.58, 1),
      useNativeDriver: false,
      isInteraction: false,
    })
    animation.start()
    return () => animation.stop()
  }, [offset, target, reduced])
  return reduced ? (target ?? 0) : offset
}
