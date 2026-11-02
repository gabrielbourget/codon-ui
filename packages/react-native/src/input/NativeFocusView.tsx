import {
  forwardRef,
  useCallback,
  useContext,
  useId,
  useInsertionEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ElementRef,
} from "react"
import {
  findNodeHandle,
  type GestureResponderEvent,
  type NativeSyntheticEvent,
  type PointerEvent,
  type ViewProps,
} from "react-native"

import { NativeCollectionItemBindingContext } from "../collection/binding"
import { NativeCollectionSemanticsContext } from "../collection/semantics"
import { NativeFloatingScopeContext, NativeFloatingWindowContext } from "../overlays/floating/scope"

import { receiveNativeAccessibilityInspection, registerNativeAccessibilityInspector } from "./accessibilityInspection"
import { dispatchNativeActivationPolicy } from "./activation"
import { observeNativeFocus, registerNativeFocusTarget, retireNativeFocusObservation } from "./focus"
import { NativeFocusWithinSession, type TNativeFocusWithinEvent } from "./focusWithin"
import { NativeMotionColorSampler, registerNativeMotionColorSampler } from "./motionColors"
import {
  NativeMotionGeometryObserver,
  nativeMotionGeometryHistory,
  registerNativeMotionGeometryObserver,
} from "./motionGeometry"
import { registerNativeDescriptionSource, type TNativeDescriptionBinding } from "./nativeDescription"
import { useNativeKeyScope } from "./NativeKeyboardScope"
import { deliverNativeToolbarTargetKey, type TNativeToolbarListenerProps } from "./nativeToolbarKeyboard"
import { nativeViewProps, NativeViewContextBoundary } from "./nativeViewProps"
import {
  NativeOrdinaryFieldGroupKeysContext,
  NativeOrdinaryFocusParticipantsContext,
  useNativeOrdinaryEditorKeys,
} from "./ordinaryEditorKeys"
import FocusHost, {
  Commands,
  type NativeAccessibilityData,
  type NativeActivationData,
  type NativeKeyData,
} from "./specs/CUIFocusViewNativeComponent"
import type { TNativeKeyboardEvent, TNativeFocusViewProps, TNativeFocusViewRef } from "./types"

export type TNativeActivationPacket = NativeSyntheticEvent<Omit<NativeActivationData, "kind"> & { kind: "activation" }>
let motionGeometryBindings = 0
const isActivationEvent = (event: NativeSyntheticEvent<NativeActivationData>): event is TNativeActivationPacket =>
  event.nativeEvent.kind === "activation" &&
  (event.nativeEvent.source === "android-click" || event.nativeEvent.source === "ios-accessibility-activate")

const isKeyboardEvent = (event: NativeSyntheticEvent<NativeKeyData>): event is TNativeKeyboardEvent =>
  event.nativeEvent.kind === "keyboard"

export const NativeFocusHost = forwardRef<
  TNativeFocusViewRef,
  TNativeFocusViewProps &
    Partial<Pick<TNativeToolbarListenerProps, "onNativeOrdinaryEditorKeyCapture" | "onNativeDateKeyCapture">> & {
      nativePressable?: boolean
      onNativeDateKey?: TNativeToolbarListenerProps["onNativeDateKey"]
      nativeOrdinaryGroupKeyHandler?: (event: TNativeKeyboardEvent) => void
      onNativeOrdinaryEditorKey?: (
        event: NativeSyntheticEvent<import("./specs/CUIFocusViewNativeComponent").NativeOrdinaryEditorKeyData>,
      ) => void
      nativeTabStop?: boolean
      nativeMotionColorObservation?: boolean
      nativeMotionGeometryObservation?: boolean
      nativeMotionGeometryObserveFrames?: boolean
      nativeMotionGeometryRevision?: string
      nativeMotionVisible?: boolean
      nativeMotionProjectionRevision?: string
      nativeForegroundComposition?: boolean
      nativeMotionDrawingOwner?: boolean
      nativeMotionProjectionRadii?: string
      nativeFocusWithinObservation?: boolean
      nativeOnFocusWithin?: (event: TNativeFocusWithinEvent) => void
      nativeOnFocusWithinRetired?: () => void
      nativeNavigation?: boolean
      nativeNavigationLabel?: string
      nativeLabelledBy?: readonly string[]
      nativeDescribedBy?: readonly string[]
      nativeDetailsBy?: readonly string[]
      nativeDescriptionTag?: number
      nativeDescriptionLabel?: string
      nativeDetailsLabel?: string
      nativeScrollAnchorTag?: number
      nativeScrollAnchorKey?: string
      nativeScrollAnchorRevision?: string
      onBubbledFocus?: ViewProps["onFocus"]
      onBubbledBlur?: ViewProps["onBlur"]
      onNativeAccessibilitySnapshot?: (event: NativeSyntheticEvent<NativeAccessibilityData>) => void
      onNativeActivation?: (event: TNativeActivationPacket) => void
      capturedKeys?: readonly string[]
      onClick?: { handle(event: PointerEvent | GestureResponderEvent): void }["handle"]
    }
