import { useInsertionEffect, useLayoutEffect, useRef, useState } from "react"

import { nativeKeyTokens } from "../../input/keyScope"
import type { TNativeKeyScope } from "../../input/keyScope"
import type { NativeMotionOwner, TNativeMotionOwnerProps } from "../owner/NativeMotionOwner"
import type { TNativeMotionVisualHostProps } from "../visual/types"

import { NativeMotionDrag } from "./NativeMotionDrag"
import { NativeMotionInteractions } from "./NativeMotionInteractions"
import { NativeMotionPan } from "./NativeMotionPan"
import type { TNativeMotionPanEvent } from "./types"
import { useNativeMotionWindowTap } from "./useNativeMotionWindowTap"

const activationKeys = [...nativeKeyTokens("Enter"), ...nativeKeyTokens(" ")]
export const useNativeMotionInteractions = (
  owner: NativeMotionOwner,
  motion: TNativeMotionOwnerProps,
  isStatic: boolean | undefined,
  visual: TNativeMotionVisualHostProps,
  scope: TNativeKeyScope | null,
  error: (error: unknown) => void,
): Partial<TNativeMotionVisualHostProps> => {
  const committed = useRef({ scope, error })
  useInsertionEffect(() => {
    committed.current = { scope, error }
  })
  const [interaction] = useState(
    () =>
      new NativeMotionInteractions(
        owner,
        () => {
          const scope = committed.current.scope
          if (!scope) return owner.captureVisualLease()
          const attachment = owner.captureAttachmentLease()
          const identity = () => {
            const current = committed.current.scope
            const session = current?.acknowledgedSession()
            return JSON.stringify([current?.ownerId, session?.windowId, session?.epoch])
          }
          const expected = identity()
          return () => attachment() && identity() === expected
        },
        (failure) => committed.current.error(failure),
      ),
  )
  const tapConfigured = Boolean(motion.whileTap || motion.onTap || motion.onTapStart || motion.onTapCancel)
  const panEnabled =
    !isStatic && Boolean(motion.onPan || motion.onPanStart || motion.onPanEnd || motion.onPanSessionStart)
  const [pan] = useState(() => new NativeMotionPan(owner, (failure) => committed.current.error(failure)))
  const [drag] = useState(
    () =>
      new NativeMotionDrag(
        owner,
        (failure) => committed.current.error(failure),
        () => committed.current.scope,
        interaction.cancel,
      ),
  )
  const dragEnabled = !isStatic && Boolean(motion.drag)
  const startDrag = (event: TNativeMotionPanEvent) => {
    if (!dragEnabled || motion.dragListener === false) return
    type TNativeTarget = { readonly nodeName?: string; readonly parentElement?: TNativeTarget | null }
    let target = event.target as TNativeTarget | null
    while (target && target !== owner.current) {
      if (target.nodeName === "RN:TextInput") return
      target = target.parentElement ?? null
    }
    drag.start(event)
  }
  const enabled = tapConfigured && !isStatic
  const keyboardEnabled =
    enabled && (visual.tabIndex === undefined ? visual.focusable !== false : visual.tabIndex === 0)
  useNativeMotionWindowTap(owner, interaction, enabled, error)
  useLayoutEffect(() => {
    interaction.refresh()
    pan.refresh()
    drag.refresh()
    return scope?.subscribe(() => {
      interaction.refresh()
      pan.refresh()
      drag.refresh()
    })
  }, [interaction, pan, drag, scope, visual, enabled])
  useInsertionEffect(
    () => () => {
      interaction.retire()
      pan.retire()
      drag.retire()
    },
    [interaction, pan, drag],
  )
  const result: Partial<TNativeMotionVisualHostProps> = {
    onTouchStart:
      panEnabled || dragEnabled
        ? (event) => {
            visual.onTouchStart?.(event)
            pan.start(event)
            startDrag(event)
          }
        : visual.onTouchStart,
    onTouchMove:
      panEnabled || dragEnabled
        ? (event) => {
            visual.onTouchMove?.(event)
            pan.move(event)
            drag.move(event)
          }
        : visual.onTouchMove,
    onTouchEnd:
      panEnabled || dragEnabled
        ? (event) => {
            visual.onTouchEnd?.(event)
            pan.finish(event)
            drag.finish(event)
          }
        : visual.onTouchEnd,
    onTouchCancel:
      panEnabled || dragEnabled
        ? (event) => {
            visual.onTouchCancel?.(event)
            pan.finish(event, true)
            drag.finish(event, true)
          }
        : visual.onTouchCancel,
    nativePressable: visual.nativePressable || enabled,
    focusable: visual.focusable ?? (tapConfigured ? true : undefined),
    capturedKeys: [...new Set([...(visual.capturedKeys ?? []), ...(keyboardEnabled ? activationKeys : [])])],
    onPointerEnter: (event) => {
      visual.onPointerEnter?.(event)
      interaction.hoverStart(event)
    },
    onPointerLeave: (event) => {
      visual.onPointerLeave?.(event)
      interaction.hoverEnd(event)
    },
    onPointerDown: (event) => {
      visual.onPointerDown?.(event)
      interaction.hoverPointerDown()
      pan.start(event)
      startDrag(event)
    },
    onPointerMove: (event) => {
      visual.onPointerMove?.(event)
      pan.move(event)
      drag.move(event)
    },
    onPointerUp: (event) => {
      visual.onPointerUp?.(event)
      interaction.hoverPointerUp(event)
      pan.finish(event)
      drag.finish(event)
    },
    onPointerCancel: (event) => {
      visual.onPointerCancel?.(event)
      interaction.hoverPointerUp(event)
      pan.finish(event, true)
      drag.finish(event, true)
    },
    onFocus: (event) => {
      visual.onFocus?.(event)
      interaction.focus(event)
    },
    onBlur: (event) => {
      visual.onBlur?.(event)
      interaction.blur()
    },
    onKeyDown: (event) => {
      visual.onKeyDown?.(event)
      interaction.keyDown(event)
    },
    onKeyUp: (event) => {
      visual.onKeyUp?.(event)
      interaction.keyUp(event)
    },
    onNativeActivation: (event) => {
      visual.onNativeActivation?.(event)
    },
  }
  return result
}
