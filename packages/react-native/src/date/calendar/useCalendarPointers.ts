import type { CalendarDate } from "@internationalized/date"
import { useCallback, useId, useInsertionEffect, useLayoutEffect, useRef } from "react"
import { findNodeHandle, type View } from "react-native"

import { useNativeWindowPointers } from "../../input/NativeKeyboardScope"
import type { TNativeWindowPointerEvent } from "../../input/nativeWindowPointers"

import type { TNativeCalendarState } from "./keys"
import type { NativeCalendarRangeGesture, TNativeCalendarPointer } from "./rangeGesture"
import type { TNativeCalendarTarget } from "./targets"

type TOwner = {
  root: React.RefObject<View | null>
  state: TNativeCalendarState
  revision: string
  canAct: () => boolean
  focusObserved: () => boolean
  gesture: NativeCalendarRangeGesture | null
  request: (date: CalendarDate, run: (state: TNativeCalendarState) => void) => void
}
type THit = { target: View; day: TNativeCalendarTarget | null; current: () => boolean }
const point = (event: TNativeWindowPointerEvent): TNativeCalendarPointer | null => {
  const { pointerType, pointerId } = event.nativeEvent
  return pointerType === "mouse" || pointerType === "touch" || pointerType === "pen"
    ? { id: pointerId, type: pointerType }
    : null
}

// Use the existing passive window observer and its original hit registrations.
// No responder, pointer capture, SDK flags or public event/default is changed.
export const useNativeCalendarPointers = (owner: TOwner) => {
  const pointers = useNativeWindowPointers(),
    key = useId(),
    current = useRef(owner),
    hits = useRef(new Map<number, THit>())
  const cycle = useRef<{
    revision: string
    origin: THit
    pointer: TNativeCalendarPointer
    current: () => boolean
  } | null>(null)
  useInsertionEffect(() => {
    current.current = owner
  })
  const hit = useCallback(
    (event: TNativeWindowPointerEvent) => {
      if (!pointers) return null
      for (const registration of [...event.nativeEvent.registrations].sort((a, b) => a.depth - b.depth)) {
        if (registration.depth < 0 || !pointers.select(event.nativeEvent, registration)) continue
        const value = hits.current.get(registration.targetTag)
        if (value && value.current() && findNodeHandle(value.target) === registration.targetTag) return value
      }
      return null
    },
    [pointers],
  )
  const register = useCallback(
    (target: View, day: TNativeCalendarTarget | null, active: () => boolean) => {
      const tag = findNodeHandle(target)
      if (!pointers || !tag) return () => {}
      const value: THit = { target, day, current: active }
      hits.current.set(tag, value)
      const release = pointers.register(`${key}:day:${tag}`, {
        targetTag: tag,
        global: false,
        stopPropagation: false,
        current: () =>
          current.current.canAct() && hits.current.get(tag) === value && active() && findNodeHandle(target) === tag,
        start: () => false,
        move: () => {},
        end: () => {},
        activate: () => {},
        retire: () => {},
      })
      pointers.flush()
      return () => {
        if (hits.current.get(tag) === value) hits.current.delete(tag)
        release()
      }
    },
    [pointers, key],
  )
  useLayoutEffect(() => {
    const root = owner.root.current,
      tag = root && findNodeHandle(root)
    if (!pointers || !root || !tag) return
    const release = pointers.register(key, {
      targetTag: tag,
      global: true,
      stopPropagation: false,
      current: () => current.current.canAct() && current.current.root.current === root && findNodeHandle(root) === tag,
      start: (event, admitted) => {
        const latest = current.current,
          observed = point(event),
          origin = hit(event)
        cycle.current = null
        if (
          !observed ||
          !origin?.day ||
          latest.state.isReadOnly ||
          latest.state.isDisabled ||
          event.defaultPrevented ||
          event.isDefaultPrevented?.()
        )
          return false
        event.persist()
        cycle.current = {
          revision: latest.revision,
          origin,
          pointer: { ...observed, target: origin.target },
          current: admitted,
        }
        if (latest.gesture) return latest.gesture.down(origin.day.date, { ...observed, target: origin.target })
        return !latest.state.isCellDisabled(origin.day.date) && !latest.state.isCellUnavailable(origin.day.date)
      },
      move: (event) => {
        const started = cycle.current,
          latest = current.current,
          selected = hit(event)
        if (started?.current() && started.revision === latest.revision) {
          if (selected?.target !== started.origin.target) latest.gesture?.exitOriginal()
          if (selected?.day) latest.gesture?.enter(selected.day.date, started.pointer)
        }
      },
      end: (event, success) => {
        const started = cycle.current,
          latest = current.current
        cycle.current = null
        if (!started || !success || !started.current() || started.revision !== latest.revision || !latest.canAct()) {
          latest.gesture?.cancel()
          return
        }
        const selected = hit(event)
        if (latest.gesture)
          latest.gesture.up(
            selected?.day?.date ?? null,
            { ...started.pointer, target: selected?.target },
            (!!selected && !selected.day) || !latest.focusObserved(),
            latest.focusObserved(),
          )
        else if (selected === started.origin && selected.day && selected.current())
          latest.request(selected.day.date, (state) => {
            if (
              !state.isReadOnly &&
              !state.isDisabled &&
              !state.isCellDisabled(selected.day!.date) &&
              !state.isCellUnavailable(selected.day!.date)
            ) {
              state.selectDate(selected.day!.date)
              state.setFocusedDate(selected.day!.date)
              state.setFocused(true)
            }
          })
      },
      activate: () => {},
      retire: () => {
        cycle.current = null
        current.current.gesture?.cancel()
      },
    })
    pointers.flush()
    return () => {
      cycle.current = null
      release()
    }
  }, [pointers, key, owner.root, hit])
  useLayoutEffect(() => {
    cycle.current = null
  }, [owner.revision])
  return { register, available: !!pointers }
}
