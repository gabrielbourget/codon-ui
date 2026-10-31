/* Copyright 2023 Adobe. Apache-2.0; see ../../collection/LICENSE.react-aria.md. */
import {
  useCallback,
  useContext,
  useId,
  useInsertionEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
} from "react"
import { findNodeHandle, I18nManager, type View } from "react-native"

import { NativeCollectionActionsContext } from "../../collection/actions"
import { createNativeCollectionBranch } from "../../collection/CollectionBuilder"
import { useNativeCollectionRefs, useNativeSlottedContext } from "../../collection/context"
import { NativeCollectionRendererContext } from "../../collection/renderer"
import type { TNativeCollectionSnapshot } from "../../collection/snapshot"
import { useNativeMenuPointerPolicy } from "../../input/NativeKeyboardScope"

import {
  NativeMenuItemContext,
  NativeMenuDirectionContext,
  NativeMenuActionsContext,
  NativeMenuSelectionManagerContext,
  NativeMenuPointerObservationContext,
  NativeMenuListContext,
  NativeMenuStateContext,
  NativeRootMenuTriggerStateContext,
  NativeSubmenuContext,
  NativeSubmenuItemContext,
  type TNativeSubmenuPointerRoot,
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
    const selectionManager = useContext(NativeMenuSelectionManagerContext)
    const actions = useContext(NativeMenuActionsContext)
    const collectionActions = useContext(NativeCollectionActionsContext)
    const observePointer = useContext(NativeMenuPointerObservationContext)
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
    const [pointerRoot, setPointerRoot] = useState<TNativeSubmenuPointerRoot | null>(null)
    const live = useRef(true)
    useLayoutEffect(() => {
      live.current = true
      return () => {
        live.current = false
      }
    }, [])
    const reportPointerRoot = useCallback((next: TNativeSubmenuPointerRoot | null) => {
      if (live.current)
        setPointerRoot((old) => (old?.target === next?.target && old?.binding === next?.binding ? old : next))
    }, [])
    const pointerGeneration = useRef(0)
    const parentTarget = findNodeHandle(actions.root.current) ?? 0
    const triggerTarget = findNodeHandle(triggerRef.current) ?? 0
    const parentBinding = collectionActions?.bindingFor(null) ?? ""
    const triggerBinding = triggerNode ? (collectionActions?.bindingFor(triggerNode) ?? "") : ""
    const disabled =
      !triggerNode ||
      (triggerNode.props.isDisabled ??
        inherited?.isDisabled ??
        (selectionManager ?? parent.selectionManager).isDisabled(triggerNode.key))
    const current = useRef({ state, focusedKey: parent.selectionManager.focusedKey, actions, disabled })
    useInsertionEffect(() => {
      current.current = { state, focusedKey: parent.selectionManager.focusedKey, actions, disabled }
    })
    const pointerCurrent = () => live.current && current.current.state.isOpen && !current.current.disabled
    useNativeMenuPointerPolicy({
      enabled: state.isOpen && !disabled,
      parentTarget,
      triggerTarget,
      submenuTarget: pointerRoot?.target ?? 0,
      parentBinding,
      triggerBinding,
      submenuBinding: pointerRoot?.binding ?? "",
      current: pointerCurrent,
      observe: (event) => {
        const generation = pointerGeneration.current
        observePointer?.(event)
        if (event.nativeEvent.phase !== "handoff" || pointerGeneration.current !== generation) return
        current.current.actions.pointerHandoff(
          event.nativeEvent.hitPath,
          () => pointerCurrent() && pointerGeneration.current === generation,
        )
      },
      retire: () => {
        pointerGeneration.current++
      },
    })
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
              reportPointerRoot,
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
