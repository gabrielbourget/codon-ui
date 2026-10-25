import type { CalendarState } from "react-stately/useCalendarState"
import type { RangeCalendarState } from "react-stately/useRangeCalendarState"

import type { TNativeKeyboardData, TNativeKeyboardEvent } from "../../input/types"

export type TNativeCalendarState = CalendarState | RangeCalendarState
export const NATIVE_CALENDAR_NAVIGATION_KEYS = [
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "Escape",
] as const

// Pinned useCalendarGrid policy, split at the native default/admission boundary.
export const nativeCalendarKeyCommand = (
  state: TNativeCalendarState,
  key: Pick<TNativeKeyboardData, "phase" | "cancelled" | "key" | "shiftKey">,
  direction: "ltr" | "rtl",
): (() => void) | null => {
  if (key.phase !== "down" || key.cancelled) return null
  switch (key.key) {
    case "Enter":
    case " ":
      return () => state.selectFocusedDate()
    case "PageUp":
      return () => state.focusPreviousSection(key.shiftKey)
    case "PageDown":
      return () => state.focusNextSection(key.shiftKey)
    case "Home":
      return () => state.focusSectionStart()
    case "End":
      return () => state.focusSectionEnd()
    case "ArrowLeft":
      return () => {
        if (direction === "rtl") state.focusNextDay()
        else state.focusPreviousDay()
      }
    case "ArrowRight":
      return () => {
        if (direction === "rtl") state.focusPreviousDay()
        else state.focusNextDay()
      }
    case "ArrowUp":
      return () => state.focusPreviousRow()
    case "ArrowDown":
      return () => state.focusNextRow()
    case "Escape":
      return "setAnchorDate" in state ? () => state.setAnchorDate(null) : null
    default:
      return null
  }
}
export const preventNativeCalendarKey = (event: TNativeKeyboardEvent) => {
  event.preventDefault()
  if (!["Enter", " ", "Escape"].includes(event.nativeEvent.key)) event.stopPropagation()
}
export const handleNativeCalendarKey = (
  state: TNativeCalendarState,
  event: TNativeKeyboardEvent,
  direction: "ltr" | "rtl",
) => {
  const command = nativeCalendarKeyCommand(state, event.nativeEvent, direction)
  if (!command) return false
  preventNativeCalendarKey(event)
  command()
  return true
}
