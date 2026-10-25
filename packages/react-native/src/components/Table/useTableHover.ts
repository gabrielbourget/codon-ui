/* Adapted from React Aria 3.48.0 useHover; Apache-2.0. See ../../collection/LICENSE.react-aria.md. */
import { useCallback, useInsertionEffect, useLayoutEffect, useRef, useState, type RefObject } from "react"
import type { PointerEvent, View, ViewProps } from "react-native"

import { useNativeKeyScope } from "../../input/NativeKeyboardScope"
import type { TNativeButtonProps } from "../Button/types"

export type TNativeTableHoverEvents = Pick<TNativeButtonProps, "onHoverStart" | "onHoverEnd" | "onHoverChange">
type TProps = TNativeTableHoverEvents & Pick<ViewProps, "onPointerEnter" | "onPointerLeave">
type TLease = { event: PointerEvent; host: View }

// Native pointer hover is independent of row selection and action admission.
export const useTableHover = (target: RefObject<View | null>, canAct: () => boolean, props: TProps) => {
  const input = useNativeKeyScope()
  const [isHovered, setHovered] = useState(false)
  const pointer = useRef<TLease | null>(null)
  const live = useRef(false)
  const current = useRef({ target, canAct, props })
  useInsertionEffect(() => {
    current.current = { target, canAct, props }
  })
  useInsertionEffect(() => {
    live.current = true
    return () => {
      live.current = false
      pointer.current = null
    }
  }, [])
  const eligible = useCallback(
    () => live.current && current.current.target.current !== null && current.current.canAct(),
    [],
  )
  const finishCallbacks = useCallback((event?: PointerEvent) => {
    const lease = pointer.current
    if (!lease) return
    pointer.current = null
    setHovered(false)
    current.current.props.onHoverEnd?.(event ?? lease.event)
    if (live.current) current.current.props.onHoverChange?.(false)
  }, [])
  const retire = useCallback(() => {
    const lease = pointer.current
    if (lease && (!eligible() || lease.host !== current.current.target.current)) {
      finishCallbacks()
    }
  }, [eligible, finishCallbacks])
  useLayoutEffect(retire)
  useLayoutEffect(() => input?.subscribe(retire), [input, retire])
  return {
    isPointerOver: isHovered,
    isHovered,
    onPointerEnter: (event: PointerEvent) => {
      current.current.props.onPointerEnter?.(event)
      if (event.nativeEvent.pointerType === "touch" || !eligible() || pointer.current) return
      event.persist?.()
      pointer.current = { event, host: current.current.target.current! }
      setHovered(true)
      current.current.props.onHoverStart?.(event)
      if (live.current && eligible() && pointer.current) current.current.props.onHoverChange?.(true)
    },
    onPointerLeave: (event: PointerEvent) => {
      current.current.props.onPointerLeave?.(event)
      if (event.nativeEvent.pointerType === "touch" || !live.current) return
      finishCallbacks(event)
    },
  }
}
