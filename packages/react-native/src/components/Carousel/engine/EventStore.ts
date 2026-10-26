import type {
  TNativeCarouselDocument,
  TNativeCarouselEventMap,
  TNativeCarouselListenerOptions,
  TNativeCarouselNode,
  TNativeCarouselWindow,
} from "./nativeEnvironment"

type TEnvironment = TNativeCarouselDocument["environment"]
export type EventStoreType = {
  add: <K extends keyof TNativeCarouselEventMap>(
    node: TNativeCarouselNode | TNativeCarouselDocument | TNativeCarouselWindow,
    name: K,
    receive: (event: TNativeCarouselEventMap[K]) => void,
    options?: TNativeCarouselListenerOptions,
  ) => EventStoreType
  clear: () => void
}
export const EventStore = (environment: TEnvironment): EventStoreType => {
  const removers = new Set<() => void>()
  const store: EventStoreType = {
    add: (node, name, receive, options) => {
      const events = "environment" in node ? node.events : environment.binding(node).events
      removers.add(events.subscribe(name, receive, options))
      return store
    },
    clear: () => {
      const current = [...removers]
      removers.clear()
      for (const remove of current) remove()
    },
  }
  return store
}
