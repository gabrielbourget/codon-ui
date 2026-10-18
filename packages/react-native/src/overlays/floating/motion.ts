import { useEffect, useInsertionEffect, useLayoutEffect, useReducer, useRef, useState } from "react"
import { AccessibilityInfo, Animated, Easing } from "react-native"

import type { useNativeFloatingLayer } from "./useFloatingLayer"

type TTransition = {
  key: string
  generation: number
  closing: boolean
  complete: boolean
  forced: boolean
  animation?: Animated.CompositeAnimation
}

export const useNativeFloatingMotion = (
  layer: ReturnType<typeof useNativeFloatingLayer>,
  ready: boolean,
  open: boolean,
  forceEntering = false,
  forceExiting = false,
) => {
  const [reduced, setReduced] = useState<boolean | null>(null)
  const [opacity] = useState(() => new Animated.Value(0))
  const [, changed] = useReducer((value: number) => value + 1, 0)
  const last = useRef<TTransition | null>(null)
  const entered = useRef<number | null>(null)
  const previousForce = useRef(false)
  const live = useRef(true)
  const current = useRef({ layer, forceExiting })
  current.current = { layer, forceExiting }
  const closing = layer.phase === "exiting" || !open || forceExiting
  const key = `${layer.id}:${layer.generation}:${closing ? "exit" : "enter"}`
  const finishExit = () => {
    if (current.current.layer.phase === "exiting" && !current.current.forceExiting) current.current.layer.exited()
  }
  const finish = (transition: TTransition) => {
    if (!live.current || last.current !== transition || current.current.layer.generation !== transition.generation)
      return
    transition.complete = true
    if (!transition.closing) entered.current = transition.generation
    changed()
    if (transition.closing) finishExit()
  }
  useInsertionEffect(
    () => () => {
      live.current = false
      const transition = last.current
      last.current = null
      transition?.animation?.stop()
    },
    [],
  )
  useEffect(() => {
    let active = true
    let updated = false
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
      updated = true
      if (active) setReduced(value)
    })
    void AccessibilityInfo.isReduceMotionEnabled().then(
      (value) => {
        if (active && !updated) setReduced(value)
      },
      () => {
        if (active && !updated) setReduced(true)
      },
    )
    return () => {
      active = false
      subscription.remove()
    }
  }, [])
  useLayoutEffect(() => {
    const rising = forceEntering && !previousForce.current
    previousForce.current = forceEntering
    if (!ready && layer.phase === "exiting" && !forceExiting) {
      finishExit()
      return
    }
    if (!ready || reduced === null || (!layer.mounted && !forceExiting)) {
      if (last.current && last.current.key !== key) {
        const prior = last.current
        last.current = null
        prior.animation?.stop()
      }
      return
    }
    const prior = last.current
    if (!closing && prior?.closing && prior.generation === layer.generation) entered.current = layer.generation
    const replay = !closing && rising && prior?.key === key && prior.complete
    if (prior?.key === key && !replay) {
      if (prior.complete) {
        if (closing) finishExit()
        return
      }
      if (reduced || (prior.forced && !forceEntering)) {
        prior.animation?.stop()
        opacity.setValue(closing ? 0 : 1)
        finish(prior)
      }
      return
    }
    last.current = null
    prior?.animation?.stop()
    const transition: TTransition = {
      key,
      generation: layer.generation,
      closing,
      complete: false,
      forced: replay === true,
    }
    last.current = transition
    opacity.stopAnimation()
    opacity.setValue(closing ? 1 : 0)
    if (reduced || (!closing && entered.current === layer.generation && !forceEntering)) {
      opacity.setValue(closing ? 0 : 1)
      finish(transition)
      return
    }
    transition.animation = Animated.timing(opacity, {
      toValue: closing ? 0 : 1,
      duration: 250,
      easing: Easing.bezier(0.42, 0, 0.58, 1),
      useNativeDriver: true,
      isInteraction: false,
    })
    changed()
    transition.animation.start(({ finished }) => {
      if (finished) finish(transition)
    })
  }, [ready, reduced, layer.mounted, layer.generation, key, closing, forceEntering, forceExiting, opacity])
  const pending = last.current?.key !== key || !last.current.complete
  return {
    preferenceReady: reduced !== null,
    reduced,
    style: pending && ready ? { opacity } : undefined,
    isEntering: forceEntering || (open && !closing && pending),
    isExiting: forceExiting || (!open && layer.mounted),
  }
}
