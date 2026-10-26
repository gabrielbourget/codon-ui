import type { EmblaCarouselType } from "./EmblaCarousel"
import type { EventHandlerType } from "./EventHandler"
import type { TNativeCarouselDocument, TNativeCarouselMutation, TNativeCarouselNode } from "./nativeEnvironment"

export type SlidesHandlerOptionType =
  | boolean
  | ((api: EmblaCarouselType, mutations: readonly TNativeCarouselMutation[]) => boolean | void)
export type SlidesHandlerType = { init: (api: EmblaCarouselType) => void; destroy: () => void }
export const SlidesHandler = (
  container: TNativeCarouselNode,
  events: EventHandlerType,
  watch: SlidesHandlerOptionType,
  document: TNativeCarouselDocument,
): SlidesHandlerType => {
  let remove: (() => void) | undefined
  return {
    init: (api) => {
      if (!watch) return
      remove = document.environment.binding(container).events.subscribe("mutations", (mutations) => {
        if (typeof watch === "function" && !watch(api, mutations)) return
        if (mutations.some((entry) => entry.target === container)) {
          api.reInit()
          events.emit("slidesChanged")
        }
      })
    },
    destroy: () => {
      remove?.()
      remove = undefined
    },
  }
}
