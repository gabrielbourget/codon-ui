import { useLayoutEffect, type RefObject } from "react"
import { findNodeHandle, type View } from "react-native"

import { bindNativeDescription } from "../../input/nativeDescription"

import type { TNativeFloatingMeasurable } from "./measurement"

export const useNativeTooltipDescription = (
  enabled: boolean,
  anchor: RefObject<TNativeFloatingMeasurable | null>,
  content: RefObject<View | null>,
  label: string,
) => {
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
      if (target !== previousAnchor || description !== previousContent || !release) {
        release?.()
        previousAnchor = target
        previousContent = description
        release = bindNativeDescription(target, description, label)
        if (!release && target && description) {
          const descriptionTag = findNodeHandle(description)
          // A missing native tag can become available on a later frame; a live unsupported trigger cannot bind.
          if (descriptionTag !== null && Number.isSafeInteger(descriptionTag) && descriptionTag > 0)
            throw new TypeError("Tooltip/HoverPopover supplementary descriptions require a NativeFocusView trigger")
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
  }, [enabled, anchor, content, label])
}
