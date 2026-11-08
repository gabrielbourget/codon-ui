import {
  forwardRef,
  useCallback,
  useContext,
  useInsertionEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentPropsWithoutRef,
  type ReactElement,
  type RefAttributes,
} from "react"
import { Platform, type GestureResponderEvent, type MouseEvent, type PressableProps, type View } from "react-native"

import { NativeFloatingScopeContext, NativeFloatingWindowContext } from "../overlays/floating/scope"

import { captureNativeFocusTarget, focusNativeTarget } from "./focus"
import { nativeKeyTokens } from "./keyScope"
import { NativeFocusView, type NativeFocusHost } from "./NativeFocusView"
import { useNativeKeyScope } from "./NativeKeyboardScope"
import { useNativeAndroidRipple, useNativePressability } from "./nativePressability"
import { createNativeResponderCohorts, type TNativeAdmittedPress } from "./nativePressCycle"
import { captureNativeOrdinaryEditorFocus, NativeOrdinaryEditorKeysContext } from "./ordinaryEditorKeys"
import type {
  TNativeActivationEvent,
  TNativeFocusViewProps,
  TNativeFocusEvent,
  TNativeInteractionEvent,
  TNativeKeyboardEvent,
  TNativePressEvent,
} from "./types"

type TCallbacks = {
  onPress?: (event: TNativePressEvent) => void
  onPressUp?: (event: TNativePressEvent) => void
  onActivation?: (event: TNativeActivationEvent) => void
  onPressIn?: (event: TNativeInteractionEvent, admission?: TNativeAdmittedPress) => void
  onPressOut?: (event: TNativeInteractionEvent) => void
}
export type TNativePressableRender = (props: TNativeFocusViewProps & RefAttributes<View>) => ReactElement
const PressableHost = forwardRef<
  View,
  ComponentPropsWithoutRef<typeof NativeFocusHost> & { nativeRender?: TNativePressableRender }
>(({ nativeRender, ...props }, ref) =>
  nativeRender ? nativeRender({ ...props, ref }) : <NativeFocusView {...props} ref={ref} />,
)
export type TNativePressableProps = Omit<
  PressableProps,
  keyof TCallbacks | "children" | "style" | "onFocus" | "onBlur"
> &
  TCallbacks &
  Pick<
    TNativeFocusViewProps,
    "onFocus" | "onBlur" | "onKeyDown" | "onKeyUp" | "nativeFormActionBinding" | "onNativeFormActionStatus"
  > & {
    children?: PressableProps["children"]
    style?: PressableProps["style"]
    nativeLabelledBy?: readonly string[]
    nativeDescribedBy?: readonly string[]
    nativeDetailsBy?: readonly string[]
    nativeDescriptionLabel?: string
    nativeDetailsLabel?: string
    activationBlocked?: boolean
    nativeInteraction?: boolean
    nativeMinPressDuration?: number
    blockNativeResponder?: boolean
    onPressCancel?: (event: TNativePressEvent) => void
    onHoverCancel?: (event: MouseEvent) => void
    onFocusVisibilityChange?: (visible: boolean) => void
    nativeRender?: TNativePressableRender
    nativeFocusOnPress?: boolean
    nativeObservePressCohort?: boolean
    nativeProgrammaticFocusable?: boolean
    nativeTabStop?: boolean
    onNativeFocusObserved?: (focused: boolean, event: TNativeFocusEvent) => void
  }
type TCycle<E> = { event: E; cancelled: boolean; ended: boolean; upDelivered?: boolean }
let responderBindings = 0
const nextResponderBinding = () => `press-cohort:${++responderBindings}`
const activationKeys = [...nativeKeyTokens("Enter"), ...nativeKeyTokens(" ")]
const subscribeNothing = () => () => {}

