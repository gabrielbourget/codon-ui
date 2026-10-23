import { useContext, useInsertionEffect, useRef, type RefObject } from "react"
import { findNodeHandle, type View } from "react-native"

import { NativeCollectionActionsContext } from "../../collection/actions"
import type { TNativeCollectionNode } from "../../collection/snapshot"
import { useNativeKeyScope } from "../../input/NativeKeyboardScope"
import { NativeFloatingScopeContext, NativeFloatingWindowContext } from "../../overlays/floating/scope"

import { useNativeTable, type TNativeTableContext } from "./context"

export const useTableAction = (node: TNativeCollectionNode<object>, target: RefObject<View | null>) => {
  const table = useNativeTable()
  const actions = useContext(NativeCollectionActionsContext)!
  const scope = useNativeKeyScope()
  const floating = useContext(NativeFloatingScopeContext)
  const window = useContext(NativeFloatingWindowContext)
  const live = useRef(false)
  const current = useRef({ table, node, target, scope, floating, window })
  useInsertionEffect(() => {
    current.current = { table, node, target, scope, floating, window }
  })
  useInsertionEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])
  const eligible = () =>
    live.current &&
    current.current.scope?.isWindowActive() !== false &&
    current.current.floating?.canAct() !== false &&
    current.current.window?.() !== false
  return {
    binding: actions.bindingFor(node),
    request: (run: (table: TNativeTableContext, node: TNativeCollectionNode<object>) => void) => {
      const owner = current.current
      const original = owner.target.current
      const tag = original && findNodeHandle(original)
      if (!eligible() || !tag) return false
      return actions.request(owner.node, tag, () => {
        if (eligible() && current.current.target.current === original) run(current.current.table, current.current.node)
      })
    },
  }
}
