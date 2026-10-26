// Adapted from Embla Carousel8.6.0; MIT notice in LICENSE.
import type { EmblaCarouselType } from "./EmblaCarousel"

type CallbackType = (emblaApi: EmblaCarouselType, evt: EmblaEventType) => void
type ListenersType = Partial<{ [key in EmblaEventType]: CallbackType[] }>

export type EmblaEventType = EmblaEventListType[keyof EmblaEventListType]

export interface EmblaEventListType {
  init: "init"
  pointerDown: "pointerDown"
  pointerUp: "pointerUp"
  slidesChanged: "slidesChanged"
  slidesInView: "slidesInView"
  scroll: "scroll"
  select: "select"
  settle: "settle"
  destroy: "destroy"
  reInit: "reInit"
  resize: "resize"
  slideFocusStart: "slideFocusStart"
  slideFocus: "slideFocus"
}

export type EventHandlerType = {
  init: (emblaApi: EmblaCarouselType) => void
  emit: (evt: EmblaEventType) => EventHandlerType
  on: (evt: EmblaEventType, cb: CallbackType) => EventHandlerType
  off: (evt: EmblaEventType, cb: CallbackType) => EventHandlerType
  clear: () => void
  hasListeners: (event: EmblaEventType) => boolean
  subscribeListeners: (receive: () => void) => () => void
}

export function EventHandler(): EventHandlerType {
  let listeners: ListenersType = {}
  let api: EmblaCarouselType
  const changes = new Set<() => void>()

  function init(emblaApi: EmblaCarouselType): void {
    api = emblaApi
  }

  function getListeners(evt: EmblaEventType): CallbackType[] {
    return listeners[evt] || []
  }

  function emit(evt: EmblaEventType): EventHandlerType {
    getListeners(evt).forEach((e) => e(api, evt))
    return self
  }

  function on(evt: EmblaEventType, cb: CallbackType): EventHandlerType {
    listeners[evt] = getListeners(evt).concat([cb])
    changes.forEach((receive) => receive())
    return self
  }

  function off(evt: EmblaEventType, cb: CallbackType): EventHandlerType {
    listeners[evt] = getListeners(evt).filter((e) => e !== cb)
    changes.forEach((receive) => receive())
    return self
  }

  function clear(): void {
    listeners = {}
    changes.forEach((receive) => receive())
  }

  const self: EventHandlerType = {
    init,
    emit,
    off,
    on,
    clear,
    hasListeners: (event) => getListeners(event).length > 0,
    subscribeListeners: (receive) => {
      changes.add(receive)
      return () => changes.delete(receive)
    },
  }
  return self
}
