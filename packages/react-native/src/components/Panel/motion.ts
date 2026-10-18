import { useEffect, useInsertionEffect, useLayoutEffect, useRef, useState } from "react"
import { AccessibilityInfo, Animated, Easing } from "react-native"

export const useNativePanelMotion = (open: boolean, width: number | null) => {
  const [retained, setRetained] = useState(open)
  const [progress] = useState(() => new Animated.Value(1))
  const [reduced, setReduced] = useState<boolean | null>(null)
  const live = useRef(true)
  const generation = useRef(0)
  const committedOpen = useRef(open)
  useInsertionEffect(() => {
    committedOpen.current = open
  }, [open])
  useInsertionEffect(
    () => () => {
      live.current = false
      generation.current++
      progress.stopAnimation()
    },
    [progress],
  )
  useEffect(() => {
    let liveQuery = true,
      changed = false
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
      changed = true
      if (liveQuery) setReduced(value)
    })
    void AccessibilityInfo.isReduceMotionEnabled().then(
      (value) => {
        if (liveQuery && !changed) setReduced(value)
      },
      () => {
        if (liveQuery && !changed) setReduced(true)
      },
    )
    return () => {
      liveQuery = false
      subscription.remove()
    }
  }, [])
  useLayoutEffect(() => {
    const epoch = ++generation.current
    if (open) setRetained(true)
    const finish = () => {
      if (live.current && generation.current === epoch && !committedOpen.current) setRetained(false)
    }
    if (reduced === null) return
    if (open && width === null && !reduced) return
    if (reduced || width === null || width === 0) {
      progress.stopAnimation()
      progress.setValue(open ? 0 : 1)
      if (!open) finish()
      return
    }
    const animation = Animated.timing(progress, {
      toValue: open ? 0 : 1,
      duration: 250,
      easing: Easing.bezier(0.42, 0, 0.58, 1),
      useNativeDriver: true,
      isInteraction: false,
    })
    animation.start(({ finished }) => {
      if (finished && !open) finish()
    })
    return () => {
      generation.current++
      animation.stop()
    }
  }, [open, width, reduced, progress])
  return { present: open || retained, progress }
}
