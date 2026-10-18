import {
  forwardRef,
  useCallback,
  useContext,
  useInsertionEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import type { GestureResponderEvent, MouseEvent, PressableProps, View } from "react-native"

import { NativeFloatingScopeContext, NativeFloatingWindowContext } from "../overlays/floating/scope"

import { nativeKeyTokens } from "./keyScope"
import { NativeFocusHost } from "./NativeFocusView"
import { useNativeKeyScope } from "./NativeKeyboardScope"
import { useNativeAndroidRipple, useNativePressability } from "./nativePressability"
import type {
  TNativeActivationEvent,
  TNativeFocusViewProps,
  TNativeInteractionEvent,
  TNativeKeyboardEvent,
  TNativePressEvent,
} from "./types"

type TCallbacks = {
  onPress?: (event: TNativePressEvent) => void
  onPressUp?: (event: TNativePressEvent) => void
  onActivation?: (event: TNativeActivationEvent) => void
  onPressIn?: (event: TNativeInteractionEvent) => void
  onPressOut?: (event: TNativeInteractionEvent) => void
}
export type TNativePressableProps = Omit<
  PressableProps,
  keyof TCallbacks | "children" | "style" | "onFocus" | "onBlur"
> &
  TCallbacks &
  Pick<TNativeFocusViewProps, "onFocus" | "onBlur" | "onKeyDown" | "onKeyUp"> & {
    children?: PressableProps["children"]
    style?: PressableProps["style"]
    activationBlocked?: boolean
    blockNativeResponder?: boolean
    onPressCancel?: (event: TNativePressEvent) => void
    onHoverCancel?: (event: MouseEvent) => void
    onFocusVisibilityChange?: (visible: boolean) => void
  }
type TCycle<E> = { event: E; cancelled: boolean; ended: boolean; upDelivered?: boolean }
const activationKeys = [...nativeKeyTokens("Enter"), ...nativeKeyTokens(" ")]
const subscribeNothing = () => () => {}

export const NativePressable = forwardRef<View, TNativePressableProps>((props, forwardedRef) => {
  const {
    activationBlocked = false,
    disabled,
    children,
    style,
    testOnly_pressed,
    onPress,
    onPressUp,
    onActivation,
    onPressIn,
    onPressOut,
    onLongPress,
    onPressMove,
    onHoverIn,
    onHoverOut,
    onFocus,
    onBlur,
    onKeyDown,
    onKeyUp,
    delayHoverIn,
    delayHoverOut,
    delayLongPress,
    unstable_pressDelay,
    pressRetentionOffset,
    cancelable,
    blockNativeResponder,
    android_disableSound,
    android_ripple,
    hitSlop,
    focusable,
    onPointerEnter,
    onPointerLeave,
    onPressCancel,
    onHoverCancel,
    onFocusVisibilityChange,
    accessibilityState,
    accessibilityLabel,
    "aria-busy": ariaBusy,
    "aria-checked": ariaChecked,
    "aria-disabled": ariaDisabled,
    "aria-expanded": ariaExpanded,
    "aria-label": ariaLabel,
    "aria-selected": ariaSelected,
    "aria-live": ariaLive,
    ...rest
  } = props
  const keyboardEnabled = !disabled && focusable !== false && rest.tabIndex !== -1
  const scope = useContext(NativeFloatingScopeContext)
  const window = useContext(NativeFloatingWindowContext)
  const input = useNativeKeyScope()
  const canAct = useCallback(
    () => scope?.canAct() !== false && window?.() !== false && input?.isWindowActive() !== false,
    [scope, window, input],
  )
  const eligible = useSyncExternalStore(input?.subscribe ?? subscribeNothing, canAct, canAct)
  const inputOrigin = useSyncExternalStore(
    input?.subscribe ?? subscribeNothing,
    () => input?.lastInput()?.origin ?? null,
    () => null,
  )
  const focused = useRef(false)
  const observedOrigin = useRef(inputOrigin)
  const attached = useRef(false)
  const view = useRef<View>(null)
  const releaseRef = useRef<(() => void) | undefined>(undefined)
  const keyboard = useRef<(TCycle<TNativeKeyboardEvent> & { code: number }) | null>(null)
  const pointer = useRef<TCycle<GestureResponderEvent> | null>(null)
  const hover = useRef<MouseEvent | null>(null)
  const hoverIntent = useRef(false)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hoverGeneration = useRef(0)
  const releasingPointer = useRef<GestureResponderEvent | null>(null)
  const [pressed, setPressed] = useState(false)
  const ripple = useNativeAndroidRipple(android_ripple, view)
  const current = useRef({
    onPress,
    onPressUp,
    onActivation,
    onPressIn,
    onPressOut,
    onKeyDown,
    onKeyUp,
    onFocus,
    onBlur,
    disabled,
    activationBlocked,
    canAct,
    onPressCancel,
    onHoverCancel,
    onHoverIn,
    onHoverOut,
    onLongPress,
    onPressMove,
    ripple,
    keyboardEnabled,
    onFocusVisibilityChange,
  })
  useInsertionEffect(() => {
    current.current = {
      onPress,
      onPressUp,
      onActivation,
      onPressIn,
      onPressOut,
      onKeyDown,
      onKeyUp,
      onFocus,
      onBlur,
      disabled,
      activationBlocked,
      canAct,
      onPressCancel,
      onHoverCancel,
      onHoverIn,
      onHoverOut,
      onLongPress,
      onPressMove,
      ripple,
      keyboardEnabled,
      onFocusVisibilityChange,
    }
  })
  const admitted = () =>
    attached.current && !current.current.disabled && !current.current.activationBlocked && current.current.canAct()
  const clearHoverTimer = useCallback(() => {
    hoverGeneration.current += 1
    if (hoverTimer.current !== null) clearTimeout(hoverTimer.current)
    hoverTimer.current = null
  }, [])
  const cancel = useCallback(
    (keyboardOnly = false) => {
      if (!keyboardOnly && pointer.current && !pointer.current.ended)
        current.current.ripple?.onPressOut(pointer.current.event)
      for (const cycle of keyboardOnly ? [keyboard.current] : [keyboard.current, pointer.current]) {
        if (!cycle || cycle.ended) continue
        cycle.cancelled = true
        cycle.ended = true
        setPressed(false)
        current.current.onPressCancel?.(cycle.event)
      }
      if (!keyboardOnly) {
        clearHoverTimer()
        hoverIntent.current = false
        if (hover.current) {
          const event = hover.current
          hover.current = null
          current.current.onHoverCancel?.(event)
        }
      }
    },
    [clearHoverTimer],
  )
  useLayoutEffect(() => {
    if (focused.current && inputOrigin !== observedOrigin.current)
      current.current.onFocusVisibilityChange?.(inputOrigin === "keyboard")
    observedOrigin.current = inputOrigin
  }, [inputOrigin])
  useLayoutEffect(() => {
    if (!eligible || !keyboardEnabled) current.current.onFocusVisibilityChange?.(false)
    if (!eligible || disabled || activationBlocked) cancel()
    else if (!keyboardEnabled) cancel(true)
  })
  useLayoutEffect(
    () =>
      input?.subscribe(() => {
        if (!canAct()) cancel()
      }),
    [input, canAct, cancel],
  )
  useInsertionEffect(
    () => () => {
      attached.current = false
      keyboard.current = null
      pointer.current = null
      hover.current = null
      clearHoverTimer()
    },
    [clearHoverTimer],
  )
  const setRef = useCallback(
    (target: View | null) => {
      attached.current = target !== null
      view.current = target
      releaseRef.current?.()
      releaseRef.current = undefined
      if (typeof forwardedRef === "function") {
        if (target) {
          const cleanup = forwardedRef(target)
          releaseRef.current = typeof cleanup === "function" ? cleanup : () => forwardedRef(null)
        }
      } else if (forwardedRef) forwardedRef.current = target
    },
    [forwardedRef],
  )
  const deliverPointerUp = (event: GestureResponderEvent) => {
    const cycle = pointer.current
    if (!cycle || cycle.cancelled || cycle.ended || cycle.upDelivered || !admitted()) return
    cycle.upDelivered = true
    current.current.onPressUp?.(event)
  }
  const handlers = useNativePressability({
    cancelable,
    disabled: !!disabled,
    hitSlop,
    pressRectOffset: pressRetentionOffset,
    android_disableSound,
    delayHoverIn,
    delayHoverOut,
    delayLongPress,
    delayPressIn: unstable_pressDelay,
    blockNativeResponder,
    onPress: (event) => {
      if (admitted() && !pointer.current?.cancelled) current.current.onPress?.(event)
    },
    onPressIn: (event) => {
      if (!admitted() || pointer.current?.cancelled) return
      event.persist?.()
      pointer.current = { event, cancelled: false, ended: false }
      setPressed(true)
      ripple?.onPressIn(event)
      current.current.onPressIn?.(event)
      if (releasingPointer.current) deliverPointerUp(releasingPointer.current)
    },
    onPressOut: (event) => {
      ripple?.onPressOut(event)
      const cycle = pointer.current
      if (cycle) cycle.ended = true
      setPressed(false)
      if (attached.current) current.current.onPressOut?.(event)
    },
    onPressMove: (event) => {
      ripple?.onPressMove(event)
      if (admitted()) current.current.onPressMove?.(event)
    },
    onLongPress: onLongPress
      ? (event) => {
          if (admitted() && !pointer.current?.cancelled) current.current.onLongPress?.(event)
        }
      : undefined,
  })
  return (
    <NativeFocusHost
      {...rest}
      {...ripple?.viewProps}
      {...handlers}
      ref={setRef}
      accessible={rest.accessible !== false}
      accessibilityLabel={ariaLabel ?? accessibilityLabel}
      accessibilityLiveRegion={ariaLive === "off" ? "none" : (ariaLive ?? rest.accessibilityLiveRegion)}
      accessibilityState={{
        busy: ariaBusy ?? accessibilityState?.busy,
        checked: ariaChecked ?? accessibilityState?.checked,
        disabled: disabled ?? ariaDisabled ?? accessibilityState?.disabled,
        expanded: ariaExpanded ?? accessibilityState?.expanded,
        selected: ariaSelected ?? accessibilityState?.selected,
      }}
      collapsable={false}
      nativePressable
      focusable={keyboardEnabled}
      hitSlop={hitSlop}
      capturedKeys={activationKeys}
      style={typeof style === "function" ? style({ pressed: pressed || testOnly_pressed === true }) : style}
      onClick={undefined}
      onNativeActivation={(event) => {
        const data = event.nativeEvent
        if (!admitted() || keyboard.current || !data.windowId) return
        if (input) {
          const session = input.acknowledgedSession()
          if (data.scopeOwnerId !== input.ownerId || data.windowId !== session.windowId || data.epoch !== session.epoch)
            return
        } else if (data.scopeOwnerId) return
        const cycle = pointer.current
        if (cycle && !cycle.cancelled) {
          cycle.cancelled = true
          if (!cycle.ended) {
            cycle.ended = true
            setPressed(false)
            current.current.ripple?.onPressOut(cycle.event)
          }
        }
        current.current.onActivation?.(event)
        if (admitted()) current.current.onPress?.(event)
      }}
      onResponderGrant={(event) => {
        observedOrigin.current = "pointer"
        current.current.onFocusVisibilityChange?.(false)
        handlers.onResponderGrant?.(event)
      }}
      onResponderRelease={(event) => {
        releasingPointer.current = event
        try {
          deliverPointerUp(event)
          handlers.onResponderRelease?.(event)
        } finally {
          releasingPointer.current = null
          pointer.current = null
        }
      }}
      onResponderTerminate={(event) => {
        try {
          handlers.onResponderTerminate?.(event)
        } finally {
          pointer.current = null
        }
      }}
      onPointerEnter={(event) => {
        onPointerEnter?.(event)
        if (event.nativeEvent.pointerType === "touch" || !admitted() || hoverIntent.current) return
        hoverIntent.current = true
        clearHoverTimer()
        if (hover.current) return
        event.persist?.()
        const generation = hoverGeneration.current
        const open = () => {
          if (generation !== hoverGeneration.current || !hoverIntent.current || !admitted()) return
          hoverTimer.current = null
          hover.current = event
          current.current.onHoverIn?.(event)
        }
        if ((delayHoverIn ?? 0) > 0) hoverTimer.current = setTimeout(open, delayHoverIn ?? 0)
        else open()
      }}
      onPointerLeave={(event) => {
        onPointerLeave?.(event)
        if (event.nativeEvent.pointerType === "touch" || !hoverIntent.current) return
        hoverIntent.current = false
        clearHoverTimer()
        if (!hover.current) return
        event.persist?.()
        const generation = hoverGeneration.current
        const close = () => {
          if (generation !== hoverGeneration.current || hoverIntent.current || !attached.current) return
          hoverTimer.current = null
          hover.current = null
          current.current.onHoverOut?.(event)
        }
        if ((delayHoverOut ?? 0) > 0) hoverTimer.current = setTimeout(close, delayHoverOut ?? 0)
        else close()
      }}
      onFocus={(event) => {
        if (attached.current && current.current.keyboardEnabled && current.current.canAct()) {
          focused.current = true
          observedOrigin.current = input?.lastInput()?.origin ?? null
          current.current.onFocusVisibilityChange?.(event?.nativeEvent?.isFocusVisible === true)
          current.current.onFocus?.(event)
        }
      }}
      onBlur={(event) => {
        focused.current = false
        current.current.onFocusVisibilityChange?.(false)
        cancel(true)
        if (attached.current) current.current.onBlur?.(event)
      }}
      onKeyDown={(event) => {
        if (!attached.current || !current.current.keyboardEnabled || !current.current.canAct()) return
        observedOrigin.current = "keyboard"
        current.current.onFocusVisibilityChange?.(true)
        current.current.onKeyDown?.(event)
        const data = event.nativeEvent
        if (
          !admitted() ||
          !data.nativeDefaultHandled ||
          data.cancelled ||
          data.repeat ||
          keyboard.current ||
          (data.key !== "Enter" && data.key !== " ") ||
          event.isDefaultPrevented?.()
        )
          return
        event.persist?.()
        keyboard.current = { event, code: data.nativeCode, cancelled: false, ended: false }
        setPressed(true)
        current.current.onPressIn?.(event)
      }}
      onKeyUp={(event) => {
        if (!attached.current) return
        current.current.onKeyUp?.(event)
        const cycle = keyboard.current
        if (!cycle || cycle.code !== event.nativeEvent.nativeCode) return
        keyboard.current = null
        setPressed(false)
        cycle.ended = true
        const canRelease =
          admitted() && current.current.keyboardEnabled && !cycle.cancelled && !event.nativeEvent.cancelled
        if (canRelease) current.current.onPressUp?.(event)
        current.current.onPressOut?.(event)
        if (
          admitted() &&
          current.current.keyboardEnabled &&
          !cycle.cancelled &&
          !event.nativeEvent.cancelled &&
          !event.isDefaultPrevented?.()
        )
          current.current.onPress?.(event)
      }}
    >
      {typeof children === "function" ? children({ pressed: pressed || testOnly_pressed === true }) : children}
    </NativeFocusHost>
  )
})
NativePressable.displayName = "NativePressable"
