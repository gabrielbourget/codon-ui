import { useLayoutEffect, useRef, type RefObject } from "react"
import { findNodeHandle, type View } from "react-native"

import { useNativeFloatingObservations } from "../../input/NativeKeyboardScope"
import type { NativeFloatingObservation } from "../../input/specs/CUIKeyboardScopeNativeComponent"

import type { TNativeFloatingMeasurable } from "./measurement"
import type { TNativeFloatingRect } from "./placement"

export const useNativeFloatingViewport = ({
  enabled,
  triggerRef,
  onAncestorScroll,
}: {
  enabled: boolean
  triggerRef: RefObject<TNativeFloatingMeasurable | null>
  onAncestorScroll?: () => void
}) => {
  const observations = useNativeFloatingObservations()
  const viewport = useRef<TNativeFloatingRect | null>(null)
  const current = useRef({ enabled, triggerRef, onAncestorScroll })
  current.current = { enabled, triggerRef, onAncestorScroll }
  useLayoutEffect(() => {
    viewport.current = null
    if (!enabled || !observations) return
    let live = true
    let target: TNativeFloatingMeasurable | null = null
    let release: (() => void) | undefined
    let scrollRevision: number | null = null
    let revision = -1
    let session = ""
    let resizing = false
    let resizeGeneration = 0
    let resizeTimer: ReturnType<typeof setTimeout> | null = null
    const resetResize = () => {
      resizeGeneration++
      if (resizeTimer !== null) clearTimeout(resizeTimer)
      resizeTimer = null
      resizing = false
    }
    let frame: ReturnType<typeof requestAnimationFrame> | null = null
    const update = () => {
      if (!live) return
      const next = triggerRef.current
      if (next !== target) {
        release?.()
        target = next
        viewport.current = null
        scrollRevision = null
        revision = -1
        session = ""
        resetResize()
        const tag = next ? findNodeHandle(next as View) : null
        release =
          tag === null
            ? undefined
            : observations.register(tag, (data: NativeFloatingObservation) => {
                if (
                  !live ||
                  !current.current.enabled ||
                  current.current.triggerRef !== triggerRef ||
                  triggerRef.current !== next
                )
                  return
                const nextSession = JSON.stringify([data.windowId, data.epoch])
                if (nextSession !== session) {
                  session = nextSession
                  scrollRevision = null
                  revision = -1
                  resetResize()
                  viewport.current = null
                }
                if (data.revision <= revision) return
                revision = data.revision
                if (scrollRevision !== null && data.scrollRevision < scrollRevision) return
                const scrolled = scrollRevision !== null && data.scrollRevision > scrollRevision
                scrollRevision = data.scrollRevision
                const prior = viewport.current
                // Match the source visual-viewport grace: keyboard resizing may itself scroll an anchor ancestor.
                if (
                  prior &&
                  (prior.width !== data.width ||
                    prior.height !== data.height ||
                    (resizing && (prior.x !== data.x || prior.y !== data.y)))
                ) {
                  resetResize()
                  resizing = true
                  const generation = resizeGeneration
                  resizeTimer = setTimeout(() => {
                    if (live && generation === resizeGeneration) {
                      resizing = false
                      resizeTimer = null
                    }
                  }, 500)
                }
                viewport.current = { x: data.x, y: data.y, width: data.width, height: data.height }
                if (scrolled && !resizing) current.current.onAncestorScroll?.()
              })
      }
      frame = requestAnimationFrame(update)
    }
    update()
    return () => {
      live = false
      resetResize()
      if (frame !== null) cancelAnimationFrame(frame)
      release?.()
      viewport.current = null
    }
  }, [enabled, observations, triggerRef])
  return viewport
}
