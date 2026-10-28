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

import { createNativeDialogFocusRegistry } from "./dialogFocusRegistry"
import { createNativeFloatingObservations, type TNativeFloatingObservations } from "./floatingObservation"
import {
  createNativeKeyboardObservations,
  type TNativeKeyboardObservation,
  type TNativeKeyboardObservations,
} from "./keyboardObservation"
import { createNativeKeyScope, type TNativeKeyPolicy, type TNativeKeyScope } from "./keyScope"
import { NativeDialogRegistryContext } from "./NativeDialogFocusScope"
import { createNativeDragActions, NativeDragActionsContext } from "./nativeDragActions"
import { dispatchNativeGestureWindow } from "./nativeGestureObservation"
import { createNativeMenuPointers, type TNativeMenuPointerPolicy, type TNativeMenuPointers } from "./nativeMenuPointers"
import { nativeViewProps, NativeViewContextBoundary } from "./nativeViewProps"
import {
  createNativeWindowPointers,
  dispatchNativeWindowPointer,
  type TNativeWindowPointers,
} from "./nativeWindowPointers"
import ScopeHost, { type NativeScopedKeyData } from "./specs/CUIKeyboardScopeNativeComponent"
import type { TNativeKeyboardData } from "./types"

type TScopedKeyboardEvent = NativeSyntheticEvent<Omit<NativeScopedKeyData, "kind"> & Pick<TNativeKeyboardData, "kind">>
const isKeyboardEvent = (event: NativeSyntheticEvent<NativeScopedKeyData>): event is TScopedKeyboardEvent =>
  event.nativeEvent.kind === "keyboard"
const NativeKeyScopeContext = createContext<TNativeKeyScope | null>(null)
export const useNativeKeyScope = () => useContext(NativeKeyScopeContext)
export const useNativeDragActions = () => useContext(NativeDragActionsContext)
const NativeWindowPointersContext = createContext<TNativeWindowPointers | null>(null)
export const useNativeWindowPointers = () => useContext(NativeWindowPointersContext)
const NativeMenuPointersContext = createContext<TNativeMenuPointers | null>(null)
export const useNativeMenuPointerPolicy = (policy: TNativeMenuPointerPolicy) => {
  const registry = useContext(NativeMenuPointersContext)
  const key = useId()
  const lease = useRef<ReturnType<TNativeMenuPointers["register"]> | null>(null)
  const committed = useRef(policy)
  useInsertionEffect(() => {
    if (!registry) throw new Error("Native Menu pointer policies require a same-window NativeFloatingLayerHost")
    const registration = registry.register(key, committed.current)
    lease.current = registration
    return () => {
      registration.unregister()
      if (lease.current === registration) lease.current = null
    }
  }, [registry, key])
  useInsertionEffect(() => {
    committed.current = policy
    lease.current?.update(policy)
  })
  useLayoutEffect(() => {
    registry?.flush()
    return () => registry?.flush()
  })
}
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

type TNativeKeyboardScopeProps = ViewProps & { captureEnabled: boolean; nativeTypographyWindow?: string }

