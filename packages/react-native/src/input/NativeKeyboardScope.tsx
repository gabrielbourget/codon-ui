import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useId,
  useInsertionEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ElementRef,
} from "react"
import type { NativeSyntheticEvent, View, ViewProps } from "react-native"

import { createNativeFloatingObservations, type TNativeFloatingObservations } from "./floatingObservation"
import {
  createNativeKeyboardObservations,
  type TNativeKeyboardObservation,
  type TNativeKeyboardObservations,
} from "./keyboardObservation"
import { createNativeKeyScope, type TNativeKeyPolicy, type TNativeKeyScope } from "./keyScope"
import { dispatchNativeGestureWindow } from "./nativeGestureObservation"
import { nativeViewProps, NativeViewContextBoundary } from "./nativeViewProps"
import ScopeHost, { type NativeScopedKeyData } from "./specs/CUIKeyboardScopeNativeComponent"
import type { TNativeKeyboardData } from "./types"

type TScopedKeyboardEvent = NativeSyntheticEvent<Omit<NativeScopedKeyData, "kind"> & Pick<TNativeKeyboardData, "kind">>
const isKeyboardEvent = (event: NativeSyntheticEvent<NativeScopedKeyData>): event is TScopedKeyboardEvent =>
  event.nativeEvent.kind === "keyboard"
const NativeKeyScopeContext = createContext<TNativeKeyScope | null>(null)
export const useNativeKeyScope = () => useContext(NativeKeyScopeContext)
const NativeFloatingObservationsContext = createContext<TNativeFloatingObservations | null>(null)
export const useNativeFloatingObservations = () => useContext(NativeFloatingObservationsContext)
const NativeKeyboardObservationsContext = createContext<TNativeKeyboardObservations | null>(null)
export const useNativeKeyboardObservation = (observation: TNativeKeyboardObservation) => {
  const scope = useContext(NativeKeyboardObservationsContext)
  const key = useId()
  const lease = useRef<ReturnType<TNativeKeyboardObservations["register"]> | null>(null)
  const committed = useRef(observation)
  useInsertionEffect(() => {
    if (!scope) throw new Error("Native keyboard observations require a same-window NativeFloatingLayerHost")
    const registration = scope.register(key, committed.current)
    lease.current = registration
    return () => {
      registration.unregister()
      if (lease.current === registration) lease.current = null
    }
  }, [scope, key])
  useInsertionEffect(() => {
    committed.current = observation
    lease.current?.update(observation)
  })
  useLayoutEffect(() => {
    scope?.flush()
    return () => scope?.flush()
  })
}

export const useNativeKeyPolicy = (policy: TNativeKeyPolicy) => {
  const scope = useNativeKeyScope()
  const key = useId()
  const lease = useRef<ReturnType<TNativeKeyScope["register"]> | null>(null)
  const committed = useRef(policy)
  useInsertionEffect(() => {
    if (!scope) throw new Error("Native key policies require a same-window NativeFloatingLayerHost")
    const registration = scope.register(key, committed.current)
    lease.current = registration
    return () => {
      registration.unregister()
      if (lease.current === registration) lease.current = null
    }
  }, [scope, key])
  useInsertionEffect(() => {
    committed.current = policy
    lease.current?.update(policy)
  })
  useLayoutEffect(() => {
    scope?.flush()
    return () => scope?.flush()
  })
}

