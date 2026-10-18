import { useEffect, useInsertionEffect, useLayoutEffect, useRef, useState } from "react"
import { AccessibilityInfo, Animated, Easing, type ViewStyle } from "react-native"

import type { TNativeToastProps } from "./types"

type TNativeToastFrame = { translation: number; scale: number; opacity: number; height: number | undefined }
type TNativeToastMotionState = { entered: boolean; removed: boolean; swiped: boolean; naturalHeight: number }

export const getNativeToastMotionFrame = (
  props: TNativeToastProps,
  state: TNativeToastMotionState,
  root: ViewStyle,
  authored: ViewStyle,
): TNativeToastFrame => {
  const lift = props.position.startsWith("top") ? 1 : -1
  const expanded = props.toasterExpanded || props.expandByDefault
  let translation = lift * (expanded ? props.offset : props.index * (props.toastGap ?? 15))
  if (!state.entered && props.index === 0) translation = -lift * state.naturalHeight
  if (state.removed) {
    if (state.swiped || props.index === 0 || expanded)
      translation = lift * (expanded ? props.offset : 0) - lift * state.naturalHeight
    else translation = state.naturalHeight * 0.4
  }
  return {
    translation,
    scale: !expanded && props.index > 0 ? 1 - props.index * 0.05 : 1,
    opacity:
      (typeof authored.opacity === "number" ? authored.opacity : undefined) ??
      (props.index >= props.maxVisibleToasts || state.removed || (!state.entered && props.index === 0) ? 0 : 1),
    height: typeof root.height === "number" ? root.height : undefined,
  }
}

const CSS_EASE = Easing.bezier(0.25, 0.1, 0.25, 1)
const CSS_EASE_OUT = Easing.bezier(0, 0, 0.58, 1)

export const useNativeToastMotion = (
  props: TNativeToastProps,
  root: ViewStyle,
  authored: ViewStyle,
  naturalHeight: number,
  removed: boolean,
  dragging: boolean,
  swiped: boolean,
  dragAmount: Animated.Value,
) => {
  const [entered, setEntered] = useState(false)
  const [reduced, setReduced] = useState(true)
  const live = useRef(true)
  const exit = useRef<{ props: TNativeToastProps; naturalHeight: number } | null>(null)
  const lastLive = useRef({ props, naturalHeight })
  if (!removed) lastLive.current = { props, naturalHeight }
  else if (!exit.current) exit.current = lastLive.current
  const effective = removed ? (exit.current ?? lastLive.current) : { props, naturalHeight }
  const frame = getNativeToastMotionFrame(
    effective.props,
    { entered, removed, swiped, naturalHeight: effective.naturalHeight },
    root,
    authored,
  )
  const [nodes] = useState(() => ({
    translation: new Animated.Value(frame.translation),
    scale: new Animated.Value(frame.scale),
    opacity: new Animated.Value(frame.opacity),
    height: new Animated.Value(frame.height ?? 0),
  }))
  const previous = useRef<TNativeToastFrame>(frame)
  const animations = useRef<Partial<Record<keyof TNativeToastFrame, Animated.CompositeAnimation>>>({})
  useInsertionEffect(
    () => () => {
      live.current = false
      for (const animation of Object.values(animations.current)) animation?.stop()
      animations.current = {}
      dragAmount.stopAnimation()
    },
    [dragAmount],
  )
  useEffect(() => {
    let current = true,
      changed = false
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
      changed = true
      if (current) setReduced(value)
    })
    void AccessibilityInfo.isReduceMotionEnabled().then(
      (value) => {
        if (current && !changed) setReduced(value)
      },
      () => undefined,
    )
    return () => {
      current = false
      subscription.remove()
    }
  }, [])
  useLayoutEffect(() => {
    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        if (live.current) setEntered(true)
      })
    })
    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
    }
  }, [])
  useLayoutEffect(() => {
    const immediate = reduced || dragging || !entered
    for (const field of ["translation", "scale", "opacity", "height"] as const) {
      const target = frame[field]
      if (target === undefined) {
        animations.current[field]?.stop()
        delete animations.current[field]
        continue
      }
      if (immediate || previous.current[field] === undefined) {
        animations.current[field]?.stop()
        delete animations.current[field]
        nodes[field].setValue(target)
      } else if (previous.current[field] !== target) {
        animations.current[field]?.stop()
        const collapsedExit = removed && props.index > 0 && !(props.toasterExpanded || props.expandByDefault) && !swiped
        const duration = swiped ? 250 : collapsedExit ? (field === "translation" ? 500 : 250) : 400
        const animation = Animated.timing(nodes[field], {
          toValue: target,
          duration,
          easing: swiped ? CSS_EASE_OUT : CSS_EASE,
          useNativeDriver: false,
          isInteraction: false,
        })
        animations.current[field] = animation
        animation.start()
      }
    }
    previous.current = frame
  }, [
    frame.translation,
    frame.scale,
    frame.opacity,
    frame.height,
    reduced,
    dragging,
    entered,
    removed,
    swiped,
    props.index,
    props.toasterExpanded,
    props.expandByDefault,
    nodes,
  ])
  return {
    ...root,
    opacity: typeof authored.opacity === "object" ? authored.opacity : nodes.opacity,
    height: frame.height === undefined ? root.height : nodes.height,
    transform: authored.transform ?? [
      { translateY: nodes.translation },
      { scale: nodes.scale },
      { translateY: dragAmount },
    ],
  }
}
