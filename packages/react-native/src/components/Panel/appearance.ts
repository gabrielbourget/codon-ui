import { useInsertionEffect, useRef } from "react"
import type { Animated, TextStyle, ViewStyle } from "react-native"

import { resolveNativeTagTransition, useNativeTagColor, useNativeTagNumber } from "../Tag/motion"

const APPEARANCE_TIMING = resolveNativeTagTransition(350)
const numeric = (value: unknown) => (typeof value === "number" ? value : undefined)
const usePanelNumber = (value: unknown, reduced: boolean) => {
  const target = numeric(value)
  const previous = useRef(target)
  const staticBoundary = previous.current === undefined || target === undefined
  useInsertionEffect(() => {
    previous.current = target
  })
  return useNativeTagNumber(target, APPEARANCE_TIMING, reduced || staticBoundary)
}

// Panel's CSS paint/layout transition is independent of its presence slide.
// Keep percentage/auto dimensions on the original native layout path.
export const useNativePanelAppearance = (view: ViewStyle, text: TextStyle, reduced: boolean) => {
  const backgroundColor = useNativeTagColor(view.backgroundColor, APPEARANCE_TIMING, reduced).value
  const foreground = useNativeTagColor(text.color, APPEARANCE_TIMING, reduced, true).rendered
  const width = usePanelNumber(view.width, reduced)
  const height = usePanelNumber(view.height, reduced)
  const top = usePanelNumber(view.top, reduced)
  const bottom = usePanelNumber(view.bottom, reduced)
  const left = usePanelNumber(view.left, reduced)
  const right = usePanelNumber(view.right, reduced)
  const borderRadius = usePanelNumber(view.borderRadius, reduced)
  return {
    view: {
      ...view,
      backgroundColor,
      width: width ?? view.width,
      height: height ?? view.height,
      top: top ?? view.top,
      bottom: bottom ?? view.bottom,
      left: left ?? view.left,
      right: right ?? view.right,
      borderRadius: borderRadius ?? view.borderRadius,
    } as Animated.WithAnimatedValue<ViewStyle>,
    text: { ...text, color: foreground },
  }
}
