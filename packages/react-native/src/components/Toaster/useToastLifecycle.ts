import { useCallback, useEffect, useInsertionEffect, useRef, useState } from "react"
import { AppState } from "react-native"

import { resolveToastDuration } from "./model"
import { DURATION_BEFORE_UNMOUNT, type TNativeToastProps } from "./types"

export const useToastLifecycle = (props: TNativeToastProps) => {
  const current = useRef(props)
  const live = useRef(true)
  const closing = useRef(false)
  const retirement = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [removed, setRemoved] = useState(false)
  const [inactive, setInactive] = useState(AppState.currentState !== "active")
  const duration = resolveToastDuration(props.toast, props.duration)
  const deadline = useRef({ duration, remaining: duration, started: null as number | null })
  useInsertionEffect(() => {
    current.current = props
  })
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (live.current) setInactive(state !== "active")
    })
    return () => subscription.remove()
  }, [])
  useInsertionEffect(
    () => () => {
      live.current = false
      if (retirement.current !== null) clearTimeout(retirement.current)
    },
    [],
  )
  const retire = useCallback((reason: "dismiss" | "auto" | "programmatic", action?: () => unknown) => {
    if (!live.current || closing.current) return
    closing.current = true
    setRemoved(true)
    retirement.current = setTimeout(() => {
      if (live.current) current.current.removeToast(current.current.toast)
    }, DURATION_BEFORE_UNMOUNT)
    const toast = current.current.toast
    action?.()
    if (reason === "auto") toast.onAutoClose?.(toast)
    else if (reason === "dismiss") toast.onDismiss?.(toast)
  }, [])
  const paused = props.toasterExpanded || props.interacting || ((props.pauseWhenPageIsHidden ?? true) && inactive)
  useEffect(() => {
    if (deadline.current.duration !== duration) deadline.current = { duration, remaining: duration, started: null }
    const clock = deadline.current
    if (paused || removed || duration === "persistent" || clock.remaining === "persistent") return
    clock.started = Date.now()
    const timer = setTimeout(() => retire("auto"), Math.max(0, clock.remaining))
    return () => {
      clearTimeout(timer)
      if (clock.started !== null && typeof clock.remaining === "number") {
        clock.remaining = Math.max(0, clock.remaining - (Date.now() - clock.started))
        clock.started = null
      }
    }
  }, [duration, paused, removed, retire])
  useEffect(() => {
    if (props.toast.deletingToast) retire("programmatic")
  }, [props.toast.deletingToast, retire])
  const act = useCallback(
    (action: "close" | "cancel" | "confirm" | "swipe") => {
      const props = current.current
      if (!live.current || props.index >= props.maxVisibleToasts || closing.current) return
      if ((action === "close" || action === "swipe") && props.toast.dismissable === false) return
      if ((action === "cancel" || action === "confirm") && props.toast.showButtons === false) return
      if (action === "cancel" && props.toast.showCancelAction === false) return
      retire(
        "dismiss",
        action === "cancel" ? props.toast.cancelAction : action === "confirm" ? props.toast.confirmAction : undefined,
      )
    },
    [retire],
  )
  return { removed, act, retire, live, inactive }
}
