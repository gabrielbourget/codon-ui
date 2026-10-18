import {
  useCallback,
  useContext,
  useId,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import { AppState, StyleSheet, View } from "react-native"

import { useNativeKeyScope } from "../../input/NativeKeyboardScope"
import { OverlayParentContext, OverlayRegistryContext } from "../NativeOverlayProvider"

import { NativeBackdropAdapterContext } from "./context"
import { createNativeBackdropLifetime } from "./lifetime"
import type { TNativeBackdropSource } from "./types"

export const NativeBackdropEffect = ({
  source,
  radius = 10,
}: {
  source: TNativeBackdropSource | null
  radius?: number
}) => {
  const adapter = useContext(NativeBackdropAdapterContext)
  const window = useContext(OverlayParentContext)
  const registry = useContext(OverlayRegistryContext)
  const input = useNativeKeyScope()
  const ownerId = useId()
  const live = useRef(true)
  const appState = useRef(AppState.currentState)
  const [lifetime] = useState(createNativeBackdropLifetime)
  const observation = useSyncExternalStore(lifetime.subscribe, lifetime.snapshot, lifetime.snapshot)
  const current = useRef({ input, registry, window, source, adapter, radius })
  const signature = useCallback(() => {
    const owner = current.current
    const state = owner.window && owner.registry ? owner.registry.state(owner.window) : null
    const session = owner.input?.acknowledgedSession()
    return JSON.stringify([
      state?.visible,
      state?.mounted,
      state?.covered,
      owner.input?.ownerId,
      session?.windowId,
      session?.epoch,
      owner.input?.isWindowActive(),
      appState.current,
    ])
  }, [])
  const observe = useCallback(() => lifetime.observe(signature()), [lifetime, signature])
  const allowed = () => {
    const owner = current.current
    const state = owner.window && owner.registry ? owner.registry.state(owner.window) : null
    return (
      live.current &&
      owner.input === input &&
      owner.registry === registry &&
      owner.window === window &&
      owner.source === source &&
      owner.source?.isCurrent() === true &&
      owner.adapter?.Effect === adapter?.Effect &&
      owner.radius === radius &&
      appState.current === "active" &&
      state?.visible === true &&
      !state.covered &&
      owner.input?.isWindowActive() === true
    )
  }
  const lease = useMemo(
    () => lifetime.issue(ownerId, allowed),
    [lifetime, ownerId, input, registry, window, source, adapter?.Effect, radius, observation],
  )
  useInsertionEffect(() => {
    current.current = { input, registry, window, source, adapter, radius }
    lifetime.stage(signature())
    lifetime.commit(lease.identity)
    return () => lifetime.retire()
  }, [input, registry, window, source, adapter, radius, lifetime, signature, lease])
  useInsertionEffect(
    () => () => {
      live.current = false
      lifetime.retire()
    },
    [lifetime],
  )
  useLayoutEffect(() => input?.subscribe(observe), [input, observe])
  useLayoutEffect(() => {
    const release = registry?.subscribe(observe)
    return () => {
      release?.()
    }
  }, [registry, observe])
  useLayoutEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      appState.current = state
      observe()
    })
    return () => subscription.remove()
  }, [observe])
  if (!adapter) throw new Error("overlayBlur true requires NativeOverlayProvider.backdropAdapter")
  if (!source) throw new Error("overlayBlur true requires a parent-window NativeBackdropHost")
  if (!Number.isFinite(radius) || radius < 0)
    throw new TypeError("Native backdrop radius must be finite and nonnegative")
  if (!source.targetRef.current || !source.isCurrent()) return null
  const Effect = adapter.Effect
  const state = window && registry ? registry.state(window) : null
  const isPaused =
    appState.current !== "active" || state?.visible !== true || state.covered || input?.isWindowActive() !== true
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
    >
      <Effect
        targetRef={source.targetRef}
        radius={radius}
        style={StyleSheet.absoluteFill}
        isPaused={isPaused}
        lease={{ ownerId, generation: lease.generation, isCurrent: lease.isCurrent }}
      />
    </View>
  )
}
