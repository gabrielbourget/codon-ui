import { Animated } from "react-native"

import { useNativeTheme } from "../../theme"
import { useNativeLoaderReducedMotion } from "../Loaders/motion"

import {
  getNativeCarouselDotMotionTarget,
  getNativeCarouselDotStyle,
  type TNativeCarouselDotVariant,
} from "./dotsModel"
import { useNativeCarouselDotScalar } from "./dotsMotion"

// Selection, focus modality and activation belong to the eventual native radio target.
export const NativeCarouselDotVisual = ({
  variant,
  raised = false,
  focusVisible = false,
  shrink = false,
  testID,
}: {
  variant: TNativeCarouselDotVariant
  raised?: boolean
  focusVisible?: boolean
  shrink?: boolean
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
        { flexShrink: shrink ? 1 : 0 },
        focusVisible ? { outlineWidth: 1, outlineColor: theme.colors.focusRing, outlineOffset: 2 } : undefined,
        { opacity, transform: [{ scale }] },
      ]}
    />
  )
}
