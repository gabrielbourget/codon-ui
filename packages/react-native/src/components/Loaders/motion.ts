import { useEffect, useState } from "react"
import { AccessibilityInfo, Animated } from "react-native"

import { LOADER_TIME_UNITS, type TNativeLoaderDuration } from "./types"

export const resolveNativeLoaderDuration = (value: TNativeLoaderDuration, component: string) => {
  let milliseconds: number
  if (typeof value === "number") milliseconds = value
  else {
    const match = /^([+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*(ms|s)$/i.exec(value.trim())
    if (!match) throw new TypeError(component + ": duration must be milliseconds or an s/ms time")
    const unit = LOADER_TIME_UNITS.find((candidate) => candidate === match[2].toLowerCase())
    if (!unit) throw new TypeError(component + ": unsupported duration unit")
    milliseconds = Number(match[1]) * (unit === "s" ? 1000 : 1)
  }
  if (!Number.isFinite(milliseconds) || milliseconds < 0)
    throw new TypeError(component + ": duration must be finite and nonnegative")
  return milliseconds
}

export const useNativeLoaderReducedMotion = () => {
  const [reduced, setReduced] = useState(true)
  useEffect(() => {
    let active = true
    let changed = false
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
      changed = true
      if (active) setReduced(enabled)
    })
    void AccessibilityInfo.isReduceMotionEnabled().then(
      (enabled) => {
        if (active && !changed) setReduced(enabled)
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

export const useNativeLoaderLoop = (
  duration: number,
  delay: number,
  easing: (value: number) => number,
  enabled: boolean,
  roundTrip = false,
) => {
  const [phase] = useState(() => new Animated.Value(0))
  useEffect(() => {
    phase.stopAnimation()
    phase.setValue(0)
    if (!enabled || duration === 0) return
    const outward = Animated.timing(phase, {
      toValue: 1,
      duration: roundTrip ? duration / 2 : duration,
      easing,
      useNativeDriver: true,
      isInteraction: false,
    })
    const iteration = roundTrip
      ? Animated.sequence([
          outward,
          Animated.timing(phase, {
            toValue: 0,
            duration: duration / 2,
            easing,
            useNativeDriver: true,
            isInteraction: false,
          }),
        ])
      : outward
    const loop = Animated.loop(iteration)
    const animation =
      delay > 0
        ? Animated.sequence([
            Animated.timing(phase, { toValue: 0, duration: 0, delay, useNativeDriver: true, isInteraction: false }),
            loop,
          ])
        : loop
    animation.start()
    return () => {
      animation.stop()
      phase.stopAnimation()
    }
  }, [phase, duration, delay, easing, enabled, roundTrip])
  return phase
}
