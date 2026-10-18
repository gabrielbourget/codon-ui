import type { PointerEvent } from "react-native"

type TNativeToastGestureOptions = {
  canAct: () => boolean
  isTop: () => boolean
  onAmount: (amount: number) => void
  onDragging: (dragging: boolean) => void
  onDismiss: () => void
  now?: () => number
  lifetime?: () => string
}

export const createNativeToastGesture = (options: TNativeToastGestureOptions) => {
  let live = true
  let gesture: { id: number; x: number; y: number; started: number; amount: number; lifetime: string } | null = null
  const excluded = new WeakSet<PointerEvent["nativeEvent"]>()
  const now = options.now ?? Date.now
  const cancel = () => {
    gesture = null
    if (!live) return
    options.onAmount(0)
    options.onDragging(false)
  }
  return {
    cancel,
    exclude: (event: PointerEvent) => {
      if (live) excluded.add(event.nativeEvent)
    },
    down: (event: PointerEvent) => {
      if (!live || !options.canAct() || excluded.has(event.nativeEvent) || gesture) return
      const { pointerId, pageX, pageY } = event.nativeEvent
      if (![pointerId, pageX, pageY].every(Number.isFinite)) return
      gesture = { id: pointerId, x: pageX, y: pageY, started: now(), amount: 0, lifetime: options.lifetime?.() ?? "" }
      options.onDragging(true)
    },
    move: (event: PointerEvent) => {
      if (!live || !gesture || event.nativeEvent.pointerId !== gesture.id) return
      if (!options.canAct() || gesture.lifetime !== (options.lifetime?.() ?? "")) {
        cancel()
        return
      }
      const { pageX, pageY, pointerType } = event.nativeEvent
      if (![pageX, pageY].every(Number.isFinite)) {
        cancel()
        return
      }
      const amount = pageY - gesture.y
      const threshold = pointerType === "touch" ? 15 : 2
      const outward = options.isTop() ? Math.min(0, amount) : Math.max(0, amount)
      if (Math.abs(outward) > threshold) {
        gesture.amount = outward
        options.onAmount(outward)
      } else if (Math.abs(pageX - gesture.x) > threshold) cancel()
      else {
        gesture.amount = 0
        options.onAmount(0)
      }
    },
    up: (event: PointerEvent) => {
      if (!live || !gesture || event.nativeEvent.pointerId !== gesture.id) return
      const current = gesture
      gesture = null
      const velocity = Math.abs(current.amount) / Math.max(1, now() - current.started)
      if (
        options.canAct() &&
        current.lifetime === (options.lifetime?.() ?? "") &&
        (Math.abs(current.amount) >= 30 || velocity > 0.11)
      ) {
        options.onDragging(false)
        options.onDismiss()
      } else cancel()
    },
    pointerCancel: (event: PointerEvent) => {
      if (gesture?.id === event.nativeEvent.pointerId) cancel()
    },
    dispose: () => {
      live = false
      gesture = null
    },
  }
}
