import { forwardRef, useEffect, useRef, useState, type ComponentPropsWithoutRef } from "react"
import { Animated, StyleSheet, type View, type ViewStyle } from "react-native"

import { resolveNativeTagTransition, useNativeTagColor, useNativeTagReducedMotion } from "../../components/Tag/motion"
import { NativeFocusHost } from "../../input/NativeFocusView"
import { mix } from "../../motion/kernel/engine/utils/mix"
import { complex } from "../../motion/kernel/engine/value/types/complex"

type TShadow = ViewStyle["boxShadow"]
const backgroundTiming = resolveNativeTagTransition(250),
  shadowTiming = resolveNativeTagTransition(450)
const useShadow = (target: TShadow, reduced: boolean) => {
  const [progress] = useState(() => new Animated.Value(1)),
    [rendered, setRendered] = useState(target)
  const current = useRef(target),
    signature = JSON.stringify(target)
  useEffect(() => {
    const from = current.current
    if (JSON.stringify(from) === signature) return
    progress.stopAnimation()
    if (reduced || (typeof from !== "string" && typeof target !== "string")) {
      current.current = target
      setRendered(target)
      return
    }
    const template = typeof target === "string" ? target : typeof from === "string" ? from : ""
    if ((from !== undefined && typeof from !== "string") || (target !== undefined && typeof target !== "string")) {
      current.current = target
      setRendered(target)
      return
    }
    const blend = mix(from ?? complex.getAnimatableNone(template), target ?? complex.getAnimatableNone(template))
    progress.setValue(0)
    let active = true
    const listener = progress.addListener(({ value }) => {
      if (active) {
        const next = value === 1 ? target : blend(value)
        current.current = next
        setRendered(next)
      }
    })
    const animation = Animated.timing(progress, {
      ...shadowTiming,
      toValue: 1,
      useNativeDriver: false,
      isInteraction: false,
    })
    animation.start()
    return () => {
      active = false
      animation.stop()
      progress.removeListener(listener)
      progress.stopAnimation()
    }
  }, [progress, signature, reduced])
  return rendered
}

// Observe the existing native animation nodes so the original host paints each
// frame without replacing its ref or introducing a second motion owner.
export const NativeCalendarDayHost = forwardRef<View, ComponentPropsWithoutRef<typeof NativeFocusHost>>(
  (props, ref) => {
    const style = StyleSheet.flatten(props.style) ?? {},
      reduced = useNativeTagReducedMotion()
    const background = useNativeTagColor(
      style.backgroundColor ?? "transparent",
      backgroundTiming,
      reduced,
      true,
    ).rendered
    const shadow = useShadow(style.boxShadow, reduced)
    return <NativeFocusHost {...props} ref={ref} style={{ ...style, backgroundColor: background, boxShadow: shadow }} />
  },
)
NativeCalendarDayHost.displayName = "NativeCalendarDayHost"
