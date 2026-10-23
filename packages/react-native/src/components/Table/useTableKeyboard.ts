import { useCallback, useContext, useInsertionEffect, useRef, type RefObject } from "react"
import { findNodeHandle, I18nManager, Platform, type View } from "react-native"

import { NativeCollectionActionsContext } from "../../collection/actions"
import type { TNativeCollectionKey, TNativeCollectionNode, TNativeCollectionSnapshot } from "../../collection/snapshot"
import type { SelectionManager } from "../../collection/state/SelectionManager"
import { focusNativeTarget } from "../../input/focus"
import { useNativeKeyScope } from "../../input/NativeKeyboardScope"
import type { TNativeFocusEvent, TNativeKeyboardEvent } from "../../input/types"
import { NativeFloatingScopeContext, NativeFloatingWindowContext } from "../../overlays/floating/scope"
import { getNativeTagGroupNavigationSelection } from "../TagGroup/keyboard"

import { getNativeTableKeyTokens, getNativeTableNavigationKey, NATIVE_TABLE_NAVIGATION_KEYS } from "./keyboard"
import type { TNativeTableProps } from "./types"

type TTarget = { node: TNativeCollectionNode<object>; view: View }
type TOwner = {
  collection: TNativeCollectionSnapshot<object>
  rows: TNativeCollectionNode<object>[]
  manager: SelectionManager
  root: RefObject<View | null>
  props: Pick<TNativeTableProps, "disallowSelectAll" | "escapeKeyBehavior" | "shouldFocusWrap">
}
export const useTableKeyboard = (owner: TOwner) => {
  const actions = useContext(NativeCollectionActionsContext)!
  const scope = useNativeKeyScope()
  const floating = useContext(NativeFloatingScopeContext)
  const window = useContext(NativeFloatingWindowContext)
  const targets = useRef(new Map<TNativeCollectionKey, TTarget>())
  const live = useRef(false)
  const current = useRef({ ...owner, scope, floating, window })
  useInsertionEffect(() => {
    current.current = { ...owner, scope, floating, window }
  })
  useInsertionEffect(() => {
    live.current = true
    return () => {
      live.current = false
      targets.current.clear()
    }
  }, [])
  const eligible = () =>
    live.current &&
    current.current.scope?.isWindowActive() !== false &&
    current.current.floating?.canAct() !== false &&
    current.current.window?.() !== false
  const register = useCallback((node: TNativeCollectionNode<object>, view: View | null) => {
    if (view) targets.current.set(node.key, { node, view })
    else if (targets.current.get(node.key)?.node === node) targets.current.delete(node.key)
  }, [])
  const focus = (key: TNativeCollectionKey) => {
    const entry = targets.current.get(key)
    const tag = entry && findNodeHandle(entry.view)
    if (!eligible() || !entry || !tag) return
    actions.request(entry.node, tag, () => {
      if (eligible() && targets.current.get(key) === entry && current.current.manager.focusedKey === key)
        focusNativeTarget(entry.view)
    })
  }
  const observe = (key: TNativeCollectionKey, event: TNativeFocusEvent) => {
    const entry = targets.current.get(key)
    if (
      !eligible() ||
      !entry ||
      event.nativeEvent.target !== findNodeHandle(entry.view) ||
      !current.current.collection.getItem(key)
    )
      return
    current.current.manager.setFocused(true)
    current.current.manager.setFocusedKey(key)
  }
  const onFocus = (event: TNativeFocusEvent) => {
    const { root } = current.current
    const view = root.current,
      tag = view && findNodeHandle(view)
    if (!eligible() || !tag || event.nativeEvent.target !== tag) return
    actions.request(null, tag, () => {
      if (!eligible() || current.current.root.current !== view) return
      const owner = current.current
      const key =
        owner.manager.focusedKey ??
        owner.manager.firstSelectedKey ??
        getNativeTableNavigationKey(owner, null, "ArrowDown", I18nManager.isRTL)
      owner.manager.setFocused(true)
      if (key != null) {
        owner.manager.setFocusedKey(key)
        if (owner.manager.selectionBehavior === "replace" && !owner.manager.isSelected(key))
          owner.manager.replaceSelection(key)
        focus(key)
      }
    })
  }
  const onKeyDown = (event: TNativeKeyboardEvent) => {
    const data = event.nativeEvent
    if (!eligible() || data.phase !== "down" || data.cancelled || !data.nativeDefaultHandled || event.defaultPrevented)
      return
    const entry = [...targets.current.values()].find((candidate) => findNodeHandle(candidate.view) === data.target)
    const root = current.current.root.current
    if (!entry && data.target !== findNodeHandle(root)) return
    event.persist?.()
    actions.request(entry?.node ?? null, data.target, () => {
      if (
        !eligible() ||
        event.defaultPrevented ||
        (entry ? targets.current.get(entry.node.key) !== entry : current.current.root.current !== root)
      )
        return
      const owner = current.current,
        manager = owner.manager
      const modifier = Platform.OS === "ios" ? data.metaKey : data.ctrlKey
      if (data.key === "a" && modifier && manager.selectionMode === "multiple" && !owner.props.disallowSelectAll) {
        event.preventDefault()
        manager.selectAll()
      } else if (data.key === "Escape") {
        if (owner.props.escapeKeyBehavior !== "none" && !manager.disallowEmptySelection && manager.selectedKeys.size) {
          event.preventDefault()
          event.stopPropagation()
          manager.clearSelection()
        }
      } else if (NATIVE_TABLE_NAVIGATION_KEYS.includes(data.key as (typeof NATIVE_TABLE_NAVIGATION_KEYS)[number])) {
        const key = data.key as (typeof NATIVE_TABLE_NAVIGATION_KEYS)[number]
        if ((key === "Home" || key === "End") && manager.focusedKey == null && data.shiftKey) return
        const next = getNativeTableNavigationKey(
          owner,
          manager.focusedKey,
          key,
          I18nManager.isRTL,
          modifier,
          owner.props.shouldFocusWrap,
        )
        if (next == null) return
        event.preventDefault()
        manager.setFocusedKey(next)
        const operation = getNativeTagGroupNavigationSelection({
          key,
          mode: manager.selectionMode,
          behavior: manager.selectionBehavior,
          isLink: manager.isLink(next),
          isApple: Platform.OS === "ios",
          modifiers: data,
        })
        if (operation === "extend") manager.extendSelection(next)
        else if (operation === "replace") manager.replaceSelection(next)
        focus(next)
      }
    })
  }
  const keysFor = (from: TNativeCollectionKey | null) => {
    const isApple = Platform.OS === "ios"
    return getNativeTableKeyTokens(isApple).filter((token) => {
      const key = token.slice(5)
      if (key === "a") return owner.manager.selectionMode === "multiple" && !owner.props.disallowSelectAll
      if (key === "Escape")
        return (
          owner.props.escapeKeyBehavior !== "none" &&
          !owner.manager.disallowEmptySelection &&
          owner.manager.selectedKeys.size > 0
        )
      if (key === "Home" || key === "End") return from != null || token[0] !== "1"
      return (
        getNativeTableNavigationKey(
          owner,
          from,
          key as (typeof NATIVE_TABLE_NAVIGATION_KEYS)[number],
          I18nManager.isRTL,
          token[isApple ? 3 : 2] === "1",
          owner.props.shouldFocusWrap,
        ) != null
      )
    })
  }
  return { register, observe, onFocus, onKeyDown, keysFor }
}
