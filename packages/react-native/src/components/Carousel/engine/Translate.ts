import type { AxisType } from "./Axis"
import type { TNativeCarouselDocument, TNativeCarouselNode } from "./nativeEnvironment"
import { roundToTwoDecimals } from "./utils"

export type TranslateType = { clear: () => void; to: (target: number) => void; toggleActive: (active: boolean) => void }
export const Translate = (
  axis: AxisType,
  container: TNativeCarouselNode,
  environment?: TNativeCarouselDocument["environment"],
): TranslateType => {
  let previous: number | null = null
  let disabled = false
  return {
    to: (target) => {
      if (disabled || !Number.isFinite(target) || (environment && !environment.binding(container).isCurrent())) return
      const value = roundToTwoDecimals(axis.direction(target))
      if (value === previous) return
      container.setNativeProps({
        style: { transform: [axis.scroll === "x" ? { translateX: value } : { translateY: value }] },
      })
      previous = value
      environment?.geometryChanged()
    },
    clear: () => {
      if (!disabled && (!environment || environment.binding(container).isCurrent())) {
        container.setNativeProps({ style: { transform: [] } })
        environment?.geometryChanged()
      }
    },
    toggleActive: (active) => {
      disabled = !active
    },
  }
}
