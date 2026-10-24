import { useCallback, useContext, useInsertionEffect, useLayoutEffect, useRef, useState, type RefObject } from "react"
import { findNodeHandle, I18nManager, Platform, type View } from "react-native"

import { NativeCollectionActionsContext } from "../../collection/actions"
import type { TNativeCollectionLayoutDelegate } from "../../collection/renderer"
import type { TNativeCollectionSessionSnapshot } from "../../collection/session"
import type { TNativeCollectionKey, TNativeCollectionNode, TNativeCollectionSnapshot } from "../../collection/snapshot"
import type { SelectionManager } from "../../collection/state/SelectionManager"
import {
  captureNativeFocusTarget,
  focusNativeTarget,
  getNativeFocusedTarget,
  subscribeNativeFocus,
} from "../../input/focus"
import type { TNativeObservedKeyboardEvent } from "../../input/keyboardObservation"
import { useNativeKeyScope } from "../../input/NativeKeyboardScope"
import type { TNativeFocusEvent, TNativeKeyboardEvent } from "../../input/types"
import { NativeFloatingScopeContext, NativeFloatingWindowContext } from "../../overlays/floating/scope"
import { getNativeTagGroupNavigationSelection } from "../TagGroup/keyboard"

import { getNativeTableCellFocusTargets, nativeTableCellContains, type TNativeTableFocusTarget } from "./cellFocus"
import { getNativeTableKeyTokens, getNativeTableNavigationKey, NATIVE_TABLE_NAVIGATION_KEYS } from "./keyboard"
import { getNativeTableSearchKey, nativeTableKeyCharacter } from "./typeahead"
import type { TNativeTableProps } from "./types"