export const NativeKeyboardScope = forwardRef<View, TNativeKeyboardScopeProps>(
  ({ captureEnabled, nativeTypographyWindow, ...props }, forwardedRef) => {
    const ownerId = useId()
    const [scope] = useState(() => createNativeKeyScope(ownerId))
    const [dragActions] = useState(() => createNativeDragActions(scope))
    const [dialogs] = useState(() => createNativeDialogFocusRegistry(scope))
    const [pointers] = useState(() => createNativeWindowPointers(scope))
    const [menuPointers] = useState(() => createNativeMenuPointers(scope))
    const [observations] = useState(createNativeFloatingObservations)
    const [keyboardObservations] = useState(() => createNativeKeyboardObservations(ownerId))
    const attached = useRef(false)
    const releaseRef = useRef<(() => void) | undefined>(undefined)
    useSyncExternalStore(scope.subscribe, scope.snapshot, scope.snapshot)
    useSyncExternalStore(dragActions.subscribe, dragActions.snapshot, dragActions.snapshot)
    useSyncExternalStore(dialogs.subscribe, dialogs.snapshot, dialogs.snapshot)
    useSyncExternalStore(pointers.subscribe, pointers.snapshot, pointers.snapshot)
    useSyncExternalStore(menuPointers.subscribe, menuPointers.snapshot, menuPointers.snapshot)
    useSyncExternalStore(observations.subscribe, observations.snapshot, observations.snapshot)
    useSyncExternalStore(keyboardObservations.subscribe, keyboardObservations.snapshot, keyboardObservations.snapshot)
    useInsertionEffect(() => scope.setEnabled(captureEnabled), [scope, captureEnabled])
    useInsertionEffect(() => dragActions.setEnabled(captureEnabled), [dragActions, captureEnabled])
    useInsertionEffect(() => pointers.setEnabled(captureEnabled), [pointers, captureEnabled])
    useInsertionEffect(() => menuPointers.setEnabled(captureEnabled), [menuPointers, captureEnabled])
    useInsertionEffect(() => () => menuPointers.dispose(), [menuPointers])
    useInsertionEffect(() => () => pointers.dispose(), [pointers])
    useInsertionEffect(() => keyboardObservations.setEnabled(captureEnabled), [keyboardObservations, captureEnabled])
    useInsertionEffect(() => () => dragActions.dispose(), [dragActions])
    useInsertionEffect(() => () => scope.dispose(), [scope])
    useInsertionEffect(() => () => dialogs.dispose(), [dialogs])
    useInsertionEffect(() => () => observations.dispose(), [observations])
    useInsertionEffect(() => () => keyboardObservations.dispose(), [keyboardObservations])
    useLayoutEffect(() => {
      dragActions.flush()
    }, [dragActions, captureEnabled])
    useLayoutEffect(() => {
      scope.flush()
      dialogs.flush()
      keyboardObservations.flush()
      pointers.syncSession()
      pointers.flush()
      menuPointers.syncSession()
      menuPointers.flush()
      return scope.subscribe(() => {
        dialogs.flush()
        pointers.syncSession()
        menuPointers.syncSession()
      })
    }, [scope, dialogs, keyboardObservations, pointers, menuPointers, captureEnabled])
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
    const pointerFailure = pointers.error()
    if (pointerFailure) throw new Error(pointerFailure)
    const dragFailure = dragActions.error()
    if (dragFailure) throw new Error(dragFailure)
    const dialogFailure = dialogs.error()
    if (dialogFailure) throw new Error(dialogFailure)
    return (
      <NativeKeyScopeContext.Provider value={scope}>
        <NativeDragActionsContext.Provider value={dragActions}>
          <NativeDialogRegistryContext.Provider value={dialogs}>
            <NativeWindowPointersContext.Provider value={pointers}>
              <NativeMenuPointersContext.Provider value={menuPointers}>
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
                        dragBindings={dragActions.bindings()}
                        onNativeDragStatus={(event) => {
                          if (attached.current) dragActions.acceptStatus(event.nativeEvent.packet)
                        }}
                        onNativeDragAction={(event) => {
                          if (attached.current) dragActions.dispatch(event.nativeEvent.packet)
                        }}
                        dialogScopes={dialogs.bindings()}
                        dialogRevision={dialogs.revision()}
                        onNativeDialogStatus={(event) => {
                          if (attached.current) dialogs.acceptStatus(event.nativeEvent)
                        }}
                        onNativeDialogAction={(event) => {
                          if (attached.current) dialogs.acceptAction(event.nativeEvent)
                        }}
                        enabled={captureEnabled}
                        nativeTypographyWindow={nativeTypographyWindow}
                        policies={scope.policies()}
                        acceptedWindowId={session.windowId}
                        acceptedEpoch={session.epoch}
                        policyRevision={scope.policyRevision()}
                        floatingTargets={observations.targets()}
                        observations={keyboardObservations.registrations()}
                        observationRevision={keyboardObservations.revision()}
                        pointerRegistrations={pointers.registrations()}
                        pointerRevision={pointers.revision()}
                        menuPointerPolicies={menuPointers.policies()}
                        menuPointerRevision={menuPointers.revision()}
                        onNativeMenuPointer={(event) => {
                          if (attached.current) menuPointers.dispatch(event)
                        }}
                        onNativeWindowPointer={(event) => {
                          if (attached.current) dispatchNativeWindowPointer(event)
                        }}
                        onNativePointerStatus={(event) => {
                          if (attached.current) pointers.acceptStatus(event.nativeEvent)
                        }}
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
              </NativeMenuPointersContext.Provider>
            </NativeWindowPointersContext.Provider>
          </NativeDialogRegistryContext.Provider>
        </NativeDragActionsContext.Provider>
      </NativeKeyScopeContext.Provider>
    )
  },
)
NativeKeyboardScope.displayName = "NativeKeyboardScope"
