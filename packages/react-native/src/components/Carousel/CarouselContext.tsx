import { createContext, useContext } from "react"

import type { TNativeCarouselLabels, TNativePartialCarouselLabels, TNativeCarouselContext } from "./carouselTypes"
import { DEFAULT_NATIVE_CAROUSEL_CONTROL_LABELS } from "./context"

export const DEFAULT_NATIVE_CAROUSEL_LABELS: TNativeCarouselLabels = {
  root: {
    ariaLabel: "Content Carousel",
    ariaRoleDescription: "carousel",
    liveRegionText: ({ itemNumber, itemCount }) => `Item ${itemNumber} of ${itemCount}`,
  },
  item: {
    ariaRoleDescription: "slide",
    ariaLabel: ({ itemNumber, itemCount }) => `Item ${itemNumber} of ${itemCount}`,
  },
  controls: DEFAULT_NATIVE_CAROUSEL_CONTROL_LABELS,
  dots: {
    navigationAriaLabel: "Slide Navigation",
    dotButtonLabel: ({ itemNumber, itemCount }) => `Go to item ${itemNumber} of ${itemCount}`,
  },
  counter: { ariaLabel: "Carousel Counter", counterText: "Items" },
}
export const resolveNativeCarouselLabels = (
  ariaLabel?: string,
  labels?: TNativePartialCarouselLabels,
): TNativeCarouselLabels => ({
  root: {
    ...DEFAULT_NATIVE_CAROUSEL_LABELS.root,
    ...labels?.root,
    ariaLabel: labels?.root?.ariaLabel ?? ariaLabel ?? DEFAULT_NATIVE_CAROUSEL_LABELS.root.ariaLabel,
  },
  item: { ...DEFAULT_NATIVE_CAROUSEL_LABELS.item, ...labels?.item },
  controls: { ...DEFAULT_NATIVE_CAROUSEL_LABELS.controls, ...labels?.controls },
  dots: { ...DEFAULT_NATIVE_CAROUSEL_LABELS.dots, ...labels?.dots },
  counter: { ...DEFAULT_NATIVE_CAROUSEL_LABELS.counter, ...labels?.counter },
})
export const NativeCarouselContext = createContext<TNativeCarouselContext | null>(null)
export const useNativeCarouselContext = () => {
  const context = useContext(NativeCarouselContext)
  if (!context) throw new Error("Carousel chrome must be used within Carousel")
  return context
}
