import { createContext, useContext } from "react"

import type { TNativeCarouselControlLabels } from "./types"

export const DEFAULT_NATIVE_CAROUSEL_CONTROL_LABELS: TNativeCarouselControlLabels = {
  previousItemButtonAriaLabel: "Previous Item",
  nextItemButtonAriaLabel: "Next Item",
  closeButtonAriaLabel: "Close Carousel",
}
export type TNativeCarouselControlsContext = Readonly<{
  canScrollPrev: boolean
  canScrollNext: boolean
  scrollPrev: () => void
  scrollNext: () => void
  labels: TNativeCarouselControlLabels
}>
export const NativeCarouselControlsContext = createContext<TNativeCarouselControlsContext | null>(null)
export const useNativeCarouselControlsContext = () => {
  const context = useContext(NativeCarouselControlsContext)
  if (!context) throw new Error("Carousel controls must be used within Carousel")
  return context
}
