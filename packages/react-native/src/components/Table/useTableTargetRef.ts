import { useCallback, useInsertionEffect, useLayoutEffect, useRef, type Ref, type RefObject } from "react"
import type { View } from "react-native"

import { useNativeCollectionRefs } from "../../collection/context"
import type { TNativeCollectionNode } from "../../collection/snapshot"

type TRegistration = {
  node: TNativeCollectionNode<object>
  register: (node: TNativeCollectionNode<object>, view: View | null) => void
  header?: (view: View | null) => void
}

// Metadata revisions update keyboard/header registration without detaching a stable consumer ref.
export const useTableTargetRef = (
  target: RefObject<View | null>,
  ref: Ref<View> | undefined,
  registration: TRegistration,
) => {
  const current = useRef(registration)
  const bound = useRef<(TRegistration & { view: View }) | null>(null)
  useInsertionEffect(() => {
    current.current = registration
  })
  const synchronize = useCallback((view: View | null) => {
    const previous = bound.current
    const next = current.current
    if (
      previous &&
      (!view || previous.view !== view || previous.register !== next.register || previous.node.key !== next.node.key)
    )
      previous.register(previous.node, null)
    if (previous && (!view || previous.view !== view || previous.header !== next.header)) previous.header?.(null)
    if (view) {
      if (!previous || previous.view !== view || previous.node !== next.node || previous.register !== next.register)
        next.register(next.node, view)
      if (!previous || previous.view !== view || previous.header !== next.header) next.header?.(view)
      bound.current = { ...next, view }
    } else bound.current = null
  }, [])
  const bind = useCallback(
    (view: View | null) => {
      target.current = view
      synchronize(view)
    },
    [target, synchronize],
  )
  useLayoutEffect(
    () => synchronize(target.current),
    [target, registration.node, registration.register, registration.header, synchronize],
  )
  return useNativeCollectionRefs(ref, bind)
}
