import { useEffect, useRef, useState } from "react"
import { Animated, Easing } from "react-native"

import { useNativeTheme } from "../../theme"
import { useNativeLoaderReducedMotion } from "../Loaders/motion"

import {
  getNativeCarouselDotMotionTarget,
  getNativeCarouselDotStyle,
  type TNativeCarouselDotVariant,
} from "./dotsModel"

const EASE = Easing.bezier(0.25, 0.1, 0.25, 1)

const useNativeCarouselDotScalar = (target: number, reduced: boolean) => {
  const [value] = useState(() => new Animated.Value(target))
  const previous = useRef(target)
  useEffect(() => {
    const oldTarget = previous.current
    previous.current = target
    let animation: Animated.CompositeAnimation | undefined
    if (reduced) value.setValue(target)
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
  }, [value, target, reduced])
  return reduced ? target : value
}

// Selection, focus modality and activation belong to the eventual native radio target.
export const NativeCarouselDotVisual = ({
  variant,
  raised = false,
  focusVisible = false,
  testID,
}: {
  variant: TNativeCarouselDotVariant
  raised?: boolean
  focusVisible?: boolean
  testID?: string
}) => {
  const theme = useNativeTheme()
  const reduced = useNativeLoaderReducedMotion()
  const target = getNativeCarouselDotMotionTarget(variant)
  const scale = useNativeCarouselDotScalar(target.scale, reduced)
  const opacity = useNativeCarouselDotScalar(target.opacity, reduced)
  return (
    <Animated.View
      testID={testID}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[
        getNativeCarouselDotStyle(theme, variant, raised),
        focusVisible ? { outlineWidth: 1, outlineColor: theme.colors.focusRing, outlineOffset: 2 } : undefined,
        { opacity, transform: [{ scale }] },
      ]}
    />
  )
}
