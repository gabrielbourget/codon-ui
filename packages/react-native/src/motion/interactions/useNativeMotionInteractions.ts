import { useInsertionEffect, useLayoutEffect, useRef, useState } from "react"

import { nativeKeyTokens } from "../../input/keyScope"
import type { TNativeKeyScope } from "../../input/keyScope"
import { useNativePressability } from "../../input/nativePressability"
import type { NativeMotionOwner, TNativeMotionOwnerProps } from "../owner/NativeMotionOwner"
import type { TNativeMotionVisualHostProps } from "../visual/types"

import { NativeMotionInteractions } from "./NativeMotionInteractions"
import { NativeMotionPan } from "./NativeMotionPan"

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
  const enabled = tapConfigured && !isStatic
  const keyboardEnabled =
    enabled && (visual.tabIndex === undefined ? visual.focusable !== false : visual.tabIndex === 0)
  const handlers = useNativePressability({
    disabled: !enabled,
    onPressIn: (event) => interaction.start(event, "pointer"),
    onPressMove: interaction.move,
    onPress: (event) => interaction.end(event, true, "pointer"),
  })
  useLayoutEffect(() => {
    interaction.refresh()
    pan.refresh()
    return scope?.subscribe(() => {
      interaction.refresh()
      pan.refresh()
    })
  }, [interaction, pan, scope, visual, enabled])
  useInsertionEffect(
    () => () => {
      interaction.retire()
      pan.retire()
    },
    [interaction, pan],
  )
  const result: Partial<TNativeMotionVisualHostProps> = {
    onTouchStart: panEnabled
      ? (event) => {
          visual.onTouchStart?.(event)
          pan.start(event)
        }
      : visual.onTouchStart,
    onTouchMove: panEnabled
      ? (event) => {
          visual.onTouchMove?.(event)
          pan.move(event)
        }
      : visual.onTouchMove,
    onTouchEnd: panEnabled
      ? (event) => {
          visual.onTouchEnd?.(event)
          pan.finish(event)
        }
      : visual.onTouchEnd,
    onTouchCancel: panEnabled
      ? (event) => {
          visual.onTouchCancel?.(event)
          pan.finish(event, true)
        }
      : visual.onTouchCancel,
    nativePressable: visual.nativePressable || enabled,
    focusable: visual.focusable ?? (tapConfigured ? true : undefined),
    capturedKeys: [...new Set([...(visual.capturedKeys ?? []), ...(keyboardEnabled ? activationKeys : [])])],
    onStartShouldSetResponder: (event) =>
      visual.onStartShouldSetResponder
        ? visual.onStartShouldSetResponder(event)
        : (handlers.onStartShouldSetResponder?.(event) ?? false),
    onResponderGrant: (event) => {
      visual.onResponderGrant?.(event)
      if (!event.isDefaultPrevented?.()) handlers.onResponderGrant?.(event)
    },
    onResponderMove: (event) => {
      visual.onResponderMove?.(event)
      handlers.onResponderMove?.(event)
    },
    onResponderRelease: (event) => {
      visual.onResponderRelease?.(event)
      try {
        handlers.onResponderRelease?.(event)
      } finally {
        interaction.end(event, false, "pointer")
      }
    },
    onResponderTerminate: (event) => {
      visual.onResponderTerminate?.(event)
      try {
        handlers.onResponderTerminate?.(event)
      } finally {
        interaction.end(event, false, "pointer")
      }
    },
    onResponderTerminationRequest: (event) =>
      visual.onResponderTerminationRequest
        ? visual.onResponderTerminationRequest(event)
        : (handlers.onResponderTerminationRequest?.(event) ?? true),
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
    },
    onPointerMove: (event) => {
      visual.onPointerMove?.(event)
      pan.move(event)
    },
    onPointerUp: (event) => {
      visual.onPointerUp?.(event)
      interaction.hoverPointerUp(event)
      pan.finish(event)
    },
    onPointerCancel: (event) => {
      visual.onPointerCancel?.(event)
      interaction.hoverPointerUp(event)
      pan.finish(event, true)
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
      interaction.activation(event)
    },
  }
  return result
}
