import { useLayoutEffect, useRef, useState, type RefObject } from "react"
import { Animated, Easing, type TextStyle, type View, type ViewStyle } from "react-native"

import { subscribeNativeMotionColorEnvironment } from "../../input/motionColors"

import {
  arePanelAppearanceValuesEqual,
  createPanelAppearanceMixer,
  getPanelAppearanceDefault,
  type TPanelAppearanceBounds,
} from "./appearanceValues"
import { createPanelNativeColorMixer } from "./nativeColors"
import { panelRadiusNeedsMeasurement, resolvePanelRadii } from "./radii"

type TStyles = { view: ViewStyle; text: TextStyle }
type TTrack = {
  mix: (progress: number) => unknown
  started: number
  duration: number
  reverseStart: unknown
  reverseFactor: number
  target: unknown
  release?: (completed?: boolean) => void
}
const DURATION = 350
const ease = Easing.bezier(0.42, 0, 0.58, 1)
const gapLonghands = (style: ViewStyle) => ({
  ...style,
  rowGap: style.rowGap ?? style.gap,
  columnGap: style.columnGap ?? style.gap,
})
const hasPercentageGap = (style: ViewStyle) =>
  [style.gap, style.rowGap, style.columnGap].some((value) => typeof value === "string" && value.endsWith("%"))

