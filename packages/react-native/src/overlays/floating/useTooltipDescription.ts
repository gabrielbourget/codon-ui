import { useLayoutEffect, type RefObject } from "react"
import { findNodeHandle, type View } from "react-native"

import { bindNativeDescription } from "../../input/nativeDescription"
import { useNativeFloatingObservations } from "../../input/NativeKeyboardScope"

import type { TNativeFloatingMeasurable } from "./measurement"

export const useNativeTooltipDescription = (
  enabled: boolean,
  anchor: RefObject<TNativeFloatingMeasurable | null>,
  content: RefObject<View | null>,
  label: string,
) => {
  const observations = useNativeFloatingObservations()
  useLayoutEffect(() => {
    if (!enabled) return
    let live = true
    let previousAnchor: TNativeFloatingMeasurable | null = null
    let previousContent: View | null = null
    let release: (() => void) | undefined
    let frame: ReturnType<typeof requestAnimationFrame> | null = null
    const update = () => {
      if (!live) return
      const target = anchor.current,
        description = content.current
      if (target !== previousAnchor || description !== previousContent) {
        release?.()
        previousAnchor = target
        previousContent = description
        release = bindNativeDescription(target, description, label)
        if (!release && target && description) {
          const targetTag = findNodeHandle(target as View),
            descriptionTag = findNodeHandle(description)
          if (targetTag !== null && descriptionTag !== null && descriptionTag > 0)
            release = observations?.register(targetTag, () => undefined, descriptionTag, label)
        }
      }
      frame = requestAnimationFrame(update)
    }
    update()
    return () => {
      live = false
      if (frame !== null) cancelAnimationFrame(frame)
      release?.()
    }
  }, [enabled, anchor, content, label, observations])
}