export const NativePressable = forwardRef<View, TNativePressableProps>((props, forwardedRef) => {
  const {
    nativeRender,
    nativeProgrammaticFocusable = false,
    nativeFocusOnPress,
    nativeObservePressCohort = false,
    onNativeFocusObserved,
    activationBlocked: authoredActivationBlocked = false,
    nativeInteraction = true,
    nativeMinPressDuration,
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
  const activationBlocked = authoredActivationBlocked || !nativeInteraction
  const keyboardEnabled = !disabled && focusable !== false && rest.tabIndex !== -1
  const scope = useContext(NativeFloatingScopeContext)
  const window = useContext(NativeFloatingWindowContext)
  const input = useNativeKeyScope()
  const ordinaryEditors = useContext(NativeOrdinaryEditorKeysContext)
  const cohorts = useRef(createNativeResponderCohorts())
  const [responderBinding, setResponderBinding] = useState(nextResponderBinding)
  const currentResponderBinding = useRef(responderBinding)
  const grantedCohort = useRef<ReturnType<ReturnType<typeof createNativeResponderCohorts>["grant"]>>(null)
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
  const lastView = useRef<View | null>(null)
  const releaseRef = useRef<(() => void) | undefined>(undefined)
  const keyboard = useRef<(TCycle<TNativeKeyboardEvent> & { code: number }) | null>(null)
  const pointer = useRef<TCycle<GestureResponderEvent> | null>(null)
  const pointerFocusConsidered = useRef(false)
  const retiredPressEvents = useRef<TNativePressEvent[]>([])
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
    onNativeFocusObserved,
    nativeFocusOnPress,
    nativeObservePressCohort,
    input,
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
      onNativeFocusObserved,
      nativeFocusOnPress,
      nativeObservePressCohort,
      input,
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
    (keyboardOnly: boolean | "pointer" = false) => {
      const pointerOnly = keyboardOnly === "pointer"
      const onlyKeyboard = keyboardOnly === true
      if (!onlyKeyboard && pointer.current && !pointer.current.ended)
        current.current.ripple?.onPressOut(pointer.current.event)
      for (const cycle of pointerOnly
        ? [pointer.current]
        : onlyKeyboard
          ? [keyboard.current]
          : [keyboard.current, pointer.current]) {
        if (!cycle || cycle.ended) continue
        cycle.cancelled = true
        cycle.ended = true
        setPressed(false)
        current.current.onPressCancel?.(cycle.event)
      }
      if (!onlyKeyboard && !pointerOnly) {
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
    if (!nativeObservePressCohort && Platform.OS === "android") {
      cohorts.current.retire()
      grantedCohort.current = null
    }
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
      for (const cycle of [keyboard.current, pointer.current]) {
        if (cycle && !cycle.cancelled && !cycle.ended) {
          cycle.cancelled = true
          cycle.ended = true
          retiredPressEvents.current.push(cycle.event)
        }
      }
      attached.current = false
      cohorts.current.retire()
      grantedCohort.current = null
      keyboard.current = null
      pointer.current = null
      pointerFocusConsidered.current = false
      hover.current = null
      clearHoverTimer()
    },
    [clearHoverTimer],
  )
  useLayoutEffect(
    () => () => {
      const events = retiredPressEvents.current
      retiredPressEvents.current = []
      for (const event of events) current.current.onPressCancel?.(event)
    },
    [],
  )
  useLayoutEffect(
    () => () => {
      if (current.current.nativeObservePressCohort) {
        cohorts.current.retire()
        grantedCohort.current = null
        cancel("pointer")
      }
    },
    [cancel],
  )
  const setRef = useCallback(
    (target: View | null) => {
      if (target && lastView.current && lastView.current !== target) {
        cohorts.current.reset()
        grantedCohort.current = null
        currentResponderBinding.current = nextResponderBinding()
        setResponderBinding(currentResponderBinding.current)
        cancel()
        focused.current = false
        observedOrigin.current = null
      }
      if (target) lastView.current = target
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
    [forwardedRef, cancel],
  )
  useLayoutEffect(() => {
    if (__DEV__ && nativeRender && !view.current)
      console.warn("Native custom render must forward its ref and props to the actual native focus host.")
  }, [nativeRender])
  const deliverPointerUp = (event: GestureResponderEvent) => {
    const cycle = pointer.current
    if (!cycle || cycle.cancelled || cycle.ended || cycle.upDelivered || !admitted()) return
    cycle.upDelivered = true
    current.current.onPressUp?.(event)
  }
  const handlers = useNativePressability({
    cancelable,
    disabled: !!disabled || !nativeInteraction,
    hitSlop,
    pressRectOffset: pressRetentionOffset,
    android_disableSound,
    delayHoverIn,
    delayHoverOut,
    delayLongPress,
    delayPressIn: unstable_pressDelay,
    minPressDuration: nativeMinPressDuration,
    blockNativeResponder,
    onPress: (event) => {
      if (admitted() && !pointer.current?.cancelled) current.current.onPress?.(event)
    },
    onPressIn: (event) => {
      if (!admitted() || pointer.current?.cancelled) return
      const requestFocus = !pointerFocusConsidered.current && current.current.nativeFocusOnPress === true
      pointerFocusConsidered.current = true
      const original = view.current
      const retainedFocus = requestFocus && original ? captureNativeFocusTarget(original) : null
      event.persist?.()
      const cycle = { event, cancelled: false, ended: false }
      pointer.current = cycle
      const originalInput = current.current.input
      const session = originalInput?.acknowledgedSession()
      const cohort = grantedCohort.current
      const admission: TNativeAdmittedPress | undefined =
        current.current.nativeObservePressCohort &&
        (Platform.OS === "ios" || (Platform.OS === "android" && cohort && cohorts.current.current(cohort))) &&
        original
          ? {
              cohort: Platform.OS === "ios" ? "responder" : cohort!.semanticCohort,
              ...(Platform.OS === "android" ? { nativeCohort: cohort!.cohort } : {}),
              originalReceiver: original,
              captureEditorFocus: (editor) =>
                cohort && originalInput
                  ? captureNativeOrdinaryEditorFocus(ordinaryEditors, editor, { windowId: cohort.windowId })
                  : null,
              isCurrent: () => {
                const currentSession = current.current.input?.acknowledgedSession()
                return (
                  pointer.current === cycle &&
                  (Platform.OS !== "android" || (cohort !== null && cohorts.current.current(cohort))) &&
                  !cycle.cancelled &&
                  !cycle.ended &&
                  view.current === original &&
                  current.current.input === originalInput &&
                  currentSession?.windowId === session?.windowId &&
                  currentSession?.epoch === session?.epoch &&
                  admitted()
                )
              },
            }
          : undefined
      setPressed(true)
      ripple?.onPressIn(event)
      if (admission) current.current.onPressIn?.(event, admission)
      else current.current.onPressIn?.(event)
      if (
        requestFocus &&
        original &&
        retainedFocus?.() &&
        view.current === original &&
        admitted() &&
        current.current.nativeFocusOnPress === true
      )
        focusNativeTarget(original)
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
    <PressableHost
      nativeRender={nativeRender}
      {...rest}
      {...ripple?.viewProps}
      {...(nativeInteraction ? handlers : {})}
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
      nativePressable={nativeInteraction ? true : undefined}
      nativeResponderCohortBinding={Platform.OS === "android" && nativeObservePressCohort ? responderBinding : ""}
      onNativeResponderCohort={(event) => {
        const data = event.nativeEvent
        if (
          data.bindingId !== currentResponderBinding.current ||
          !current.current.nativeObservePressCohort ||
          !attached.current
        )
          return
        const session = input?.acknowledgedSession()
        if (
          data.phase !== "retire" &&
          (!input ||
            data.scopeOwnerId !== input.ownerId ||
            data.windowId !== session?.windowId ||
            data.epoch !== session.epoch ||
            !input.isWindowActive())
        )
          return
        cohorts.current.receive(data)
        if (data.phase === "retire") {
          grantedCohort.current = null
          cancel("pointer")
        }
      }}
      focusable={keyboardEnabled || nativeProgrammaticFocusable}
      hitSlop={hitSlop}
      capturedKeys={nativeInteraction && keyboardEnabled ? activationKeys : []}
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
      onResponderGrant={
        nativeInteraction
          ? (event) => {
              if (pointer.current?.ended) pointer.current = null
              pointerFocusConsidered.current = false
              grantedCohort.current = cohorts.current.grant(event.nativeEvent)
              observedOrigin.current = "pointer"
              current.current.onFocusVisibilityChange?.(false)
              handlers.onResponderGrant?.(event)
            }
          : undefined
      }
      onResponderRelease={
        nativeInteraction
          ? (event) => {
              releasingPointer.current = event
              try {
                deliverPointerUp(event)
                handlers.onResponderRelease?.(event)
              } finally {
                releasingPointer.current = null
                cohorts.current.release()
                grantedCohort.current = null
                pointer.current = null
                pointerFocusConsidered.current = false
              }
            }
          : undefined
      }
      onResponderTerminate={
        nativeInteraction
          ? (event) => {
              try {
                handlers.onResponderTerminate?.(event)
              } finally {
                cohorts.current.release()
                grantedCohort.current = null
                pointer.current = null
                pointerFocusConsidered.current = false
              }
            }
          : undefined
      }
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
        if (attached.current && current.current.canAct()) current.current.onNativeFocusObserved?.(true, event)
        if (attached.current && current.current.keyboardEnabled && current.current.canAct()) {
          focused.current = true
          observedOrigin.current = input?.lastInput()?.origin ?? null
          current.current.onFocusVisibilityChange?.(event?.nativeEvent?.isFocusVisible === true)
          current.current.onFocus?.(event)
        }
      }}
      onBlur={(event) => {
        if (attached.current) current.current.onNativeFocusObserved?.(false, event)
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
    </PressableHost>
  )
})
NativePressable.displayName = "NativePressable"