// Each CSS property keeps its own deadline when another property is retargeted.
export const useNativePanelAppearance = (
  view: ViewStyle,
  text: TextStyle,
  reduced: boolean,
  bounds: TPanelAppearanceBounds,
  textDefaults: TextStyle,
  colorTarget?: RefObject<View | null>,
  colorScopeKnown?: () => boolean,
) => {
  const [clock] = useState(() => new Animated.Value(0))
  const [rendered, setRendered] = useState<TStyles>({ view, text })
  const [nativeError, setNativeError] = useState<Error | null>(null)
  const owner = useRef({
    target: { view, text },
    tracks: new Map<string, TTrack>(),
    clock,
    bounds: { ...bounds },
    revision: 0,
    signature: "",
    animation: undefined as Animated.CompositeAnimation | undefined,
    listener: undefined as string | undefined,
    sample: undefined as ((now: number) => TStyles) | undefined,
    colorHost: null as View | null,
    colorUnsubscribe: undefined as (() => void) | undefined,
    active: true,
  })
  useLayoutEffect(() => {
    const current = owner.current
    current.active = true
    const signature = JSON.stringify([view, text, reduced, bounds, textDefaults])
    if (current.signature === signature) return
    current.signature = signature
    Object.assign(current.bounds, bounds)
    const revision = ++current.revision
    current.animation?.stop()
    if (current.listener !== undefined) current.clock.removeListener(current.listener)
    current.listener = undefined
    const sample = (now: number): TStyles => {
      const result = { view: { ...current.target.view }, text: { ...current.target.text } }
      for (const [key, track] of current.tracks) {
        const [part, field] = key.split(":") as [keyof TStyles, string]
        const progress = Math.max(0, Math.min(1, (now - track.started) / track.duration))
        if (progress === 1) {
          track.release?.(true)
          current.tracks.delete(key)
        } else Object.assign(result[part], { [field]: track.mix(ease(progress)) })
      }
      if (
        current.target.view.rowGap === undefined &&
        current.target.view.columnGap === undefined &&
        current.tracks.has("view:rowGap") &&
        current.tracks.has("view:columnGap") &&
        result.view.rowGap === result.view.columnGap
      ) {
        result.view.gap = result.view.rowGap
        delete result.view.rowGap
        delete result.view.columnGap
      }
      return result
    }
    current.sample = sample
    const now = Date.now()
    const previous = sample(now)
    const target = { view, text }
    for (const part of ["view", "text"] as const) {
      const before = (part === "view" ? gapLonghands(previous.view) : previous.text) as Record<string, unknown>
      const after = (part === "view" ? gapLonghands(target.view) : target.text) as Record<string, unknown>
      const priorTarget = (part === "view" ? gapLonghands(current.target.view) : current.target.text) as Record<
        string,
        unknown
      >
      for (const field of new Set([...Object.keys(before), ...Object.keys(after)])) {
        if (part === "view" && field === "gap") continue
        const key = `${part}:${field}`
        if (reduced) {
          current.tracks.get(key)?.release?.()
          current.tracks.delete(key)
          continue
        }
        const first = before[field] ?? getPanelAppearanceDefault(field, before, textDefaults, current.bounds.border)
        const last = after[field] ?? getPanelAppearanceDefault(field, after, textDefaults, current.bounds.border)
        const prior =
          priorTarget[field] ?? getPanelAppearanceDefault(field, priorTarget, textDefaults, current.bounds.border)
        if (arePanelAppearanceValuesEqual(field, prior, last)) continue
        let mix = createPanelAppearanceMixer(field, first, last, current.bounds, text.color ?? textDefaults.color)
        const nativeColor =
          !mix && colorTarget && colorScopeKnown?.() !== false && !arePanelAppearanceValuesEqual(field, first, last)
            ? createPanelNativeColorMixer(
                field,
                first,
                last,
                current.bounds,
                text.color ?? textDefaults.color,
                colorTarget,
                () => {
                  if (current.active && current.sample) setRendered(current.sample(Date.now()))
                },
                (error) => {
                  if (current.active) setNativeError((previous) => previous ?? error)
                },
              )
            : undefined
        mix ??= nativeColor?.mix
        if (mix && !arePanelAppearanceValuesEqual(field, first, last)) {
          const priorTrack = current.tracks.get(key)
          const reversing = priorTrack && arePanelAppearanceValuesEqual(field, priorTrack.reverseStart, last)
          // CSS Transitions §3 shortens an interrupted transition returning to its logical start.
          const reverseFactor = reversing
            ? Math.min(
                1,
                Math.abs(
                  ease(Math.min(1, (now - priorTrack.started) / priorTrack.duration)) * priorTrack.reverseFactor +
                    1 -
                    priorTrack.reverseFactor,
                ),
              )
            : 1
          priorTrack?.release?.()
          if (reverseFactor > 0)
            current.tracks.set(key, {
              mix,
              started: now,
              duration: DURATION * reverseFactor,
              reverseStart: reversing ? priorTrack.target : first,
              reverseFactor,
              target: last,
              release: nativeColor?.release,
            })
          else {
            nativeColor?.release()
            current.tracks.delete(key)
          }
        } else {
          current.tracks.get(key)?.release?.()
          current.tracks.delete(key)
        }
      }
    }
    current.target = target
    setRendered(sample(now))
    const remaining = Math.max(0, ...[...current.tracks.values()].map((track) => track.started + track.duration - now))
    if (!remaining) return
    current.clock.setValue(0)
    current.listener = current.clock.addListener(() => {
      if (current.revision === revision) setRendered(sample(Date.now()))
    })
    current.animation = Animated.timing(current.clock, {
      toValue: 1,
      duration: remaining,
      easing: Easing.linear,
      useNativeDriver: false,
      isInteraction: false,
    })
    current.animation.start(({ finished }) => {
      if (finished && current.revision === revision) {
        for (const track of current.tracks.values()) track.release?.(true)
        current.tracks.clear()
        setRendered(current.target)
        if (current.listener !== undefined) current.clock.removeListener(current.listener)
        current.listener = undefined
      }
    })
  })
  useLayoutEffect(() => {
    const current = owner.current
    const target = colorTarget?.current ?? null
    const retireColors = () => {
      for (const [key, track] of current.tracks)
        if (track.release) {
          track.release()
          current.tracks.delete(key)
        }
      if (current.active && current.sample) setRendered(current.sample(Date.now()))
    }
    if (target !== current.colorHost) {
      current.colorUnsubscribe?.()
      current.colorUnsubscribe = undefined
      current.colorHost = target
      retireColors()
    }
    if (target && !current.colorUnsubscribe)
      current.colorUnsubscribe = subscribeNativeMotionColorEnvironment(target, retireColors)
  })
  useLayoutEffect(
    () => () => {
      const current = owner.current
      current.active = false
      current.colorUnsubscribe?.()
      current.colorUnsubscribe = undefined
      for (const track of current.tracks.values()) track.release?.()
      current.tracks.clear()
      current.revision++
      current.signature = ""
      current.animation?.stop()
      if (current.listener !== undefined) current.clock.removeListener(current.listener)
      current.listener = undefined
    },
    [],
  )
  const drawing = resolvePanelRadii(rendered.view, bounds.border)
  if (nativeError) throw nativeError
  return {
    ...rendered,
    view: drawing.view,
    radii: drawing.radii,
    needsRadiusObservation: panelRadiusNeedsMeasurement(view) || panelRadiusNeedsMeasurement(rendered.view),
    needsContentObservation:
      hasPercentageGap(view) ||
      hasPercentageGap(rendered.view) ||
      owner.current.tracks.has("view:rowGap") ||
      owner.current.tracks.has("view:columnGap"),
  }
}
