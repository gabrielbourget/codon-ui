/* Copyright 2023 Adobe. Apache-2.0; see ../../collection/LICENSE.react-aria.md. */
import { useContext, useId, useInsertionEffect, useLayoutEffect, useRef, type ReactElement } from "react"
import { I18nManager, type View } from "react-native"

import { createNativeCollectionBranch } from "../../collection/CollectionBuilder"
import { useNativeCollectionRefs, useNativeSlottedContext } from "../../collection/context"
import { NativeCollectionRendererContext } from "../../collection/renderer"
import type { TNativeCollectionSnapshot } from "../../collection/snapshot"

import {
  NativeMenuItemContext,
  NativeMenuDirectionContext,
  NativeMenuActionsContext,
  NativeMenuListContext,
  NativeMenuStateContext,
  NativeRootMenuTriggerStateContext,
  NativeSubmenuContext,
  NativeSubmenuItemContext,
} from "./context"
import { useNativeSubmenuTriggerState } from "./triggerState"

export type TNativeSubmenuTriggerProps = {
  children: [ReactElement, ReactElement]
  delay?: number
}
export const SubmenuTrigger = createNativeCollectionBranch<object, TNativeSubmenuTriggerProps, View>(
  "submenutrigger",
  (props, ref, node) => {
    const root = useContext(NativeRootMenuTriggerStateContext)
    const parent = useContext(NativeMenuStateContext)
    const actions = useContext(NativeMenuActionsContext)
    const inherited = useNativeSlottedContext(NativeMenuItemContext)
    const { CollectionBranch } = useContext(NativeCollectionRendererContext)
    if (!root || !parent || !actions) throw new Error("SubmenuTrigger requires a native Menu")
    const state = useNativeSubmenuTriggerState(node.key, root)
    const triggerRef = useRef<View>(null)
    const submenuRef = useRef<View>(null)
    const mergedRef = useNativeCollectionRefs(ref, triggerRef)
    const triggerID = useId(),
      menuID = useId()
    const inheritedDirection = useContext(NativeMenuDirectionContext)
    const direction = inheritedDirection ?? (I18nManager.isRTL ? "rtl" : "ltr")
    const current = useRef({ state, focusedKey: parent.selectionManager.focusedKey })
    useInsertionEffect(() => {
      current.current = { state, focusedKey: parent.selectionManager.focusedKey }
    })
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const hoverGeneration = useRef(0)
    const cancel = () => {
      hoverGeneration.current++
      if (timer.current !== null) clearTimeout(timer.current)
      timer.current = null
    }
    useLayoutEffect(() => cancel, [])
    const collection = parent.collection as TNativeCollectionSnapshot<object>
    const triggerNode = collection.getChildren(node.key)[Symbol.iterator]().next().value
    useLayoutEffect(() => {
      if (state.isOpen && parent.selectionManager.focusedKey !== triggerNode?.key) state.close()
    }, [parent.selectionManager.focusedKey, triggerNode?.key, state.isOpen])
    const hover = (hovered: boolean, requestOpen: (isCurrent: () => boolean) => void) => {
      cancel()
      if (hovered && !current.current.state.isOpen) {
        const generation = hoverGeneration.current
        const isCurrent = () =>
          hoverGeneration.current === generation && current.current.focusedKey === triggerNode?.key
        timer.current = setTimeout(() => {
          timer.current = null
          if (isCurrent()) requestOpen(isCurrent)
        }, props.delay ?? 200)
      }
    }
    return (
      <>
        <NativeSubmenuItemContext.Provider value={{ state, triggerID, direction, hover }}>
          <NativeMenuItemContext.Provider
            value={{
              ...inherited,
              ref: mergedRef,
            }}
          >
            <CollectionBranch collection={collection} parent={node} />
          </NativeMenuItemContext.Provider>
        </NativeSubmenuItemContext.Provider>
        <NativeMenuListContext.Provider
          value={{ ref: submenuRef, autoFocus: state.focusStrategy ?? undefined, onClose: state.closeAll }}
        >
          <NativeSubmenuContext.Provider
            value={{
              state,
              triggerRef,
              triggerID,
              menuID,
              direction,
              restoreRef: actions.virtualFocus ? actions.root : triggerRef,
            }}
          >
            {props.children[1]}
          </NativeSubmenuContext.Provider>
        </NativeMenuListContext.Provider>
      </>
    )
  },
  (props) => props.children[0],
)
