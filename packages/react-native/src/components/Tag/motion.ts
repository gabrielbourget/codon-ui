import { useEffect, useRef, useState } from "react"
import { AccessibilityInfo, Animated, Easing, processColor, type ColorValue } from "react-native"

import { AVAILABLE_NATIVE_TAG_EASINGS, type TNativeTagDuration, type TNativeTagTransition } from "./types"

const EASINGS = {
  linear: Easing.linear,
  ease: Easing.bezier(0.25, 0.1, 0.25, 1),
  "ease-in": Easing.bezier(0.42, 0, 1, 1),
  "ease-out": Easing.bezier(0, 0, 0.58, 1),
  "ease-in-out": Easing.bezier(0.42, 0, 0.58, 1),
}
type TNativeColorNode = Omit<Animated.AnimatedColor, "stopAnimation"> & {
  stopAnimation: (callback?: (value: ColorValue) => void) => void
}
// Match the pinned runtime's Color alias and optional stop callback, omitted by its declarations.
const NativeColor = (Animated as typeof Animated & { Color: new (value?: ColorValue) => TNativeColorNode }).Color
const milliseconds = (value: TNativeTagDuration) => {
  const match =
    typeof value === "string" ? /^([+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*(ms|s)$/i.exec(value.trim()) : undefined
  const duration =
    typeof value === "number" ? value : match ? Number(match[1]) * (match[2].toLowerCase() === "s" ? 1000 : 1) : NaN
  if (!Number.isFinite(duration) || duration < 0)
    throw new TypeError("Tag: transition timing must be finite and nonnegative in ms/s")
  return duration
}
export const resolveNativeTagTransition = (value: TNativeTagTransition = 250) => {
  const options = typeof value === "object" ? value : { duration: value }
  const easing = options.easing ?? "ease-in-out"
  if (!AVAILABLE_NATIVE_TAG_EASINGS.includes(easing)) throw new TypeError("Tag: unsupported transition easing")
  return {
    duration: milliseconds(options.duration ?? 250),
    delay: milliseconds(options.delay ?? 0),
    easing: EASINGS[easing],
  }
}
type TTiming = ReturnType<typeof resolveNativeTagTransition>

export const useNativeTagReducedMotion = (enabled = true) => {
  const [reduced, setReduced] = useState(true)
  useEffect(() => {
    if (!enabled) return
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
  }, [enabled])
  return !enabled || reduced
}

const rgba = (value: number) => ({
  r: (value >>> 16) & 255,
  g: (value >>> 8) & 255,
  b: value & 255,
  a: (value >>> 24) / 255,
})

export const useNativeTagColor = (
  target: ColorValue | undefined,
  timing: TTiming,
  reduced: boolean,
  observe = false,
) => {
  const [value] = useState(() => new NativeColor(target))
  const [rendered, setRendered] = useState(target)
  const initialColor = processColor(target)
  const observed = useRef(rgba(typeof initialColor === "number" ? initialColor : 0xff000000))
  useEffect(() => {
    if (!observe) return
    // An unbound Color node does not attach its channel graph; observing public channels keeps inherited Text in sync.
    const listeners = (["r", "g", "b", "a"] as const).map((channel) => {
      const id = value[channel].addListener(({ value: current }) => {
        observed.current = { ...observed.current, [channel]: current }
        const { r, g, b, a } = observed.current
        setRendered(`rgba(${r}, ${g}, ${b}, ${a})`)
      })
      return () => value[channel].removeListener(id)
    })
    return () => listeners.forEach((remove) => remove())
  }, [value, observe])
  useEffect(() => {
    let active = true
    let animation: Animated.CompositeAnimation | undefined
    value.stopAnimation((current) => {
      if (!active || target === undefined) return
      const from = processColor(current)
      const to = processColor(target)
      if (
        reduced ||
        (timing.duration === 0 && timing.delay === 0) ||
        typeof from !== "number" ||
        typeof to !== "number" ||
        from === to
      ) {
        value.setValue(target)
        return
      }
      value.setValue(current)
      const channels = rgba(to)
      animation = Animated.parallel(
        (["r", "g", "b", "a"] as const).map((channel) =>
          Animated.timing(value[channel], {
            toValue: channels[channel],
            ...timing,
            useNativeDriver: false,
            isInteraction: false,
          }),
        ),
      )
      animation.start()
    })
    return () => {
      active = false
      animation?.stop()
      value.stopAnimation()
    }
  }, [value, target, timing.duration, timing.delay, timing.easing, reduced])
  const animated = !reduced && (timing.duration > 0 || timing.delay > 0) && typeof processColor(target) === "number"
  // RN 0.86 accepts Color nodes in Animated styles, but WithAnimatedValue omits this runtime-supported node type.
  const hostValue = animated ? (value as unknown as Animated.WithAnimatedValue<ColorValue>) : target
  return { value: hostValue, rendered: animated && observe ? rendered : target }
}

export const useNativeTagNumber = (target: number | undefined, timing: TTiming, reduced: boolean) => {
  const [value] = useState(() => new Animated.Value(target ?? 0))
  useEffect(() => {
    let active = true
    let animation: Animated.CompositeAnimation | undefined
    value.stopAnimation((current) => {
      if (!active || target === undefined) return
      if (reduced || current === target || (timing.duration === 0 && timing.delay === 0)) {
        value.setValue(target)
        return
      }
      animation = Animated.timing(value, { toValue: target, ...timing, useNativeDriver: false, isInteraction: false })
      animation.start()
    })
    return () => {
      active = false
      animation?.stop()
      value.stopAnimation()
    }
  }, [value, target, timing.duration, timing.delay, timing.easing, reduced])
  return target === undefined || reduced || (timing.duration === 0 && timing.delay === 0) ? target : value
}
