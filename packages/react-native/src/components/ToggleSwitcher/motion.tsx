import { useEffect, useRef, useState } from "react"
import { AccessibilityInfo, Animated, Easing, type ViewStyle } from "react-native"

export type TNativeSwitcherFrame = Readonly<{ x: number; y: number; width: number; height: number }>
export type TNativeSwitcherMotion = {
  x: Animated.Value
  y: Animated.Value
  opacity: Animated.Value
  scale: Animated.Value
  basis: TNativeSwitcherFrame | undefined
}
// Values outlive the selected option so replacement surfaces retain the stopped native position.
export const useNativeSwitcherMotion = () =>
  useState<TNativeSwitcherMotion>(() => ({
    x: new Animated.Value(0),
    y: new Animated.Value(0),
    opacity: new Animated.Value(1),
    scale: new Animated.Value(1),
    basis: undefined,
  }))[0]
const EASE = Easing.bezier(0.42, 0, 0.58, 1)

export const useNativeSwitcherReducedMotion = () => {
  const [reduced, setReduced] = useState(true)
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
  return reduced
}

export const NativeSwitcherSurface = ({
  frame,
  motion,
  reduced,
  style,
  identity,
}: {
  frame: TNativeSwitcherFrame | undefined
  motion: TNativeSwitcherMotion
  reduced: boolean
  style: ViewStyle
  identity: string
}) => {
  const { x, y, opacity, scale } = motion
  const initialized = useRef(false)
  useEffect(() => {
    let active = true
    let animation: Animated.CompositeAnimation | undefined
    const old = motion.basis ?? frame
    const entrance = !initialized.current
    if (!frame || !old)
      return () => {
        active = false
      }
    if (reduced) {
      for (const value of [x, y, opacity, scale]) value.stopAnimation()
      x.setValue(0)
      y.setValue(0)
      opacity.setValue(1)
      scale.setValue(1)
      if (frame) {
        motion.basis = frame
        initialized.current = true
      }
      return
    }
    let currentX: number | undefined,
      currentY: number | undefined,
      currentOpacity: number | undefined,
      currentScale: number | undefined
    const start = () => {
      if (
        !active ||
        currentX === undefined ||
        currentY === undefined ||
        currentOpacity === undefined ||
        currentScale === undefined
      )
        return
      const deltaX = currentX + old.x - frame.x
      const deltaY = currentY + old.y - frame.y
      x.setValue(deltaX)
      y.setValue(deltaY)
      motion.basis = frame
      initialized.current = true
      if (entrance) {
        opacity.setValue(0)
        scale.setValue(0.92)
      }
      if (!entrance && deltaX === 0 && deltaY === 0 && currentOpacity === 1 && currentScale === 1) return
      animation = Animated.parallel([
        ...[x, y].map((value) =>
          Animated.timing(value, {
            toValue: 0,
            duration: 250,
            easing: EASE,
            useNativeDriver: true,
            isInteraction: false,
          }),
        ),
        ...[opacity, scale].map((value) =>
          Animated.timing(value, {
            toValue: 1,
            duration: 250,
            easing: EASE,
            useNativeDriver: true,
            isInteraction: false,
          }),
        ),
      ])
      animation.start()
    }
    opacity.stopAnimation((value) => {
      if (active) {
        currentOpacity = value
        start()
      }
    })
    scale.stopAnimation((value) => {
      if (active) {
        currentScale = value
        start()
      }
    })
    x.stopAnimation((value) => {
      if (active) {
        currentX = value
        start()
      }
    })
    y.stopAnimation((value) => {
      if (active) {
        currentY = value
        start()
      }
    })
    return () => {
      active = false
      animation?.stop()
      for (const value of [x, y, opacity, scale]) value.stopAnimation()
    }
  }, [frame?.x, frame?.y, reduced, x, y, opacity, scale])
  return (
    <Animated.View
      testID={identity + "-selected-surface"}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[
        { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
        style,
        { opacity: frame ? opacity : 0, transform: [{ translateX: x }, { translateY: y }, { scale }] },
      ]}
    />
  )
}