export const NativeKeyboardScope = forwardRef<View, ViewProps & { captureEnabled: boolean }>(
  ({ captureEnabled, ...props }, forwardedRef) => {
    const ownerId = useId()
    const [scope] = useState(() => createNativeKeyScope(ownerId))
    const [observations] = useState(createNativeFloatingObservations)
    const [keyboardObservations] = useState(() => createNativeKeyboardObservations(ownerId))
    const attached = useRef(false)
    const releaseRef = useRef<(() => void) | undefined>(undefined)
    useSyncExternalStore(scope.subscribe, scope.snapshot, scope.snapshot)
    useSyncExternalStore(observations.subscribe, observations.snapshot, observations.snapshot)
    useSyncExternalStore(keyboardObservations.subscribe, keyboardObservations.snapshot, keyboardObservations.snapshot)
    useInsertionEffect(() => scope.setEnabled(captureEnabled), [scope, captureEnabled])
    useInsertionEffect(() => keyboardObservations.setEnabled(captureEnabled), [keyboardObservations, captureEnabled])
    useInsertionEffect(() => () => scope.dispose(), [scope])
    useInsertionEffect(() => () => observations.dispose(), [observations])
    useInsertionEffect(() => () => keyboardObservations.dispose(), [keyboardObservations])
    useLayoutEffect(() => {
      scope.flush()
      keyboardObservations.flush()
    }, [scope, keyboardObservations, captureEnabled])
    const setRef = useCallback(
      (target: ElementRef<typeof ScopeHost> | null) => {
        attached.current = target !== null
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
    const session = scope.acknowledgedSession()
    return (
      <NativeKeyScopeContext.Provider value={scope}>
        <NativeFloatingObservationsContext.Provider value={observations}>
          <NativeKeyboardObservationsContext.Provider value={keyboardObservations}>
            <NativeViewContextBoundary>
              <ScopeHost
                {...nativeViewProps(props)}
                onTouchMove={(event) => {
                  props.onTouchMove?.(event)
                  dispatchNativeGestureWindow(scope, event, "move")
                }}
                onTouchEnd={(event) => {
                  props.onTouchEnd?.(event)
                  dispatchNativeGestureWindow(scope, event, "end")
                }}
                onTouchCancel={(event) => {
                  props.onTouchCancel?.(event)
                  dispatchNativeGestureWindow(scope, event, "cancel")
                }}
                onPointerMove={(event) => {
                  props.onPointerMove?.(event)
                  dispatchNativeGestureWindow(scope, event, "move")
                }}
                onPointerUp={(event) => {
                  props.onPointerUp?.(event)
                  dispatchNativeGestureWindow(scope, event, "end")
                }}
                onPointerCancel={(event) => {
                  props.onPointerCancel?.(event)
                  dispatchNativeGestureWindow(scope, event, "cancel")
                }}
                ref={setRef}
                ownerId={ownerId}
                enabled={captureEnabled}
                policies={scope.policies()}
                acceptedWindowId={session.windowId}
                acceptedEpoch={session.epoch}
                policyRevision={scope.policyRevision()}
                floatingTargets={observations.targets()}
                observations={keyboardObservations.registrations()}
                observationRevision={keyboardObservations.revision()}
                onNativeObservedKey={(event) => {
                  if (attached.current) keyboardObservations.dispatch(event)
                }}
                onNativeObservationStatus={(event) => {
                  if (attached.current) keyboardObservations.acceptStatus(event.nativeEvent)
                }}
                onNativeFloatingObservation={(event) => {
                  const data = event.nativeEvent
                  const session = scope.acknowledgedSession()
                  if (
                    attached.current &&
                    captureEnabled &&
                    scope.isWindowActive() === true &&
                    data.ownerId === ownerId &&
                    data.windowId === session.windowId &&
                    data.epoch === session.epoch
                  )
                    observations.dispatch(data)
                }}
                onNativeScopeStatus={(event) => {
                  if (attached.current) scope.acceptNativeStatus(event.nativeEvent)
                }}
                onNativeInputModality={(event) => {
                  if (attached.current) scope.recordInput(event.nativeEvent)
                }}
                onNativeScopedKey={(event) => {
                  if (!attached.current || !isKeyboardEvent(event)) return
                  const data = event.nativeEvent
                  scope.dispatch(data.policyId, event, data)
                }}
              />
            </NativeViewContextBoundary>
          </NativeKeyboardObservationsContext.Provider>
        </NativeFloatingObservationsContext.Provider>
      </NativeKeyScopeContext.Provider>
    )
  },
)
NativeKeyboardScope.displayName = "NativeKeyboardScope"
