import { useCallback, useId, useInsertionEffect, useLayoutEffect, useRef, useState } from "react"
import { findNodeHandle, type TextInput, type View } from "react-native"

import { useNativeWindowPointers } from "../../input/NativeKeyboardScope"
import type { TNativeWindowPointerEvent } from "../../input/nativeWindowPointers"

type TOption = {
  target: View
  current: () => boolean
  release: (event: TNativeWindowPointerEvent) => void
}
type TOwner = {
  input: React.RefObject<TextInput | null>
  enabled: boolean
  isOpen: boolean
  query: string
}

// The trigger exists before the popup. Its passive window claim can observe a release on a newly mounted option.
export const useNativeComboBoxPointerSelection = (owner: TOwner) => {
  const pointers = useNativeWindowPointers()
  const key = useId()
  const [trigger, triggerRef] = useState<View | null>(null)
  const current = useRef(owner)
  const options = useRef(new Map<number, TOption>())
  const live = useRef(false)
  const cycle = useRef<{
    input: TextInput | null
    query: string
    current: () => boolean
    event: TNativeWindowPointerEvent
  } | null>(null)
  useInsertionEffect(() => {
    const started = cycle.current
    if (
      started &&
      (!owner.enabled ||
        owner.input.current !== started.input ||
        owner.query !== started.query ||
        (current.current.isOpen && !owner.isOpen))
    )
      cycle.current = null
    current.current = owner
  })
  useInsertionEffect(() => {
    live.current = true
    return () => {
      live.current = false
      cycle.current = null
      options.current.clear()
    }
  }, [])
  useLayoutEffect(() => {
    if (!pointers || !trigger) return
    const targetTag = findNodeHandle(trigger)
    if (!targetTag) return
    const release = pointers.register(key, {
      targetTag,
      global: true,
      stopPropagation: false,
      current: () => live.current && current.current.enabled && findNodeHandle(trigger) === targetTag,
      start: (event, admitted) => {
        cycle.current = null
        const data = event.nativeEvent
        if (data.pointerType !== "mouse" || data.button !== 0 || event.defaultPrevented || event.isDefaultPrevented?.())
          return false
        event.persist()
        cycle.current = {
          input: current.current.input.current,
          query: current.current.query,
          current: admitted,
          event,
        }
        return true
      },
      move: () => {},
      end: (event, success) => {
        const started = cycle.current
        cycle.current = null
        const latest = current.current
        if (
          !success ||
          event.nativeEvent.pointerType !== "mouse" ||
          !started?.current() ||
          !latest.enabled ||
          !latest.isOpen ||
          latest.input.current !== started.input ||
          latest.query !== started.query ||
          started.event.defaultPrevented ||
          started.event.isDefaultPrevented?.() ||
          event.defaultPrevented ||
          event.isDefaultPrevented?.()
        )
          return
        const data = event.nativeEvent
        for (const hit of [...data.registrations].sort((left, right) => left.depth - right.depth)) {
          if (hit.depth < 0 || !pointers.select(data, hit)) continue
          const option = options.current.get(hit.targetTag)
          if (!option || !option.current() || findNodeHandle(option.target) !== hit.targetTag) continue
          option.release(event)
          break
        }
      },
      activate: () => {},
      retire: () => {
        cycle.current = null
      },
    })
    pointers.flush()
    return release
  }, [pointers, trigger, key])
  const registerOption = useCallback(
    (identity: string, option: TOption) => {
      const targetTag = findNodeHandle(option.target)
      if (!pointers || !targetTag) return () => {}
      options.current.set(targetTag, option)
      const release = pointers.register(`${key}:${identity}`, {
        targetTag,
        global: false,
        stopPropagation: false,
        current: () =>
          live.current &&
          current.current.enabled &&
          current.current.isOpen &&
          options.current.get(targetTag) === option &&
          option.current() &&
          findNodeHandle(option.target) === targetTag,
        start: () => false,
        move: () => {},
        end: () => {},
        activate: () => {},
        retire: () => {},
      })
      pointers.flush()
      return () => {
        if (options.current.get(targetTag) === option) options.current.delete(targetTag)
        release()
      }
    },
    [pointers, key],
  )
  return { triggerRef, registerOption }
}

export type TNativeComboBoxPointerOptionRegistration = ReturnType<
  typeof useNativeComboBoxPointerSelection
>["registerOption"]
