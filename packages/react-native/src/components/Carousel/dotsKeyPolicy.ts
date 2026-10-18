import type { NativeSyntheticEvent } from "react-native"

import type { TNativeCarouselDotsActivationMode } from "./dotsModel"

export type TNativeCarouselDotKeyEvent = Pick<
  NativeSyntheticEvent<
    Readonly<{ key: string; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }>
  >,
  "nativeEvent" | "preventDefault" | "stopPropagation"
>
export type TNativeCarouselDotKeyPolicy = Readonly<{
  interactive: boolean
  focusIndex: number
  itemCount: number
  activationMode: TNativeCarouselDotsActivationMode
  setFocusIndex: (index: number) => void
  requestFocus: (index: number) => void
  scrollTo: (index: number) => void
}>

// The native key/focus transport remains a required integration boundary.
export const handleNativeCarouselDotKey = (input: TNativeCarouselDotKeyPolicy, event: TNativeCarouselDotKeyEvent) => {
  if (!input.interactive) return
  let next = input.focusIndex
  switch (event.nativeEvent.key) {
    case "ArrowLeft":
      next = Math.max(0, Math.min(input.itemCount - 1, input.focusIndex - 1))
      event.preventDefault()
      event.stopPropagation()
      break
    case "ArrowRight":
      next = Math.max(0, Math.min(input.itemCount - 1, input.focusIndex + 1))
      event.preventDefault()
      event.stopPropagation()
      break
    case "Home":
      next = 0
      event.preventDefault()
      event.stopPropagation()
      break
    case "End":
      next = input.itemCount - 1
      event.preventDefault()
      event.stopPropagation()
      break
    case "Enter":
    case " ":
    case "Spacebar":
      event.preventDefault()
      input.scrollTo(input.focusIndex)
      return
    default:
      return
  }
  input.setFocusIndex(next)
  input.requestFocus(next)
  if (input.activationMode === "auto") input.scrollTo(next)
}
