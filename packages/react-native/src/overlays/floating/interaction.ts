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
type TTapObserver = Readonly<{
  handle: (inside: boolean) => void
  includeEmptySpace: boolean
}>
const tapDistance = (start: GestureResponderEvent, end: GestureResponderEvent) =>
  Math.hypot(end.nativeEvent.pageX - start.nativeEvent.pageX, end.nativeEvent.pageY - start.nativeEvent.pageY)

const deferNativeInteraction = (work: () => void) => {
  void Promise.resolve().then(work)
}

export const createNativeFloatingInteractions = (
  capture: () => TCapture | null,
  defer: (work: () => void) => void = deferNativeInteraction,
) => {
  let live = true
  const inside = new WeakMap<object, Set<string>>()
  const tapObservers = new Map<string, TTapObserver>()
  const tapTargetSubscribers = new Set<() => void>()
  const needsTapTarget = () => [...tapObservers.values()].some((observer) => observer.includeEmptySpace)
  const notifyTapTarget = (previous: boolean) => {
    if (previous !== needsTapTarget()) for (const notify of tapTargetSubscribers) notify()
  }
  const taps = new Map<
    GestureResponderEvent["nativeEvent"]["identifier"],
    {
      event: GestureResponderEvent
      observers: ReadonlyMap<string, TTapObserver>
    }
  >()
  const gestures = new Map<
    GestureResponderEvent["nativeEvent"]["identifier"],
    { target: TCapture; outside: boolean | null; cancelled: boolean; completed: boolean }
  >()
  return {
    needsTapTarget,
    subscribeTapTarget: (notify: () => void) => {
      tapTargetSubscribers.add(notify)
      return () => {
        tapTargetSubscribers.delete(notify)
      }
    },
    observeTap: (id: string, handle: (inside: boolean) => void, includeEmptySpace = false) => {
      const observer = { handle, includeEmptySpace }
      const previous = needsTapTarget()
      tapObservers.set(id, observer)
      notifyTapTarget(previous)
      return () => {
        if (tapObservers.get(id) !== observer) return
        const previous = needsTapTarget()
        tapObservers.delete(id)
        notifyTapTarget(previous)
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
    move: (event: GestureResponderEvent) => {
      if ((event.nativeEvent.touches?.length ?? 0) > 1) taps.clear()
      else {
        const identifier = event.nativeEvent.identifier
        const tap = taps.get(identifier)
        if (tap && tapDistance(tap.event, event) >= 15) taps.delete(identifier)
      }
    },
    end: (event: GestureResponderEvent) => {
      if (!live) return
      const identifier = event.nativeEvent.identifier
      const tap = taps.get(identifier)
      taps.delete(identifier)
      if (tap) {
        event.persist()
        defer(() => {
          // A child stopping bubbling does not cancel a completed tap.
          if (!live || !(tapDistance(tap.event, event) < 15)) return
          const start = tap.event.nativeEvent
          const end = event.nativeEvent
          for (const [id, observer] of tap.observers) {
            if (tapObservers.get(id) !== observer) continue
            const beganInside = inside.get(start)?.has(id) ?? false
            const endedInside = inside.get(end)?.has(id) ?? false
            if (beganInside === endedInside) observer.handle(endedInside)
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
      tapTargetSubscribers.clear()
    },
  }
}
