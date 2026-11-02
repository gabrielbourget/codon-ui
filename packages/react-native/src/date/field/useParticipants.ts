import { useContext, useId, useInsertionEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react"
import type { NativeSyntheticEvent, View } from "react-native"
import { findNodeHandle } from "react-native"

import { isNativeFocusTarget } from "../../input/focus"
import { nativeKeyTokens } from "../../input/keyScope"
import { useNativeKeyScope } from "../../input/NativeKeyboardScope"
import { NativeOrdinaryEditorKeysContext } from "../../input/ordinaryEditorKeys"
import type { NativeOrdinaryEditorKeyData } from "../../input/specs/CUIFocusViewNativeComponent"
import type { TNativeKeyboardEvent } from "../../input/types"

import type { TNativeExtraFocusParticipants } from "./participants"

export const useNativeDateFieldParticipants = (options: {
  root: View | null
  participants?: TNativeExtraFocusParticipants
  requiresHost: boolean
  disabled: boolean
  key: (event: TNativeKeyboardEvent) => void
}) => {
  const registry = useContext(NativeOrdinaryEditorKeysContext)
  const scope = useNativeKeyScope()
  useSyncExternalStore(registry?.subscribe ?? (() => () => {}), registry?.snapshot ?? (() => 0), () => 0)
  const owner = useId()
  const committed = useRef(options)
  useInsertionEffect(() => {
    committed.current = options
  })
  const leases = useRef(new Map<View, ReturnType<NonNullable<typeof registry>["register"]>>())
  const policies = useRef(new Map<View, ReturnType<NonNullable<typeof scope>["register"]>>())
  const belongs = (target: object) => committed.current.participants?.some((ref) => ref.current === target) ?? false
  // Reconcile refs after every commit. Ref.current may change without a new
  // array identity, and child ComboBoxes can share the native publisher.
  useLayoutEffect(() => {
    const value = committed.current
    if (value.requiresHost && (!scope || !registry))
      throw new Error(
        "Custom field participants and editor key callbacks require a same-window NativeFloatingLayerHost",
      )
    const targets = value.disabled
      ? []
      : (value.participants ?? []).flatMap((ref) => (ref.current ? [ref.current] : []))
    if (new Set(targets).size !== targets.length)
      throw new Error("extraFocusParticipants must contain distinct original controls")
    const root = value.requiresHost && !value.disabled ? value.root : null
    for (const [target, lease] of leases.current)
      if (target !== root) {
        lease.unregister()
        leases.current.delete(target)
      }
    for (const target of targets)
      if (!isNativeFocusTarget(target))
        throw new Error(
          "extraFocusParticipants requires original TextInput or NativeFocusView refs; opaque controls need an explicit adapter",
        )
    if (root && registry && !leases.current.has(root))
      leases.current.set(
        root,
        registry.register(`${owner}:root`, {
          original: root,
          subtree: true,
          current: () => committed.current.root,
          currentTarget: () => committed.current.root,
          canAct: () => !committed.current.disabled,
          receive: (event) => {
            committed.current.key(event)
          },
        }),
      )
    for (const [target, lease] of policies.current)
      if (!targets.includes(target)) {
        lease.unregister()
        policies.current.delete(target)
      }
    for (const target of targets)
      if (scope) {
        const tag = findNodeHandle(target)
        if (!tag) continue
        const policy = {
          tokens: [...nativeKeyTokens("ArrowLeft"), ...nativeKeyTokens("ArrowRight")],
          excludeEditable: false,
          excludeComposing: true,
          targetTag: tag,
          lifetimeKey: `${owner}:${tag}`,
          isEnabled: !value.disabled,
          canAct: () => !committed.current.disabled && belongs(target),
          // Raw native delivery carries the real target and bubbling receiver.
          onKey: () => {},
        }
        const lease = policies.current.get(target)
        if (lease) lease.update(policy)
        else policies.current.set(target, scope.register(`${owner}:arrows:${tag}`, policy))
      }
    scope?.flush()
  })
  useLayoutEffect(
    () => () => {
      for (const lease of leases.current.values()) lease.unregister()
      leases.current.clear()
      for (const lease of policies.current.values()) lease.unregister()
      policies.current.clear()
      scope?.flush()
    },
    [scope, registry],
  )
  return {
    belongs,
    observes: (_target: object) => committed.current.requiresHost && !committed.current.disabled,
    receive: (event: NativeSyntheticEvent<NativeOrdinaryEditorKeyData>) => {
      const lease = committed.current.root && leases.current.get(committed.current.root)
      lease?.receive(event)
    },
  }
}