>((props, forwardedRef) => {
  const {
    onKeyDown,
    onKeyUp,
    nativeOrdinaryGroupKeyHandler,
    onNativeOrdinaryEditorKey,
    onNativeDateKey,
    onFocus,
    onBlur,
    focusable,
    tabIndex,
    capturedKeys,
    onNativeActivation,
    onNativeAccessibilitySnapshot,
    nativeMotionColorObservation = false,
    nativeMotionGeometryObservation = false,
    nativeMotionGeometryObserveFrames = true,
    nativeMotionGeometryRevision = "",
    nativeMotionVisible = true,
    nativeMotionProjectionRevision = "",
    nativeFocusWithinObservation = false,
    nativeOnFocusWithin,
    nativeOnFocusWithinRetired,
    onBubbledFocus,
    onBubbledBlur,
    ...rest
  } = props
  const ownerId = useId()
  const participants = useContext(NativeOrdinaryFocusParticipantsContext)
  const bubbleFieldKeys = useContext(NativeOrdinaryFieldGroupKeysContext)
  const [ordinaryOriginal, setOrdinaryOriginal] = useState<ElementRef<typeof FocusHost> | null>(null)
  const collectionBinding = useContext(NativeCollectionItemBindingContext)
  const collectionSemantics = useContext(NativeCollectionSemanticsContext)
  const [geometryBinding] = useState(() => `motion-geometry:${++motionGeometryBindings}`)
  const attached = useRef(false)
  const nativeTarget = useRef<ElementRef<typeof FocusHost> | null>(null)
  const observedFocusedTarget = useRef<{ target: ElementRef<typeof FocusHost>; window: string } | null>(null)
  const activationId = useRef(0)
  const release = useRef<(() => void) | undefined>(undefined)
  const releaseInspector = useRef<(() => void) | undefined>(undefined)
  const motionOptions = useRef({ colors: nativeMotionColorObservation, geometry: nativeMotionGeometryObservation })
  useInsertionEffect(() => {
    motionOptions.current = { colors: nativeMotionColorObservation, geometry: nativeMotionGeometryObservation }
  })
  const motionColors = useRef<NativeMotionColorSampler | undefined>(undefined)
  const releaseMotionColors = useRef<(() => void) | undefined>(undefined)
  const motionGeometry = useRef<NativeMotionGeometryObserver | undefined>(undefined)
  const releaseMotionGeometry = useRef<(() => void) | undefined>(undefined)
  const releaseDescription = useRef<(() => void) | undefined>(undefined)
  const [withinBinding, setWithinBinding] = useState("")
  const within = useRef<NativeFocusWithinSession | null>(null)
  const withinOptions = useRef({
    enabled: nativeFocusWithinObservation,
    receive: nativeOnFocusWithin,
    retire: nativeOnFocusWithinRetired,
  })
  useInsertionEffect(() => {
    withinOptions.current = {
      enabled: nativeFocusWithinObservation,
      receive: nativeOnFocusWithin,
      retire: nativeOnFocusWithinRetired,
    }
  })
  const [description, setDescription] = useState<TNativeDescriptionBinding | null>(null)
  const releaseForwardedRef = useRef<(() => void) | undefined>(undefined)
  const keyboardFocusable = tabIndex === -1 && !bubbleFieldKeys ? false : (focusable ?? true)
  const inputScope = useNativeKeyScope()
  const floatingScope = useContext(NativeFloatingScopeContext)
  const windowActive = useContext(NativeFloatingWindowContext)
  const focusEligibility = useRef({ keyboardFocusable, inputScope, floatingScope, windowActive })
  useInsertionEffect(() => {
    focusEligibility.current = { keyboardFocusable, inputScope, floatingScope, windowActive }
  })
  const focusWindow = useCallback(() => {
    const scope = focusEligibility.current.inputScope
    const session = scope?.acknowledgedSession()
    return `${scope?.ownerId ?? ""}:${session?.windowId ?? ""}:${session?.epoch ?? 0}`
  }, [])
  const refreshWithin = useCallback(() => {
    if (!withinOptions.current.enabled || !attached.current) {
      within.current?.detach()
      within.current = null
      return
    }
    if (!within.current) {
      const session = new NativeFocusWithinSession({
        ownerId,
        target: () => (nativeTarget.current ? findNodeHandle(nativeTarget.current) : null),
        scope: () => {
          const scope = focusEligibility.current.inputScope
          const native = scope?.acknowledgedSession()
          return {
            ownerId: scope?.ownerId ?? "",
            windowId: native?.windowId,
            epoch: native?.epoch,
            active: scope?.isWindowActive() !== false,
          }
        },
        changed: setWithinBinding,
        receive: (event) => withinOptions.current.receive?.(event),
        retire: () => withinOptions.current.retire?.(),
      })
      within.current = session
      session.attach()
    } else within.current.refreshScope()
  }, [ownerId])
  useLayoutEffect(() => {
    refreshWithin()
    return nativeFocusWithinObservation ? inputScope?.subscribe(refreshWithin) : undefined
  }, [inputScope, nativeFocusWithinObservation, refreshWithin])
  const canFocus = useCallback(() => {
    const current = focusEligibility.current
    return (
      current.keyboardFocusable &&
      current.inputScope?.isWindowActive() !== false &&
      current.floatingScope?.canAct() !== false &&
      current.windowActive?.() !== false
    )
  }, [])
  const retireObservation = useCallback(() => {
    const observed = observedFocusedTarget.current
    if (observed && (!canFocus() || observed.window !== focusWindow())) {
      observedFocusedTarget.current = null
      retireNativeFocusObservation(observed.target)
    }
  }, [canFocus, focusWindow])
  useLayoutEffect(() => {
    motionColors.current?.refreshScope()
    motionGeometry.current?.refreshScope()
  })
  useLayoutEffect(
    () =>
      nativeMotionColorObservation || nativeMotionGeometryObservation
        ? inputScope?.subscribe(() => {
            motionColors.current?.refreshScope()
            motionGeometry.current?.refreshScope()
          })
        : undefined,
    [inputScope, nativeMotionColorObservation, nativeMotionGeometryObservation],
  )
  useLayoutEffect(retireObservation)
  useLayoutEffect(() => inputScope?.subscribe(retireObservation), [inputScope, retireObservation])
  // Feature changes retire only that observer, preserving unrelated leases and the caller ref.
  const refreshMotionObservers = useCallback(
    (target = nativeTarget.current) => {
      if (!target || !motionOptions.current.colors) {
        releaseMotionColors.current?.()
        releaseMotionColors.current = undefined
        motionColors.current = undefined
      }
      if (!target || !motionOptions.current.geometry) {
        releaseMotionGeometry.current?.()
        releaseMotionGeometry.current = undefined
        motionGeometry.current = undefined
      }
      if (target && motionOptions.current.colors && !motionColors.current) {
        const sampler = new NativeMotionColorSampler({
          ownerId,
          target: () => findNodeHandle(target),
          scope: () => {
            const scope = focusEligibility.current.inputScope
            const session = scope?.acknowledgedSession()
            return { ownerId: scope?.ownerId ?? "", windowId: session?.windowId, epoch: session?.epoch }
          },
          dispatch: (requestId, request) => Commands.sampleMotionColors(target, ownerId, requestId, request),
        })
        motionColors.current = sampler
        releaseMotionColors.current = registerNativeMotionColorSampler(target, sampler)
      }
      if (target && motionOptions.current.geometry && !motionGeometry.current) {
        const observer = new NativeMotionGeometryObserver({
          ownerId,
          bindingId: geometryBinding,
          target: () => findNodeHandle(target),
          scope: () => {
            const scope = focusEligibility.current.inputScope
            const session = scope?.acknowledgedSession()
            return { ownerId: scope?.ownerId ?? "", windowId: session?.windowId, epoch: session?.epoch }
          },
          dispatch: (requestId) => Commands.queryMotionGeometry(target, ownerId, geometryBinding, requestId),
          ...nativeMotionGeometryHistory(target),
        })
        motionGeometry.current = observer
        releaseMotionGeometry.current = registerNativeMotionGeometryObserver(target, observer)
      }
    },
    [ownerId, geometryBinding],
  )
  const setRef = useCallback(
    (target: ElementRef<typeof FocusHost> | null) => {
      attached.current = target !== null
      nativeTarget.current = target
      release.current?.()
      releaseInspector.current?.()
      releaseDescription.current?.()
      releaseMotionColors.current?.()
      releaseMotionColors.current = undefined
      motionColors.current = undefined
      releaseMotionGeometry.current?.()
      releaseMotionGeometry.current = undefined
      motionGeometry.current = undefined
      releaseForwardedRef.current?.()
      releaseForwardedRef.current = undefined
      release.current = target
        ? registerNativeFocusTarget(target, {
            canFocus,
            window: focusWindow,
            focus: () => Commands.requestKeyboardFocus(target, ownerId),
            focusContainer: () => Commands.requestContainerFocus(target, ownerId),
            blur: () => Commands.requestKeyboardBlur(target, ownerId),
          })
        : undefined
      if (target && observedFocusedTarget.current?.target === target) {
        if (observedFocusedTarget.current.window === focusWindow() && canFocus()) observeNativeFocus(target, true)
        else observedFocusedTarget.current = null
      }
      releaseInspector.current = target
        ? registerNativeAccessibilityInspector(target, () => Commands.inspectAccessibility(target, ownerId))
        : undefined
      releaseDescription.current = target ? registerNativeDescriptionSource(target, setDescription) : undefined
      refreshMotionObservers(target)
      if (typeof forwardedRef === "function") {
        if (target) {
          const cleanup = forwardedRef(target)
          releaseForwardedRef.current = typeof cleanup === "function" ? cleanup : () => forwardedRef(null)
        }
      } else if (forwardedRef) forwardedRef.current = target
      within.current?.detach()
      within.current = null
      refreshWithin()
    },
    [forwardedRef, ownerId, canFocus, focusWindow, refreshMotionObservers, refreshWithin],
  )
  useLayoutEffect(() => {
    refreshMotionObservers()
  }, [nativeMotionColorObservation, nativeMotionGeometryObservation, refreshMotionObservers])
  const ordinaryMember =
    (keyboardFocusable || (bubbleFieldKeys && !!(onKeyDown || onKeyUp))) &&
    !!ordinaryOriginal &&
    !!participants?.(ordinaryOriginal)
  const ordinaryOptions = useRef({ ordinaryMember, onKeyDown, onKeyUp })
  useInsertionEffect(() => {
    ordinaryOptions.current = { ordinaryMember, onKeyDown, onKeyUp }
  })
  const receiveOrdinaryKey = useNativeOrdinaryEditorKeys(ordinaryOriginal, ordinaryMember, ownerId, {
    current: () => nativeTarget.current,
    canAct: () => attached.current && ordinaryOptions.current.ordinaryMember,
    subtree: bubbleFieldKeys && !!(onKeyDown || onKeyUp),
    receive: (event) => {
      const options = ordinaryOptions.current
      if (event.nativeEvent.phase === "down") options.onKeyDown?.(event)
      else options.onKeyUp?.(event)
    },
  })
  useLayoutEffect(() => {
    if (participants) setOrdinaryOriginal(nativeTarget.current)
  }, [participants])
  const normalized = nativeViewProps(rest)
  const labelledBy = normalized.accessibilityLabelledBy
  return (
    <NativeViewContextBoundary>
      <FocusHost
        {...normalized}
        nativeLabelledBy={rest.nativeLabelledBy ?? (typeof labelledBy === "string" ? [labelledBy] : labelledBy)}
        nativeDescriptionTag={rest.nativeDescriptionTag ?? description?.tag ?? 0}
        nativeDescriptionLabel={rest.nativeDescriptionLabel ?? description?.label}
        ref={setRef}
        ownerId={ownerId}
        nativeCollectionBinding={collectionBinding}
        nativeCollectionSemantics={collectionSemantics}
        nativeFocusWithinBinding={nativeFocusWithinObservation ? withinBinding : ""}
        onNativeFocusWithin={
          nativeFocusWithinObservation
            ? (event) => {
                if (attached.current) within.current?.receive(event)
              }
            : undefined
        }
        nativeMotionColorObservation={nativeMotionColorObservation}
        nativeMotionGeometryBinding={nativeMotionGeometryObservation ? geometryBinding : ""}
        nativeMotionGeometryRevision={nativeMotionGeometryRevision}
        nativeMotionGeometryObserveFrames={nativeMotionGeometryObserveFrames}
        nativeMotionVisible={nativeMotionVisible}
        nativeMotionProjectionRevision={nativeMotionProjectionRevision}
        onNativeMotionGeometry={
          nativeMotionGeometryObservation
            ? (event) => {
                if (attached.current) motionGeometry.current?.receive(event.nativeEvent)
              }
            : undefined
        }
        onNativeMotionColors={
          nativeMotionColorObservation
            ? (event) => {
                if (attached.current) motionColors.current?.receive(event.nativeEvent)
              }
            : undefined
        }
        focusable={keyboardFocusable}
        keyboardFocusable={keyboardFocusable}
        nativeTabStop={bubbleFieldKeys ? (rest.nativeTabStop ?? tabIndex !== -1) : rest.nativeTabStop}
        capturedKeys={capturedKeys}
        onFocus={
          onBubbledFocus
            ? (event) => {
                if (attached.current) onBubbledFocus(event)
              }
            : undefined
        }
        onBlur={
          onBubbledBlur
            ? (event) => {
                if (attached.current) onBubbledBlur(event)
              }
            : undefined
        }
        onNativeAccessibilitySnapshot={(event) => {
          if (!attached.current || event.nativeEvent.ownerId !== ownerId) return
          const target = nativeTarget.current
          if (target && event.nativeEvent.target === findNodeHandle(target))
            receiveNativeAccessibilityInspection(target, event)
          onNativeAccessibilitySnapshot?.(event)
        }}
        onNativeActivation={(event) => {
          const data = event.nativeEvent
          if (!attached.current || data.ownerId !== ownerId || !isActivationEvent(event)) return
          if (!Number.isSafeInteger(data.activationId) || data.activationId <= activationId.current) return
          activationId.current = data.activationId
          const target = nativeTarget.current
          if (!target || !dispatchNativeActivationPolicy(target, event)) onNativeActivation?.(event)
        }}
        onNativeOrdinaryEditorKey={(event) => {
          if (!attached.current) return
          const delivered = ordinaryOptions.current.ordinaryMember && receiveOrdinaryKey(event)
          if (!delivered)
            deliverNativeToolbarTargetKey(
              nativeTarget.current,
              event as Parameters<typeof deliverNativeToolbarTargetKey>[1],
              ordinaryOptions.current,
            )
          if (!event.isPropagationStopped()) onNativeOrdinaryEditorKey?.(event)
        }}
        onNativeKey={(event) => {
          if (ordinaryOptions.current.ordinaryMember) return
          if (!attached.current || event.nativeEvent.ownerId !== ownerId || !isKeyboardEvent(event)) return
          if (event.nativeEvent.phase === "down") {
            if (keyboardFocusable) onKeyDown?.(event)
          } else onKeyUp?.(event)
        }}
        onNativeDateKey={(event) => {
          if (!attached.current || !isKeyboardEvent(event)) return
          nativeOrdinaryGroupKeyHandler?.(event)
          if (!event.isPropagationStopped?.())
            onNativeDateKey?.(event as Parameters<NonNullable<typeof onNativeDateKey>>[0])
        }}
        onNativeFocusChange={(event) => {
          if (!attached.current || event.nativeEvent.ownerId !== ownerId) return
          const target = nativeTarget.current
          const tag = target && findNodeHandle(target)
          if (target && typeof tag === "number" && tag > 0 && event.nativeEvent.target === tag) {
            observedFocusedTarget.current = event.nativeEvent.isFocused ? { target, window: focusWindow() } : null
            observeNativeFocus(target, event.nativeEvent.isFocused)
          }
          if (event.nativeEvent.isFocused) onFocus?.(event)
          else onBlur?.(event)
        }}
      />
    </NativeViewContextBoundary>
  )
})
NativeFocusHost.displayName = "NativeFocusHost"
export const NativeFocusView = forwardRef<TNativeFocusViewRef, TNativeFocusViewProps>((props, ref) => (
  <NativeFocusHost {...props} ref={ref} />
))
NativeFocusView.displayName = "NativeFocusView"
