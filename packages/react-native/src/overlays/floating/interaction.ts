import type { GestureResponderEvent, ViewProps } from "react-native"

export type TNativeFloatingFocusEvent = Parameters<NonNullable<ViewProps["onFocus"]>>[0]
export type TNativeFloatingOutsideInteraction = Readonly<
  | { target: GestureResponderEvent["target"]; event: GestureResponderEvent; kind?: "touch" }
  | { target: TNativeFloatingFocusEvent["target"]; event: TNativeFloatingFocusEvent; kind: "focus" }
>
type TCapture = {
  id: string
  isCurrent: () => boolean
  invoke: (interaction: TNativeFloatingOutsideInteraction) => void
}
const deferNativeInteraction = (work: () => void) => {
  void Promise.resolve().then(work)
}

export const createNativeFloatingInteractions = (
  capture: () => TCapture | null,
  defer: (work: () => void) => void = deferNativeInteraction,
) => {
  let live = true
  const inside = new WeakMap<object, Set<string>>()
  const tapObservers = new Map<string, (inside: boolean) => void>()
  const taps = new Map<
    GestureResponderEvent["nativeEvent"]["identifier"],
    {
      event: GestureResponderEvent
      observers: ReadonlyMap<string, (inside: boolean) => void>
    }
  >()
  const gestures = new Map<
    GestureResponderEvent["nativeEvent"]["identifier"],
    { target: TCapture; outside: boolean | null; cancelled: boolean; completed: boolean }
  >()
  return {
    observeTap: (id: string, observer: (inside: boolean) => void) => {
      tapObservers.set(id, observer)
      return () => {
        if (tapObservers.get(id) === observer) tapObservers.delete(id)
      }
    },
    mark: (id: string, event: GestureResponderEvent | TNativeFloatingFocusEvent) => {
      const owners = inside.get(event.nativeEvent) ?? new Set<string>()
      owners.add(id)
      inside.set(event.nativeEvent, owners)
    },
    focus: (event: TNativeFloatingFocusEvent) => {
      if (!live) return
      const target = capture()
      if (!target) return
      event.persist()
      defer(() => {
        if (
          !live ||
          !target.isCurrent() ||
          inside.get(event.nativeEvent)?.has(target.id) ||
          event.isPropagationStopped()
        )
          return
        target.invoke({ target: event.target, event, kind: "focus" })
      })
    },
    start: (event: GestureResponderEvent) => {
      if (!live) return
      if (tapObservers.size) {
        if ((event.nativeEvent.touches?.length ?? 0) > 1) taps.clear()
        else {
          event.persist()
          taps.set(event.nativeEvent.identifier, { event, observers: new Map(tapObservers) })
        }
      }
      const target = capture()
      if (!target) return
      event.persist()
      const identifier = event.nativeEvent.identifier
      const gesture = { target, outside: null as boolean | null, cancelled: false, completed: false }
      gestures.set(identifier, gesture)
      defer(() => {
        if (!live || gesture.cancelled || !target.isCurrent()) return
        const isInside = inside.get(event.nativeEvent)?.has(target.id) ?? false
        if (!isInside && event.isPropagationStopped()) return
        gesture.outside = !isInside
      })
    },
    end: (event: GestureResponderEvent) => {
      if (!live) return
      const identifier = event.nativeEvent.identifier
      const tap = taps.get(identifier)
      taps.delete(identifier)
      if (tap) {
        event.persist()
        defer(() => {
          if (!live || tap.event.isPropagationStopped() || event.isPropagationStopped()) return
          const start = tap.event.nativeEvent
          const end = event.nativeEvent
          if (!(Math.hypot(end.pageX - start.pageX, end.pageY - start.pageY) < 15)) return
          for (const [id, observer] of tap.observers) {
            if (tapObservers.get(id) !== observer) continue
            const beganInside = inside.get(start)?.has(id) ?? false
            const endedInside = inside.get(end)?.has(id) ?? false
            if (beganInside === endedInside) observer(endedInside)
          }
        })
      }
      const gesture = gestures.get(identifier)
      if (!gesture || gesture.completed) return
      gesture.completed = true
      event.persist()
      defer(() => {
        if (gestures.get(identifier) === gesture) gestures.delete(identifier)
        if (!live || gesture.cancelled || !gesture.outside || !gesture.target.isCurrent()) return
        if (inside.get(event.nativeEvent)?.has(gesture.target.id) || event.isPropagationStopped()) return
        gesture.target.invoke({ target: event.target, event })
      })
    },
    cancel: (event: GestureResponderEvent) => {
      const identifier = event.nativeEvent.identifier
      taps.delete(identifier)
      const gesture = gestures.get(identifier)
      if (gesture) gesture.cancelled = true
      gestures.delete(identifier)
    },
    dispose: () => {
      live = false
      gestures.clear()
      taps.clear()
      tapObservers.clear()
    },
  }
}
