import { useContext, useId, useInsertionEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react"

import { OverlayRegistryContext } from "../NativeOverlayProvider"

import type { TNativeFloatingOutsideInteraction } from "./interaction"
import type { TNativeFloatingDismissReason, TNativeFloatingLayerRegistry } from "./registry"
import { NativeFloatingWindowContext } from "./scope"

type TOptions = {
  registry: TNativeFloatingLayerRegistry
  parent: string | null
  isOpen: boolean
  isModal: boolean
  isKeyboardDismissDisabled: boolean
  priority?: number
  onDismiss: (reason: TNativeFloatingDismissReason) => void
  onOutside?: (interaction: TNativeFloatingOutsideInteraction) => void
}
type TLease = ReturnType<TNativeFloatingLayerRegistry["register"]>
const subscribeNone = () => () => undefined
const zero = () => 0

export const useNativeFloatingLayer = (options: TOptions) => {
  const { registry, parent, isOpen, isModal, isKeyboardDismissDisabled, priority } = options
  const id = useId()
  const lease = useRef<TLease | null>(null)
  const windowActive = useContext(NativeFloatingWindowContext)
  const windows = useContext(OverlayRegistryContext)
  useSyncExternalStore(windows?.subscribe ?? subscribeNone, windows?.snapshot ?? zero, zero)
  useSyncExternalStore(registry.subscribe, registry.snapshot, zero)
  const current = useRef({ onDismiss: options.onDismiss, onOutside: options.onOutside, windowActive })
  current.current = { onDismiss: options.onDismiss, onOutside: options.onOutside, windowActive }
  const latestOptions = () => ({
    parent,
    isOpen,
    isModal,
    isKeyboardDismissDisabled,
    priority,
    onDismiss: (reason: TNativeFloatingDismissReason) => {
      if (current.current.windowActive?.() !== false) current.current.onDismiss(reason)
    },
    onOutside: options.onOutside
      ? (interaction: TNativeFloatingOutsideInteraction) => {
          if (current.current.windowActive?.() !== false) current.current.onOutside?.(interaction)
        }
      : undefined,
  })
  useInsertionEffect(() => {
    lease.current = registry.register(id, latestOptions(), false)
    const owned = lease.current
    return () => {
      owned.unregister(false)
      lease.current = null
    }
    // Registration owns one logical parent and retires the complete lease on replacement.
  }, [registry, id, parent])
  useInsertionEffect(() => {
    lease.current?.update(latestOptions(), false)
  }, [
    registry,
    id,
    parent,
    isOpen,
    isModal,
    isKeyboardDismissDisabled,
    priority,
    options.onDismiss,
    options.onOutside,
    windowActive,
  ])
  useLayoutEffect(() => {
    registry.flush()
  }, [registry, id, parent, isOpen, isModal, isKeyboardDismissDisabled, priority])
  useLayoutEffect(() => () => registry.flush(), [registry, id])
  const state = registry.state(id)
  const generation = state.generation
  const owned = lease.current
  return {
    ...state,
    id,
    active: state.active && windowActive?.() !== false,
    canAct: () => current.current.windowActive?.() !== false && (owned?.canAct(generation) ?? false),
    canMeasure: () => {
      const latest = owned?.state()
      return (
        current.current.windowActive?.() !== false &&
        latest?.generation === generation &&
        (latest.phase === "entering" || latest.phase === "open") &&
        !latest.covered
      )
    },
    entered: () => current.current.windowActive?.() !== false && (owned?.entered(generation) ?? false),
    exited: () => owned?.exited(generation) ?? false,
  }
}
