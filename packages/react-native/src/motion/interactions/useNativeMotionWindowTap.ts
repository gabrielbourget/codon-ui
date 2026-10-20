import { useId, useInsertionEffect, useLayoutEffect, useRef } from "react"
import { findNodeHandle } from "react-native"

import { useNativeWindowPointers } from "../../input/NativeKeyboardScope"
import type { NativeMotionOwner } from "../owner/NativeMotionOwner"

import type { NativeMotionInteractions } from "./NativeMotionInteractions"

export const useNativeMotionWindowTap = (
  owner: NativeMotionOwner,
  interaction: NativeMotionInteractions,
  enabled: boolean,
  error: (failure: unknown) => void,
) => {
  const pointers = useNativeWindowPointers()
  const key = useId()
  const registration = useRef<{ target: NativeMotionOwner["current"]; release: () => void } | undefined>(undefined)
  useLayoutEffect(() => {
    const target = owner.current
    if (registration.current && (!enabled || registration.current.target !== target)) {
      registration.current.release()
      registration.current = undefined
    }
    if (!enabled || registration.current) return
    if (!pointers || !target) {
      error(new Error("Native motion: tap observation requires an actual same-window NativeFloatingLayerHost"))
      return
    }
    const tag = findNodeHandle(target)
    if (!tag || !Number.isSafeInteger(tag) || target.isConnected === false) {
      error(new Error("Native motion: actual tap host unavailable"))
      return
    }
    const attachment = owner.captureAttachmentLease()
    const props = owner.getProps()
    registration.current = {
      target,
      release: pointers.register(key, {
        targetTag: tag,
        global: Boolean(props.globalTapTarget),
        stopPropagation: props.propagate?.tap === false,
        current: () =>
          attachment() && owner.current === target && target.isConnected !== false && findNodeHandle(target) === tag,
        start: (event, current) => interaction.start(event, "pointer", undefined, current),
        move: interaction.move,
        end: (event, success) => interaction.end(event, success, "pointer"),
        activate: interaction.activation,
        retire: interaction.cancel,
      }),
    }
    pointers.flush()
  })
  useLayoutEffect(
    () => () => {
      registration.current?.release()
      registration.current = undefined
    },
    [pointers],
  )
  useInsertionEffect(() => () => interaction.retire(), [interaction])
}
