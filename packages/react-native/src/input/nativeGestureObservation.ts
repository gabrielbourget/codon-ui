import type { GestureResponderEvent, ViewProps } from "react-native"

import type { TNativeKeyScope } from "./keyScope"

type TPointer = Parameters<NonNullable<ViewProps["onPointerMove"]>>[0]
export type TNativeObservedGestureEvent = GestureResponderEvent | TPointer
type TObservation = {
  scope: () => TNativeKeyScope | null
  current: () => boolean
  move: (event: TNativeObservedGestureEvent) => void
  end: (event: TNativeObservedGestureEvent, cancelled: boolean) => void
}
const observations = new Set<TObservation>()
export const observeNativeGestureWindow = (observation: TObservation) => {
  observations.add(observation)
  return () => {
    observations.delete(observation)
  }
}
// Existing bubbling events are observed after caller handlers, without taking the responder or preventing defaults.
export const dispatchNativeGestureWindow = (
  scope: TNativeKeyScope,
  event: TNativeObservedGestureEvent,
  phase: "move" | "end" | "cancel",
) => {
  const windowId = scope.acknowledgedSession().windowId
  if (!windowId || scope.isWindowActive() === false) return
  for (const observation of [...observations]) {
    const ownerScope = observation.scope()
    if (
      !observation.current() ||
      !ownerScope ||
      ownerScope.isWindowActive() === false ||
      ownerScope.acknowledgedSession().windowId !== windowId
    )
      continue
    if (phase === "move") observation.move(event)
    else observation.end(event, phase === "cancel")
  }
}
