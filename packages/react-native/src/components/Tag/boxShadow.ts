import { useEffect, useRef, useState } from "react"
import { Animated, type BoxShadowValue, type ViewStyle } from "react-native"
// @ts-expect-error The locked RN host exports this parser without a TypeScript declaration.
import nativeProcessBoxShadow from "react-native/Libraries/StyleSheet/processBoxShadow"

import type { resolveNativeTagTransition } from "./motion"

type TParsedShadow = {
  offsetX: number
  offsetY: number
  blurRadius?: number
  spreadDistance?: number
  inset?: boolean
  color?: unknown
}
const processBoxShadow = nativeProcessBoxShadow as (value: ViewStyle["boxShadow"]) => TParsedShadow[]

type TShadow = {
  offsetX: number
  offsetY: number
  blurRadius: number
  spreadDistance: number
  inset: boolean
  r: number
  g: number
  b: number
  a: number
}
// Normalize with the same locked host grammar instead of maintaining another native shadow parser.
const normalized = (value: ViewStyle["boxShadow"]): TShadow[] | undefined => {
  const parsed = processBoxShadow(value)
  if (typeof value === "string" && value.trim() !== "none" && value.trim() !== "" && parsed.length === 0)
    return undefined
  if (Array.isArray(value) && value.length > 0 && parsed.length === 0) return undefined
  const result: TShadow[] = []
  for (const item of parsed) {
    const { offsetX, offsetY, blurRadius = 0, spreadDistance = 0, inset = false } = item
    const color = item.color ?? 0xff000000
    if (
      ![offsetX, offsetY, blurRadius, spreadDistance].every(
        (number) => typeof number === "number" && Number.isFinite(number),
      ) ||
      typeof color !== "number" ||
      typeof inset !== "boolean"
    )
      return undefined
    result.push({
      offsetX,
      offsetY,
      blurRadius,
      spreadDistance,
      inset,
      r: (color >>> 16) & 255,
      g: (color >>> 8) & 255,
      b: color & 255,
      a: (color >>> 24) / 255,
    })
  }
  return result
}
const empty = (inset: boolean): TShadow => ({
  offsetX: 0,
  offsetY: 0,
  blurRadius: 0,
  spreadDistance: 0,
  inset,
  r: 0,
  g: 0,
  b: 0,
  a: 0,
})
const mix = (from: TShadow[], to: TShadow[], progress: number): TShadow[] =>
  Array.from({ length: Math.max(from.length, to.length) }, (_, index) => {
    const start = from[index] ?? empty(to[index].inset),
      end = to[index] ?? empty(from[index].inset)
    const number = (a: number, b: number) => a * (1 - progress) + b * progress
    const alpha = number(start.a, end.a)
    const color = (a: number, b: number) => (alpha === 0 ? 0 : number(a * start.a, b * end.a) / alpha)
    return {
      offsetX: number(start.offsetX, end.offsetX),
      offsetY: number(start.offsetY, end.offsetY),
      blurRadius: number(start.blurRadius, end.blurRadius),
      spreadDistance: number(start.spreadDistance, end.spreadDistance),
      inset: end.inset,
      r: color(start.r, end.r),
      g: color(start.g, end.g),
      b: color(start.b, end.b),
      a: alpha,
    }
  })
const nativeShadows = (shadows: TShadow[]): BoxShadowValue[] =>
  shadows.map(({ r, g, b, a, ...shadow }) => ({ ...shadow, color: `rgba(${r}, ${g}, ${b}, ${a})` }))

export const useNativeTagBoxShadow = (
  target: ViewStyle["boxShadow"],
  timing: ReturnType<typeof resolveNativeTagTransition>,
  reduced: boolean,
): ViewStyle["boxShadow"] => {
  const destination = normalized(target)
  const signature = destination === undefined ? target : JSON.stringify(destination)
  const latest = useRef({ target, destination })
  latest.current = { target, destination }
  const current = useRef(destination)
  const [rendered, setRendered] = useState(target)
  const [progress] = useState(() => new Animated.Value(0))
  const enabled = !reduced && (timing.duration > 0 || timing.delay > 0) && destination !== undefined
  useEffect(() => {
    const { destination } = latest.current
    const from = current.current
    if (
      !enabled ||
      from === undefined ||
      destination === undefined ||
      JSON.stringify(from) === JSON.stringify(destination) ||
      from.some((value, index) => destination[index] !== undefined && value.inset !== destination[index].inset)
    ) {
      current.current = destination
      if (enabled) setRendered(latest.current.target)
      return
    }
    let active = true
    progress.setValue(0)
    const listener = progress.addListener(({ value }) => {
      if (!active) return
      const paint = mix(from, destination, value)
      current.current = paint
      setRendered(nativeShadows(paint))
    })
    const animation = Animated.timing(progress, { toValue: 1, ...timing, useNativeDriver: false, isInteraction: false })
    animation.start(({ finished }) => {
      if (!active || !finished) return
      current.current = destination
      setRendered(latest.current.target)
    })
    return () => {
      active = false
      progress.removeListener(listener)
      animation.stop()
    }
  }, [signature, timing.duration, timing.delay, timing.easing, enabled, progress])
  const from = current.current
  const transitioning =
    enabled &&
    from !== undefined &&
    destination !== undefined &&
    JSON.stringify(from) !== JSON.stringify(destination) &&
    !from.some((value, index) => destination[index] !== undefined && value.inset !== destination[index].inset)
  return transitioning ? rendered : target
}
