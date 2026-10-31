import { createContext } from "react"
import type { TextInput, View } from "react-native"

type TTarget = View | TextInput
type TFocusOptions = {
  current: () => TTarget | null
  previous: () => TTarget | null
  canAct: () => boolean
  lifetime: () => string
  isLiveTarget: (target: TTarget) => boolean
  lease: (target: TTarget) => (() => boolean) | null
  canCaptureUnmatched: (target: TTarget) => boolean
  tag: (target: TTarget) => number | null
  request: (target: TTarget) => boolean
  schedule: (callback: () => void) => number
  cancel: (frame: number) => void
}
export const createNativeToasterFocus = (options: TFocusOptions) => {
  const members = new WeakMap<TTarget, { mayEnter: () => boolean; lease: object }>()
  let prior: { target: TTarget; lifetime: string; entered: boolean; isCurrent: () => boolean } | null = null
  let frame: number | null = null
  let live = true
  const cancelFrame = () => {
    if (frame !== null) options.cancel(frame)
    frame = null
  }
  const invalidate = () => {
    cancelFrame()
    prior = null
  }
  const capture = (focusedTag?: number) => {
    if (!live || !options.canAct()) return
    if (prior?.entered) return
    prior = null
    const target = options.current()
    if (!target || members.has(target) || !options.isLiveTarget(target)) return
    if (focusedTag !== undefined && options.tag(target) !== focusedTag) return
    if (focusedTag === undefined && !options.canCaptureUnmatched(target)) return
    const isCurrent = options.lease(target)
    if (isCurrent) prior = { target, lifetime: options.lifetime(), entered: false, isCurrent }
  }
  const restore = () => {
    cancelFrame()
    const retained = prior
    prior = null
    if (
      !retained?.entered ||
      !retained.isCurrent() ||
      retained.lifetime !== options.lifetime() ||
      !options.canAct() ||
      !options.isLiveTarget(retained.target)
    )
      return false
    return options.request(retained.target)
  }
  const enter = (target: TTarget) => {
    if (!live || !options.canAct()) return
    if (members.get(target)?.mayEnter() === false) {
      if (!prior?.entered) prior = null
      return
    }
    members.set(target, members.get(target) ?? { mayEnter: () => true, lease: {} })
    if (!prior) {
      const previous = options.previous()
      if (
        previous &&
        (!members.has(previous) || members.get(previous)?.mayEnter() === false) &&
        options.isLiveTarget(previous) &&
        options.canCaptureUnmatched(previous)
      ) {
        const isCurrent = options.lease(previous)
        if (isCurrent) prior = { target: previous, lifetime: options.lifetime(), entered: false, isCurrent }
      }
    }
    if (prior && prior.lifetime === options.lifetime()) prior.entered = true
    cancelFrame()
  }
  const changed = () => {
    if (!live || !prior) return
    if (!options.canAct() || prior.lifetime !== options.lifetime() || !prior.isCurrent()) {
      invalidate()
      return
    }
    if (!prior.entered) return
    const target = options.current()
    if (target && members.has(target)) {
      cancelFrame()
      return
    }
    if (frame !== null) return
    frame = options.schedule(() => {
      frame = null
      if (!live) return
      const target = options.current()
      if (target && members.has(target)) return
      restore()
    })
  }
  return {
    capture,
    enter,
    changed,
    invalidate,
    register: (target: TTarget, mayEnter = () => true) => {
      const entry = { mayEnter, lease: {} }
      members.set(target, entry)
      return () => {
        if (members.get(target) === entry) members.delete(target)
      }
    },
    dispose: () => {
      if (!live) return
      live = false
      restore()
    },
  }
}
export const NativeToasterFocusContext = createContext<ReturnType<typeof createNativeToasterFocus> | null>(null)
