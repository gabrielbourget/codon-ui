import type { EmblaCarouselType } from "./EmblaCarousel"
import type { EventHandlerType } from "./EventHandler"
import type { EventStoreType } from "./EventStore"
import type { TNativeCarouselDocument, TNativeCarouselEventMap, TNativeCarouselNode } from "./nativeEnvironment"
import type { ScrollBodyType } from "./ScrollBody"
import type { ScrollToType } from "./ScrollTo"
import type { SlideRegistryType } from "./SlideRegistry"

export type FocusHandlerOptionType =
  | boolean
  | ((api: EmblaCarouselType, event: TNativeCarouselEventMap["focus"]) => boolean | void)
export type SlideFocusType = { init: (api: EmblaCarouselType) => void }
export const SlideFocus = (
  _root: TNativeCarouselNode,
  slides: TNativeCarouselNode[],
  registry: SlideRegistryType["slideRegistry"],
  scrollTo: ScrollToType,
  body: ScrollBodyType,
  store: EventStoreType,
  events: EventHandlerType,
  watch: FocusHandlerOptionType,
  document: TNativeCarouselDocument,
): SlideFocusType => {
  let lastTab = Number.NEGATIVE_INFINITY
  return {
    init: (api) => {
      if (!watch) return
      store.add(document, "keyDown", (event) => {
        if (event.nativeEvent.key === "Tab") lastTab = Date.now()
      })
      slides.forEach((slide, index) =>
        store.add(slide, "focus", (event) => {
          if (typeof watch === "function" && !watch(api, event)) return
          if (Date.now() - lastTab > 10) return
          const group = registry.findIndex((entry) => entry.includes(index))
          events.emit("slideFocusStart")
          body.useDuration(0)
          scrollTo.index(group, 0)
          events.emit("slideFocus")
        }),
      )
    },
  }
}
