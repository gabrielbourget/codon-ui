import { useInsertionEffect, useRef, useState } from "react"
import type { PointerEvent } from "react-native"

import type { TNativeKeyboardEvent } from "../../input/types"
import { handleNativeDateGroupKey } from "../entry/groupKey"

import type { NativeDateFieldFocusManager } from "./focus"

type TOptions = {
  enabled: boolean
  disabled: boolean
  direction: "ltr" | "rtl"
  focus: NativeDateFieldFocusManager
  admitPointer?: (target: object) => boolean
  onContainedKeyDown?: (event: TNativeKeyboardEvent) => void
  onKeyDown?: (event: TNativeKeyboardEvent) => void
  onKeyUp?: (event: TNativeKeyboardEvent) => void
}
export class NativeOrdinaryDatePress {
  private contact: { root: object; pointerId: number; pointerType: string; time: number; focus: () => boolean } | null =
    null
  constructor(private readonly options: () => TOptions) {}
  retire = () => {
    this.contact = null
  }
  receive = (event: PointerEvent, phase: "down" | "up" | "cancel" | "click") => {
    const options = this.options(),
      data = event.nativeEvent
    if (!options.enabled || options.disabled) {
      this.retire()
      return
    }
    if (phase === "cancel") {
      if (this.contact?.pointerId === data.pointerId) this.retire()
      return
    }
    if (phase === "up") return
    if (data.button !== 0 || !event.target || typeof event.target !== "object") return
    if (options.admitPointer && !options.admitPointer(event.target)) return
    if (phase === "down") {
      this.retire()
      const focus = options.focus.capturePress(event.target)
      if (!focus) return
      this.contact = {
        root: event.currentTarget,
        pointerId: data.pointerId,
        pointerType: data.pointerType,
        time: event.timeStamp,
        focus,
      }
      if (data.pointerType === "mouse") focus()
      event.stopPropagation()
    } else {
      const contact = this.contact
      this.retire()
      if (
        !contact ||
        contact.root !== event.currentTarget ||
        contact.pointerId !== data.pointerId ||
        contact.pointerType !== data.pointerType ||
        event.timeStamp < contact.time
      )
        return
      if (data.pointerType === "touch" || data.pointerType === "pen") contact.focus()
      event.stopPropagation()
    }
  }
}
export const useNativeOrdinaryDateGroup = (options: TOptions) => {
  const current = useRef(options)
  const [press] = useState(() => new NativeOrdinaryDatePress(() => current.current))
  useInsertionEffect(() => {
    current.current = options
    if (!options.enabled || options.disabled) press.retire()
  })
  useInsertionEffect(() => press.retire, [press])
  return {
    key: (event: TNativeKeyboardEvent) => {
      const value = current.current,
        data = event.nativeEvent
      if (!value.enabled || value.disabled) return
      if (data.phase === "down" && !data.cancelled) {
        value.onContainedKeyDown?.(event)
        handleNativeDateGroupKey(event, value.direction, value.focus)
      }
      if (current.current.enabled && !current.current.disabled) {
        const callback = data.phase === "down" ? current.current.onKeyDown : current.current.onKeyUp
        callback?.(event)
      }
    },
    pointer: options.enabled
      ? {
          onPointerDown: (event: PointerEvent) => press.receive(event, "down"),
          onPointerUp: (event: PointerEvent) => press.receive(event, "up"),
          onPointerCancel: (event: PointerEvent) => press.receive(event, "cancel"),
          onClick: (event: PointerEvent) => press.receive(event, "click"),
        }
      : {},
  }
}
