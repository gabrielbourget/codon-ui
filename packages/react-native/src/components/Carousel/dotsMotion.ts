import { useEffect, useRef, useState } from "react"
import { Animated, Easing } from "react-native"

const EASE = Easing.bezier(0.25, 0.1, 0.25, 1)

export const useNativeCarouselDotScalar = (target: number, reduced: boolean, immediate = false) => {
  const [value] = useState(() => new Animated.Value(target))
  const previous = useRef(target)
  useEffect(() => {
    const oldTarget = previous.current
    previous.current = target
    let animation: Animated.CompositeAnimation | undefined
    if (reduced || immediate) value.setValue(target)
    else if (oldTarget !== target)
      animation = Animated.timing(value, {
        toValue: target,
        duration: 250,
        easing: EASE,
        useNativeDriver: true,
        isInteraction: false,
      })
    animation?.start()
    return () => {
      animation?.stop()
      value.stopAnimation()
    }
  }, [value, target, reduced, immediate])
  return reduced || immediate ? target : value
}