type TTarget = { node: TNativeCollectionNode<object>; view: View }
type TOwner = {
  collection: TNativeCollectionSnapshot<object>
  rows: TNativeCollectionNode<object>[]
  manager: SelectionManager
  root: RefObject<View | null>
  props: Pick<TNativeTableProps, "disallowSelectAll" | "escapeKeyBehavior" | "shouldFocusWrap">
  rowHeaderColumns: ReadonlySet<string>
  layout?: TNativeCollectionLayoutDelegate
  receipt: TNativeCollectionSessionSnapshot<unknown>["receipt"]
  allowItemDescendantKeys?: boolean
  canAct?: () => boolean
}
type TNativeTableKeyboard = {
  register: (node: TNativeCollectionNode<object>, view: View | null) => void
  observe: (key: TNativeCollectionKey, event: TNativeFocusEvent) => void
  onFocus: (event: TNativeFocusEvent) => void
  onKeyDown: (event: TNativeKeyboardEvent, cellKey?: TNativeCollectionKey) => void
  keysFor: (from: TNativeCollectionKey | null) => string[]
  canAct: () => boolean
  requestedKey: TNativeCollectionKey | null
  observedKey: TNativeCollectionKey | null
  typeahead: (event: TNativeKeyboardEvent | TNativeObservedKeyboardEvent) => void
  captureTypeahead: (event: TNativeKeyboardEvent) => void
  hasSearch: boolean
  typeaheadEnabled: boolean
}
export const useNativeCollectionKeyboard = (owner: TOwner): TNativeTableKeyboard => {
  const actions = useContext(NativeCollectionActionsContext)!
  const scope = useNativeKeyScope()
  const floating = useContext(NativeFloatingScopeContext)
  const window = useContext(NativeFloatingWindowContext)
  const targets = useRef(new Map<TNativeCollectionKey, TTarget>())
  const [requestedKey, setRequestedKey] = useState<TNativeCollectionKey | null>(null)
  const [observedKey, setObservedKey] = useState<TNativeCollectionKey | null>(null)
  const [, refreshTargets] = useState(0)
  const [hasSearch, setHasSearch] = useState(false)
  const search = useRef({ value: "", timer: undefined as ReturnType<typeof setTimeout> | undefined, window: "" })
  const typedEvents = useRef(new WeakSet<object>())
  const pendingFocus = useRef<{
    key: TNativeCollectionKey
    node: TNativeCollectionNode<object>
    window: string
    input: ReturnType<NonNullable<typeof scope>["lastInput"]> | undefined
    child?: TNativeTableFocusTarget
    renderingRequested: boolean
    commanded?: View
  } | null>(null)
  const live = useRef(false)
  const current = useRef({ ...owner, scope, floating, window })
  useInsertionEffect(() => {
    current.current = { ...owner, scope, floating, window }
  })
  useInsertionEffect(() => {
    live.current = true
    return () => {
      live.current = false
      pendingFocus.current = null
      clearTimeout(search.current.timer)
      targets.current.clear()
    }
  }, [])
  const eligible = () =>
    live.current &&
    current.current.canAct?.() !== false &&
    current.current.scope?.isWindowActive() !== false &&
    current.current.floating?.canAct() !== false &&
    current.current.window?.() !== false
  const register = useCallback((node: TNativeCollectionNode<object>, view: View | null) => {
    if (view) {
      const previous = targets.current.get(node.key)
      targets.current.set(node.key, { node, view })
      const focused = getNativeFocusedTarget()
      if (
        eligible() &&
        current.current.collection.getItem(node.key) === node &&
        focused &&
        nativeTableCellContains(view, focused)
      ) {
        current.current.manager.setFocused(true)
        setObservedKey(node.key)
      }
      if (pendingFocus.current?.key === node.key && previous?.view !== view) refreshTargets((revision) => revision + 1)
    } else if (targets.current.get(node.key)?.node === node) targets.current.delete(node.key)
  }, [])
  const focusWindow = () => {
    const { receipt, scope } = current.current,
      lease = receipt.lease
    return JSON.stringify([
      lease?.rootRevision,
      lease?.target,
      lease?.surfaceId,
      lease?.windowId,
      lease?.epoch,
      scope?.acknowledgedSession(),
    ])
  }
  const cancelFocus = () => {
    pendingFocus.current = null
    if (live.current) setRequestedKey(null)
  }
  const attemptFocus = () => {
    const request = pendingFocus.current
    if (!request) return
    if (!eligible() || request.window !== focusWindow() || request.input !== current.current.scope?.lastInput()) {
      cancelFocus()
      return
    }
    if (current.current.receipt.status !== "confirmed") return
    if (current.current.scope?.isNativeReady() === false) return
    const { key, child } = request
    if (!actions.bindingFor(request.node) || current.current.manager.focusedKey !== key) {
      cancelFocus()
      return
    }
    const entry = targets.current.get(key)
    if (!entry) {
      if (!request.renderingRequested) {
        request.renderingRequested = true
        try {
          current.current.layout?.requestRendering?.(key)
          const scrolled = current.current.layout?.scrollToKey?.(key)
          if (scrolled && "then" in scrolled)
            void scrolled.then(
              () => {
                if (pendingFocus.current === request) attemptFocus()
              },
              () => {
                if (pendingFocus.current === request) cancelFocus()
              },
            )
        } catch (error) {
          if (pendingFocus.current === request) cancelFocus()
          throw error
        }
      }
      return
    }
    if (request.commanded === entry.view) return
    const currentFocus = getNativeFocusedTarget()
    const children = entry && entry.node.type !== "item" ? getNativeTableCellFocusTargets(entry.view) : []
    const destination =
      child ??
      (currentFocus && children.includes(currentFocus)
        ? currentFocus
        : children[current.current.manager.childFocusStrategy === "last" ? children.length - 1 : 0]) ??
      entry?.view
    const retained = destination && captureNativeFocusTarget(destination)
    const tag = entry && findNodeHandle(entry.view)
    if (!eligible() || !tag) return
    request.commanded = entry.view
    actions.request(
      request.node,
      tag,
      () => {
        if (
          pendingFocus.current === request &&
          eligible() &&
          targets.current.get(key) === entry &&
          current.current.manager.focusedKey === key &&
          destination &&
          retained?.() &&
          nativeTableCellContains(entry.view, destination)
        )
          focusNativeTarget(destination)
        else if (pendingFocus.current === request) cancelFocus()
      },
      (outcome) => {
        if (outcome !== "accepted" && pendingFocus.current === request) cancelFocus()
      },
    )
  }
  const focus = (key: TNativeCollectionKey, child?: TNativeTableFocusTarget) => {
    const node = current.current.collection.getItem(key)
    if (!eligible() || !node) return
    pendingFocus.current = {
      key,
      node,
      child,
      window: focusWindow(),
      input: current.current.scope?.lastInput(),
      renderingRequested: false,
    }
    setRequestedKey(key)
    attemptFocus()
  }
  const clearSearch = () => {
    clearTimeout(search.current.timer)
    search.current.value = ""
    if (live.current) setHasSearch(false)
  }
  const typeahead = (event: TNativeKeyboardEvent | TNativeObservedKeyboardEvent) => {
    const data = event.nativeEvent
    if (
      typedEvents.current.has(event) ||
      !eligible() ||
      current.current.receipt.status !== "confirmed" ||
      data.cancelled ||
      ("phase" in data && data.phase !== "down") ||
      ("isComposing" in data && data.isComposing) ||
      data.ctrlKey ||
      data.metaKey
    )
      return
    const character = nativeTableKeyCharacter(data.key)
    if (!character || (!search.current.value.length && character === " ")) return
    const target = "focusedTarget" in data ? data.focusedTarget : data.target
    const original = [...targets.current.values()].some(
      (entry) =>
        findNodeHandle(entry.view) === target ||
        getNativeTableCellFocusTargets(entry.view).some((child) => findNodeHandle(child) === target),
    )
    if (!original && target !== findNodeHandle(current.current.root.current)) return
    if (search.current.window !== focusWindow()) clearSearch()
    search.current.window = focusWindow()
    if (!search.current.value.length && character === " ") return
    typedEvents.current.add(event)
    if (character === " " && search.current.value.trim().length) {
      event.preventDefault()
      event.stopPropagation()
    }
    search.current.value += character
    setHasSearch(!!search.current.value.trim())
    clearTimeout(search.current.timer)
    search.current.timer = setTimeout(clearSearch, 1000)
    const query = search.current.value,
      window = search.current.window
    event.persist?.()
    const view = current.current.root.current,
      tag = view && findNodeHandle(view)
    if (!tag) return
    actions.request(null, tag, () => {
      if (!eligible() || current.current.root.current !== view || window !== focusWindow()) return
      const owner = current.current
      const key =
        getNativeTableSearchKey(owner, query, owner.manager.focusedKey) ?? getNativeTableSearchKey(owner, query)
      if (key != null) {
        owner.manager.setFocusedKey(key)
        focus(key)
      }
    })
  }
  const captureTypeahead = (event: TNativeKeyboardEvent) => {
    if (event.nativeEvent.key === " ") typeahead(event)
  }
  useLayoutEffect(() => {
    attemptFocus()
  })
  useLayoutEffect(
    () =>
      current.current.scope?.subscribe(() => {
        if (
          pendingFocus.current &&
          (!eligible() ||
            pendingFocus.current.input !== current.current.scope?.lastInput() ||
            pendingFocus.current.window !== focusWindow())
        )
          cancelFocus()
        else if (pendingFocus.current) attemptFocus()
        if (!eligible() || (search.current.window && search.current.window !== focusWindow())) clearSearch()
      }),
    [scope],
  )
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
    setObservedKey(key)
    if (pendingFocus.current?.key === key) cancelFocus()
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
  useLayoutEffect(
    () =>
      subscribeNativeFocus(() => {
        if (!eligible()) return
        const focused = getNativeFocusedTarget()
        const entry =
          focused && [...targets.current.values()].find((candidate) => nativeTableCellContains(candidate.view, focused))
        if (!entry) {
          setObservedKey(null)
          if (focused !== current.current.root.current) current.current.manager.setFocused(false)
          return
        }
        current.current.manager.setFocused(true)
        setObservedKey(entry.node.key)
        if (pendingFocus.current?.key === entry.node.key) cancelFocus()
        if (current.current.scope?.lastInput()?.origin !== "keyboard")
          current.current.manager.setFocusedKey(entry.node.key)
      }),
    [],
  )
  const onKeyDown = (event: TNativeKeyboardEvent, cellKey?: TNativeCollectionKey) => {
    if (!current.current.scope) typeahead(event)
    const data = event.nativeEvent
    if (!eligible() || data.phase !== "down" || data.cancelled || !data.nativeDefaultHandled || event.defaultPrevented)
      return
    const focusedTag =
      cellKey != null && "focusedTarget" in data && typeof data.focusedTarget === "number"
        ? data.focusedTarget
        : data.target
    const entry =
      cellKey != null
        ? targets.current.get(cellKey)
        : [...targets.current.values()].find((candidate) => findNodeHandle(candidate.view) === data.target)
    const children =
      entry && (entry.node.type !== "item" || current.current.allowItemDescendantKeys)
        ? getNativeTableCellFocusTargets(entry.view)
        : []
    const active =
      entry &&
      (findNodeHandle(entry.view) === focusedTag
        ? entry.view
        : children.find((child) => findNodeHandle(child) === focusedTag))
    const root = current.current.root.current
    if (entry ? !active : data.target !== findNodeHandle(root)) return
    event.persist?.()
    actions.request(entry?.node ?? null, entry ? findNodeHandle(entry.view)! : data.target, () => {
      if (
        !eligible() ||
        event.defaultPrevented ||
        (entry ? targets.current.get(entry.node.key) !== entry : current.current.root.current !== root)
      )
        return
      const owner = current.current,
        manager = owner.manager
      if (entry && active && entry.node.type !== "item" && (data.key === "ArrowLeft" || data.key === "ArrowRight")) {
        if (!nativeTableCellContains(entry.view, active)) return
        const children = getNativeTableCellFocusTargets(entry.view)
        const index = children.indexOf(active)
        const next = children[index + ((data.key === "ArrowRight") !== I18nManager.isRTL ? 1 : -1)]
        if (next) {
          event.preventDefault()
          event.stopPropagation()
          manager.setFocusedKey(entry.node.key)
          focus(entry.node.key, next)
          return
        }
      }
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
          cellKey ?? manager.focusedKey,
          key,
          I18nManager.isRTL,
          modifier,
          owner.props.shouldFocusWrap,
        )
        if (next == null) return
        event.preventDefault()
        manager.setFocusedKey(
          next,
          key === "ArrowLeft"
            ? I18nManager.isRTL
              ? "first"
              : "last"
            : key === "ArrowRight"
              ? I18nManager.isRTL
                ? "last"
                : "first"
              : undefined,
        )
        const operation = getNativeTagGroupNavigationSelection({
          key,
          mode: manager.selectionMode,
          behavior: manager.selectionBehavior,
          isLink: manager.isLink(next),
          linkBehavior: "action",
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
  return {
    register,
    observe,
    onFocus,
    onKeyDown,
    keysFor,
    canAct: eligible,
    requestedKey,
    observedKey,
    typeahead,
    captureTypeahead,
    hasSearch,
    // Pinned RAC TableInner removes disallowTypeAhead before calling useTable.
    typeaheadEnabled: true,
  }
}
export const useTableKeyboard = useNativeCollectionKeyboard
