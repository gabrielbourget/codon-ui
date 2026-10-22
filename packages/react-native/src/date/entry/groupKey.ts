import type { TNativeDateSegmentKeyEvent } from "./useNativeDateSegmentEntry"

export type TNativeDateGroupFocus = Readonly<{
  focusNext: () => void
  focusPrevious: () => void
  focusVisual: (direction: -1 | 1) => void
}>

// RTL follows current native geometry, matching the source's nearest physical segment.
export const handleNativeDateGroupKey = (
  event: TNativeDateSegmentKeyEvent,
  direction: "ltr" | "rtl",
  focus: TNativeDateGroupFocus,
) => {
  const data = event.nativeEvent
  if (data.phase !== "down" || data.cancelled || (data.key !== "ArrowLeft" && data.key !== "ArrowRight")) return
  event.preventDefault()
  event.stopPropagation()
  if (direction === "rtl") focus.focusVisual(data.key === "ArrowLeft" ? -1 : 1)
  else if (data.key === "ArrowLeft") focus.focusPrevious()
  else focus.focusNext()
}
