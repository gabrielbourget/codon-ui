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

import { createNativeKeyScope, type TNativeKeyPolicy, type TNativeKeyScope } from "./keyScope"
import ScopeHost, { type NativeScopedKeyData } from "./specs/CUIKeyboardScopeNativeComponent"
import type { TNativeKeyboardData } from "./types"

type TScopedKeyboardEvent = NativeSyntheticEvent<Omit<NativeScopedKeyData, "kind"> & Pick<TNativeKeyboardData, "kind">>
const isKeyboardEvent = (event: NativeSyntheticEvent<NativeScopedKeyData>): event is TScopedKeyboardEvent =>
  event.nativeEvent.kind === "keyboard"
const NativeKeyScopeContext = createContext<TNativeKeyScope | null>(null)
export const useNativeKeyScope = () => useContext(NativeKeyScopeContext)

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
    const attached = useRef(false)
    const releaseRef = useRef<(() => void) | undefined>(undefined)
    useSyncExternalStore(scope.subscribe, scope.snapshot, scope.snapshot)
    useInsertionEffect(() => scope.setEnabled(captureEnabled), [scope, captureEnabled])
    useInsertionEffect(() => () => scope.dispose(), [scope])
    useLayoutEffect(() => scope.flush(), [scope, captureEnabled])
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
        <ScopeHost
          {...props}
          ref={setRef}
          ownerId={ownerId}
          enabled={captureEnabled}
          policies={scope.policies()}
          acceptedWindowId={session.windowId}
          acceptedEpoch={session.epoch}
          policyRevision={scope.policyRevision()}
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
      </NativeKeyScopeContext.Provider>
    )
  },
)
NativeKeyboardScope.displayName = "NativeKeyboardScope"
