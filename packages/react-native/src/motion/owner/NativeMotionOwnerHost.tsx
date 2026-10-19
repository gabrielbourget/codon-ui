import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react"

import { resolveNativeStyle } from "../../components/colors"
import { useNativeKeyScope } from "../../input/NativeKeyboardScope"
import type { TNativeFocusViewRef } from "../../input/types"
import { NativeFloatingScopeContext, NativeFloatingWindowContext } from "../../overlays/floating/scope"
import { useNativeMotionConfig, useNativeMotionReducedMotion } from "../config"
import { useNativeMotionInteractions } from "../interactions/useNativeMotionInteractions"
import { NativeMotionVisualHost } from "../visual/NativeMotionVisualHost"
import type { TNativeMotionVisualHostProps } from "../visual/types"

import { NativeMotionOwner, nativeInitialVariantContext } from "./NativeMotionOwner"
import type {
  TNativeMotionInitialContext,
  TNativeMotionOwnerOptions,
  TNativeMotionOwnerProps,
} from "./NativeMotionOwner"

const NativeMotionOwnerContext = createContext<TNativeMotionInitialContext & { owner?: NativeMotionOwner }>({})
export type TNativeMotionOwnerHostProps = Omit<TNativeMotionVisualHostProps, "bindings" | "motionOwner"> & {
  motion: TNativeMotionOwnerProps
  values?: TNativeMotionOwnerOptions["values"]
  readValue?: TNativeMotionOwnerOptions["readValue"]
  resolveGeometry?: TNativeMotionOwnerOptions["resolveGeometry"]
  presence?: TNativeMotionOwnerOptions["presence"]
}

// Private composition uses the original native host/ref. No partial Card/public API is exported.
export const NativeMotionOwnerHost = forwardRef<TNativeFocusViewRef, TNativeMotionOwnerHostProps>(
  ({ motion, values, readValue, resolveGeometry, presence, ...visual }, ref) => {
    const inherited = useContext(NativeMotionOwnerContext)
    const parent = inherited.owner
    const config = useNativeMotionConfig()
    const reduced = useNativeMotionReducedMotion()
    const scope = useNativeKeyScope()
    const floating = useContext(NativeFloatingScopeContext)
    const windowIsActive = useContext(NativeFloatingWindowContext)
    const options: TNativeMotionOwnerOptions = {
      props: motion,
      values,
      config,
      reduced,
      readValue,
      resolveGeometry,
      presence,
      initialContext: inherited,
      base: Object.fromEntries(
        Object.entries(resolveNativeStyle([visual.computedStyles, visual.customStyles, visual.style], "Card", "style")),
      ),
      canAct: () =>
        (!scope || Boolean(scope.acknowledgedSession().windowId)) &&
        scope?.isWindowActive() !== false &&
        floating?.canAct() !== false &&
        windowIsActive?.() !== false,
      waitForInitialWindow: () =>
        Boolean(scope && !scope.acknowledgedSession().windowId) &&
        scope?.isWindowActive() !== false &&
        floating?.canAct() !== false &&
        windowIsActive?.() !== false,
    }
    const [owner] = useState(() => new NativeMotionOwner(options, parent))
    const initialContext = nativeInitialVariantContext(motion, inherited)
    const initialDependency = Array.isArray(initialContext.initial)
      ? initialContext.initial.join(" ")
      : initialContext.initial
    const animateDependency = Array.isArray(initialContext.animate)
      ? initialContext.animate.join(" ")
      : initialContext.animate
    const context = useMemo(() => ({ ...initialContext, owner }), [owner, initialDependency, animateDependency])
    const [failure, setFailure] = useState<{ error: unknown } | null>(null)
    const interactions = useNativeMotionInteractions(owner, motion, config.isStatic, visual, scope, (error) =>
      setFailure({ error }),
    )
    const [, refreshWindow] = useState(0)
    const bindings = useSyncExternalStore(owner.subscribeBindings, owner.getBindings, owner.getBindings)
    useInsertionEffect(() => owner.commitProps(options))
    useLayoutEffect(() => {
      owner.configure(options)
    })
    useEffect(() => {
      const current = owner.captureAnimationLease()
      if (current())
        void owner.animationState.animateChanges().catch((error: unknown) => {
          if (current()) setFailure({ error })
        })
      owner.enteringChildren = undefined
    })
    useLayoutEffect(() => {
      const signature = () => {
        const session = scope?.acknowledgedSession()
        return JSON.stringify([scope?.ownerId, session?.windowId, session?.epoch, scope?.isWindowActive()])
      }
      let previous = signature()
      return scope?.subscribe(() => {
        const next = signature()
        if (next !== previous) {
          previous = next
          owner.invalidate()
          refreshWindow((revision) => revision + 1)
        }
      })
    }, [owner, scope])
    if (failure) throw failure.error
    return (
      <NativeMotionOwnerContext.Provider value={context}>
        <NativeMotionVisualHost {...visual} {...interactions} bindings={bindings} motionOwner={owner} ref={ref} />
      </NativeMotionOwnerContext.Provider>
    )
  },
)
NativeMotionOwnerHost.displayName = "NativeMotionOwnerHost"
