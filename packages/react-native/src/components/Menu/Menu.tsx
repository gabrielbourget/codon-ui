import {
  forwardRef,
  useCallback,
  useContext,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
  type Ref,
} from "react"
import {
  findNodeHandle,
  I18nManager,
  Linking,
  ScrollView,
  type View,
  type TextStyle,
  type StyleProp,
} from "react-native"

import { NativeCollectionActionsContext } from "../../collection/actions"
import { NativeCollectionItemBindingContext } from "../../collection/binding"
import { NativeCollection, NativeCollectionBuilder } from "../../collection/CollectionBuilder"
import { NativeSelectableCollectionContext, useNativeContextProps } from "../../collection/context"
import {
  NativeCollectionRendererContext,
  useNativePersistedKeys,
  type TNativeCollectionScrollHost,
} from "../../collection/renderer"
import type { TNativeCollectionSessionSnapshot } from "../../collection/session"
import type { TNativeCollectionNode, TNativeCollectionSnapshot } from "../../collection/snapshot"
import { useTreeState } from "../../collection/state"
import { nativeAccessibilityIDs } from "../../input/accessibilityReferences"
import { focusNativeTarget } from "../../input/focus"
import { nativeKeyTokens } from "../../input/keyScope"
import { NativeFocusHost } from "../../input/NativeFocusView"
import { useNativeKeyPolicy, useNativeKeyScope } from "../../input/NativeKeyboardScope"
import type { TNativeKeyboardEvent, TNativePressEvent } from "../../input/types"
import { useNativeDialogTrigger } from "../../overlays/floating/NativeDialogTrigger"
import { NativeFloatingScopeContext, NativeFloatingWindowContext } from "../../overlays/floating/scope"
import { useNativeTheme } from "../../theme"
import { getNativeButtonContent } from "../Button/content"
import { NativeFloatingSurface } from "../ClickPopover/ClickPopover"
import { resolveNativeStyle } from "../colors"
import { NativeContentContext } from "../NativeContentContext"
import { splitNativeTextStyle } from "../nativeTextStyle"

import {
  NativeMenuActionsContext,
  NativeMenuContext,
  NativeMenuDirectionContext,
  NativeMenuItemContext,
  NativeMenuListContext,
  NativeMenuSelectionManagerContext,
  NativeMenuStateContext,
  NativeMenuTriggerNamingContext,
  NativeRootMenuTriggerStateContext,
  NativeSubmenuContext,
  type TNativeMenuRegistration,
} from "./context"
import {
  getNativeMenuRecoveryKey,
  normalizeNativeMenuKeys,
  NATIVE_MENU_SELECTION_MODES,
  type TNativeMenuKey,
  type TNativeMenuRow,
} from "./model"
import { useNativeMenuFocusStrategy } from "./NativeMenuTrigger"
import { getNativeMenuStyles } from "./styles"
import { useNativeMenuTriggerState } from "./triggerState"
import type { TNativeMenuListProps, TNativeMenuProps, TNativeMenuRef } from "./types"

const keyTokens = ["ArrowDown", "ArrowUp", "Home", "End", "PageDown", "PageUp"]
  .flatMap((key) => nativeKeyTokens(key).filter((token) => token.startsWith("0000:") || token.startsWith("1000:")))
  .concat(nativeKeyTokens("a").filter((token) => token.startsWith("0010:") || token.startsWith("0001:")))

export const Menu = forwardRef<TNativeMenuRef, TNativeMenuProps>((authoredProps, forwardedRef) => {
  const [props, ref] = useNativeContextProps(authoredProps, forwardedRef, NativeMenuContext)
  const {
    slot: _slot,
    menuListSlot,
    children,
    menuAriaLabel,
    selectionMode,
    selectedKeys,
    onSelectionChange,
    disabledKeys,
    onAction,
    shouldCloseOnSelect,
    customMenuStyles,
    isOpen,
    defaultOpen,
    onOpenChange,
    customStyles,
    style,
    ...surface
  } = props
  const trigger = useNativeDialogTrigger()
  const submenu = useContext(NativeSubmenuContext)
  const inheritedDirection = useContext(NativeMenuDirectionContext)
  const direction = props.direction ?? submenu?.direction ?? inheritedDirection ?? (I18nManager.isRTL ? "rtl" : "ltr")
  const inheritedRootState = useContext(NativeRootMenuTriggerStateContext)
  const contextOwned = isOpen === undefined && defaultOpen === undefined && trigger !== null
  const [local, setLocal] = useState(defaultOpen ?? false)
  const submenuOwned = submenu !== null && isOpen === undefined && defaultOpen === undefined
  const open = submenuOwned ? submenu.state.isOpen : contextOwned ? trigger!.isOpen : (isOpen ?? local)
  const current = useRef({ open, contextOwned, trigger, isOpen, onOpenChange, submenuOwned, submenu })
  useInsertionEffect(() => {
    current.current = { open, contextOwned, trigger, isOpen, onOpenChange, submenuOwned, submenu }
  })
  const request = useCallback((next: boolean) => {
    const owner = current.current
    if (owner.open === next) return
    if (owner.submenuOwned) {
      if (next) owner.submenu!.state.open()
      else owner.submenu!.state.close()
    } else if (owner.contextOwned) owner.trigger!.request(next)
    else {
      if (owner.isOpen === undefined) setLocal(next)
      owner.onOpenChange?.(next)
    }
  }, [])
  const localRootState = useNativeMenuTriggerState({ isOpen: open, onOpenChange: request })
  const rootState = ((contextOwned || submenu) && inheritedRootState) || localRootState
  const theme = useNativeTheme()
  const styles = getNativeMenuStyles(theme, { ...props, customMenuStyles: undefined })
  const list = useRef<View>(null)
  const [listDefaults, defaultsRef] = useNativeContextProps<TNativeMenuListProps, View, Partial<TNativeMenuListProps>>(
    {
      children,
      slot: menuListSlot,
      selectionMode,
      selectedKeys,
      onSelectionChange,
      disabledKeys,
      onAction,
      shouldCloseOnSelect,
      accessibilityLabel: menuAriaLabel,
      style: customMenuStyles,
    },
    list,
    NativeMenuListContext,
  )
  const [listProps, listRef] = useNativeContextProps(listDefaults, defaultsRef, NativeSelectableCollectionContext)
  const initialTarget = useRef<View>(null)
  return (
    <NativeRootMenuTriggerStateContext.Provider value={rootState}>
      <NativeMenuDirectionContext.Provider value={direction}>
        <NativeFloatingSurface
          {...surface}
          ref={ref}
          testID={props.testID ?? props["data-testid"] ?? "menu"}
          isOpen={open}
          onOpenChange={request}
          childIsDialog={false}
          nativeRootRole={null}
          showOverlayArrow={false}
          triggerRef={props.triggerRef ?? submenu?.triggerRef}
          trigger={props.trigger ?? (submenu ? "SubmenuTrigger" : undefined)}
          placement={props.placement ?? (submenu ? "end top" : undefined)}
          direction={direction}
          isNonModal={props.isNonModal ?? !!submenu}
          initialFocusRef={
            props.initialFocusRef ??
            (listProps.shouldUseVirtualFocus
              ? list
              : submenu && submenu.state.focusStrategy === null
                ? undefined
                : initialTarget)
          }
          restoreFocusRef={props.restoreFocusRef ?? submenu?.restoreRef}
          style={styles.root}
        >
          <NativeSubmenuContext.Provider value={null}>
            <NativeCollectionBuilder<object>
              content={
                <NativeCollection
                  items={listProps.items}
                  dependencies={listProps.dependencies}
                  idScope={listProps.idScope}
                >
                  {listProps.children}
                </NativeCollection>
              }
            >
              {(collection, receipt) => (
                <NativeMenuList
                  collection={collection}
                  receipt={receipt}
                  {...{
                    props,
                    menuAriaLabel: listProps.accessibilityLabel ?? listProps["aria-label"],
                    selectionMode: listProps.selectionMode ?? "none",
                    selectedKeys: listProps.selectedKeys,
                    onSelectionChange: listProps.onSelectionChange,
                    disabledKeys: listProps.disabledKeys,
                    onAction: listProps.onAction,
                    shouldCloseOnSelect: listProps.shouldCloseOnSelect ?? true,
                    styles,
                  }}
                  listProps={listProps}
                  listRef={listRef}
                  root={list}
                  initialTarget={initialTarget}
                  submenu={submenu}
                  close={listProps.onClose ?? (() => rootState.close())}
                />
              )}
            </NativeCollectionBuilder>
          </NativeSubmenuContext.Provider>
        </NativeFloatingSurface>
      </NativeMenuDirectionContext.Provider>
    </NativeRootMenuTriggerStateContext.Provider>
  )
})
Menu.displayName = "Menu"

type TListProps = Pick<
  TNativeMenuProps,
  "children" | "menuAriaLabel" | "selectedKeys" | "onSelectionChange" | "disabledKeys" | "onAction"
> & {
  props: TNativeMenuProps
  listProps: TNativeMenuListProps
  listRef: Ref<View>
  selectionMode: NonNullable<TNativeMenuProps["selectionMode"]>
  shouldCloseOnSelect: boolean
  styles: ReturnType<typeof getNativeMenuStyles>
  collection: TNativeCollectionSnapshot<object>
  receipt: TNativeCollectionSessionSnapshot<unknown>["receipt"]
  root: RefObject<View | null>
  initialTarget: RefObject<View | null>
  close: () => void
  submenu: React.ContextType<typeof NativeSubmenuContext>
}
const NativeMenuList = (props: TListProps) => {
  const theme = useNativeTheme()
  const triggerLabelledBy = useContext(NativeMenuTriggerNamingContext)
  const direction = useContext(NativeMenuDirectionContext) ?? (I18nManager.isRTL ? "rtl" : "ltr")
  const rootStrategy = useNativeMenuFocusStrategy()
  const autoFocus = props.listProps.autoFocus
  const strategy =
    autoFocus === false
      ? null
      : autoFocus === true
        ? "first"
        : (autoFocus ?? (props.submenu ? props.submenu.state.focusStrategy : rootStrategy))
  const [rows, setRows] = useState(new Map<TNativeMenuKey, TNativeMenuRegistration>())
  const [targetTag, setTargetTag] = useState(0)
  const [focusVisible, setFocusVisible] = useState(false)
  const live = useRef(false),
    scroll = useRef<ScrollView>(null)
  const frames = useRef(new Map<TNativeMenuKey, { y: number; height: number }>())
  const recoveryOrder = useRef<readonly TNativeMenuKey[]>([])
  const observedFocusKey = useRef<TNativeMenuKey | null>(null)
  const viewport = useRef(0),
    offset = useRef(0),
    search = useRef({ value: "", time: 0 })
  const scope = useContext(NativeFloatingScopeContext),
    window = useContext(NativeFloatingWindowContext),
    input = useNativeKeyScope()
  const selectedKeys = useMemo(() => {
    if (props.selectedKeys === undefined || props.selectedKeys === "all") return props.selectedKeys
    const keys = normalizeNativeMenuKeys(props.selectedKeys)
    return props.selectedKeys instanceof Set ? props.selectedKeys : keys
  }, [props.selectedKeys])
  const disabledKeys = useMemo(() => normalizeNativeMenuKeys(props.disabledKeys ?? []), [props.disabledKeys])
  const collection = useMemo(
    () =>
      props.listProps.filter
        ? props.collection.filter((text, node) => props.listProps.filter!(text, node as TNativeCollectionNode<object>))
        : props.collection,
    [props.collection, props.listProps.filter],
  )
  const renderer = useContext(NativeCollectionRendererContext)
  const CollectionRoot = renderer.CollectionRoot
  const actions = useContext(NativeCollectionActionsContext)
  const pointerBinding = actions?.bindingFor(null) ?? ""
  const reportPointerRoot = props.submenu?.reportPointerRoot
  useLayoutEffect(() => {
    if (!reportPointerRoot) return
    reportPointerRoot(targetTag && pointerBinding ? { target: targetTag, binding: pointerBinding } : null)
    return () => reportPointerRoot(null)
  }, [reportPointerRoot, targetTag, pointerBinding])
  const state = useTreeState({
    ...props.listProps,
    children: undefined,
    collection,
    selectionMode: props.selectionMode,
    selectedKeys,
    disabledKeys,
    onSelectionChange: props.onSelectionChange,
  })
  const manager = state.selectionManager
  if (!NATIVE_MENU_SELECTION_MODES.includes(manager.selectionMode))
    throw new TypeError("Menu: unsupported selectionMode")
  const defaultListStyle = { ...props.styles.list.view, ...props.styles.list.text }
  const authoredListStyle =
    typeof props.listProps.style === "function"
      ? props.listProps.style({ isEmpty: collection.size === 0, defaultStyle: defaultListStyle })
      : props.listProps.style
  const listStyles = splitNativeTextStyle(resolveNativeStyle([defaultListStyle, authoredListStyle], "Menu", "list"))
  const normalized = manager.rawSelection
  const active = manager.focusedKey
  const [requestedFocusKey, setRequestedFocusKey] = useState<TNativeMenuKey | null>(null)
  const persistedKeys = useNativePersistedKeys(active, requestedFocusKey, observedFocusKey.current)
  const rendererScroll = useRef<TNativeCollectionScrollHost | null>(null)
  const pendingFocus = useRef<{
    key: TNativeMenuKey
    node: NonNullable<ReturnType<TNativeCollectionSnapshot<object>["getItem"]>>
    window: string
    commandedTarget: View | null
    commandedLease: TListProps["receipt"]["lease"]
  } | null>(null)
  const setActive = (key: TNativeMenuKey | null) => manager.setFocusedKey(key)
  const logicalMembers = []
  let logicalKey = collection.getFirstKey()
  while (logicalKey !== null) {
    const node = collection.getItem(logicalKey)!
    if (node.type === "item") logicalMembers.push(node)
    logicalKey = collection.getKeyAfter(logicalKey)
  }
  const ordered = logicalMembers.flatMap((node) => {
    const row = rows.get(node.key)
    return row ? [row] : []
  })
  const disabled = (row: TNativeMenuRegistration) => row.props().isDisabled ?? row.selectionManager().isDisabled(row.id)
  const model = logicalMembers.map(
    (node): TNativeMenuRow => ({
      id: node.key,
      text: node.textValue,
      disabled: node.props.isDisabled ?? manager.isDisabled(node.key),
      selectionDisabled: disabledKeys.has(node.key),
      href: node.props.href,
    }),
  )
  const current = useRef({
    props,
    rows,
    ordered,
    model,
    disabled,
    normalized,
    active,
    scope,
    window,
    input,
    collection,
    receipt: props.receipt,
    manager,
    renderer,
  })
  useInsertionEffect(() => {
    current.current = {
      props,
      rows,
      ordered,
      model,
      disabled,
      normalized,
      active,
      scope,
      window,
      input,
      collection,
      receipt: props.receipt,
      manager,
      renderer,
    }
    if (observedFocusKey.current === null || model.some((row) => row.id === observedFocusKey.current))
      recoveryOrder.current = model.map((row) => row.id)
  })
  useInsertionEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])
  const register = useCallback((row: TNativeMenuRegistration) => {
    setRows((old) => {
      const existing = old.get(row.id)
      if (existing && existing !== row) throw new TypeError("Menu: duplicate item key")
      const next = new Map(old)
      next.set(row.id, row)
      return next
    })
    return () => {
      if (live.current)
        setRows((old) => {
          if (old.get(row.id) !== row) return old
          const next = new Map(old)
          next.delete(row.id)
          return next
        })
    }
  }, [])
  const refresh = useCallback((row: TNativeMenuRegistration) => {
    if (live.current) setRows((old) => (old.get(row.id) === row ? new Map(old) : old))
  }, [])
  const admitted = (row?: TNativeMenuRegistration) =>
    live.current &&
    current.current.receipt.status === "confirmed" &&
    current.current.scope?.canAct() !== false &&
    current.current.window?.() !== false &&
    current.current.input?.isWindowActive() !== false &&
    (!row ||
      (current.current.collection.getItem(row.id) !== null &&
        row.view.current !== null &&
        current.current.rows.get(row.id) === row &&
        !current.current.disabled(row)))
  const reveal = (row: TNativeMenuRegistration) => {
    const frame = frames.current.get(row.id)
    if (!frame || viewport.current <= 0) return
    const next =
      frame.y < offset.current
        ? frame.y
        : frame.y + frame.height > offset.current + viewport.current
          ? frame.y + frame.height - viewport.current
          : offset.current
    if (next !== offset.current) scroll.current?.scrollTo({ y: Math.max(0, next), animated: false })
  }
  const focus = (row: TNativeMenuRegistration) => {
    if (!admitted(row)) return false
    observedFocusKey.current = row.id
    manager.setFocused(true)
    if (!pendingFocus.current || pendingFocus.current.key === row.id) {
      pendingFocus.current = null
      setRequestedFocusKey(null)
      setActive(row.id)
    }
    reveal(row)
    return true
  }
  const focusWindowStamp = () =>
    JSON.stringify([
      current.current.receipt.lease?.rootRevision,
      current.current.receipt.lease?.target,
      current.current.receipt.lease?.windowId,
      current.current.receipt.lease?.epoch,
      current.current.input?.acknowledgedSession()?.windowId,
      current.current.input?.acknowledgedSession()?.epoch,
    ])
  const cancelFocusRequest = () => {
    pendingFocus.current = null
    if (live.current) setRequestedFocusKey(null)
  }
  const attemptFocus = () => {
    const pending = pendingFocus.current
    if (!pending || !admitted() || current.current.input?.isNativeReady() === false) return
    if (pending.window !== focusWindowStamp() || !actions?.bindingFor(pending.node)) {
      cancelFocusRequest()
      return
    }
    if (pending.commandedLease !== current.current.receipt.lease) pending.commandedTarget = null
    const row = current.current.rows.get(pending.key),
      host = row?.view.current
    if (!row || !host || host === pending.commandedTarget) return
    if (
      withNativeAdmission(row, () => {
        if (pendingFocus.current === pending) {
          reveal(row)
          focusNativeTarget(host)
        }
      })
    ) {
      pending.commandedTarget = host
      pending.commandedLease = current.current.receipt.lease
    }
  }
  const requestFocus = (key: TNativeMenuKey) => {
    const node = current.current.collection.getItem(key)
    if (!node || !admitted()) return
    const virtual = current.current.props.listProps.shouldUseVirtualFocus
    pendingFocus.current = virtual
      ? null
      : { key, node, window: focusWindowStamp(), commandedTarget: null, commandedLease: null }
    current.current.manager.setFocusedKey(key)
    setRequestedFocusKey(virtual ? null : key)
    current.current.renderer.layoutDelegate?.requestRendering?.(key)
    void current.current.renderer.layoutDelegate?.scrollToKey?.(key)
    if (!virtual) attemptFocus()
  }
  useLayoutEffect(attemptFocus)
  useLayoutEffect(
    () =>
      input?.subscribe(() => {
        if (current.current.input?.isWindowActive() === false) cancelFocusRequest()
        else attemptFocus()
      }),
    [input, actions],
  )
  const lifetime = JSON.stringify(model.map((row) => [row.id, row.text, row.disabled, row.href]))
  useLayoutEffect(() => {
    const registered = current.current.model.filter((row) => !row.disabled)
    const initial = strategy === "last" ? registered[registered.length - 1] : registered[0]
    props.initialTarget.current = props.listProps.shouldUseVirtualFocus
      ? props.root.current
      : ((initial && current.current.rows.get(initial.id)?.view.current) ?? props.root.current)
    const frame = requestAnimationFrame(() => {
      if (!admitted() || current.current.input?.isNativeReady() === false) return
      if (current.current.props.props.initialFocusRef !== undefined && current.current.active === null) return
      if (strategy === null && current.current.active === null) return
      const available = current.current.model.filter((row) => !row.disabled)
      const recovered = getNativeMenuRecoveryKey(
        recoveryOrder.current,
        current.current.model,
        observedFocusKey.current ?? current.current.active,
      )
      const target =
        available.find((row) => row.id === current.current.active) ??
        available.find((row) => row.id === recovered) ??
        (strategy === "last" ? available[available.length - 1] : available[0])
      if (target && !available.some((row) => row.id === current.current.active)) {
        requestFocus(target.id)
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [lifetime, scope, strategy, props.initialTarget, props.root])
  const activateAdmitted = (row: TNativeMenuRegistration, event: TNativePressEvent) => {
    if (!admitted(row) || event.defaultPrevented || event.isDefaultPrevented?.()) return
    const submenu = row.submenu()
    if (submenu) {
      submenu.open("kind" in event.nativeEvent && event.nativeEvent.kind === "keyboard" ? "first" : undefined)
      return
    }
    const selectionManager = row.selectionManager()
    if (!selectionManager.isLink(row.id)) {
      if (
        "kind" in event.nativeEvent &&
        event.nativeEvent.kind === "keyboard" &&
        event.nativeEvent.shiftKey &&
        selectionManager.selectionMode === "multiple"
      )
        selectionManager.extendSelection(row.id)
      else selectionManager.select(row.id)
    }
    if (!admitted(row)) return
    row.props().onAction?.()
    if (!admitted(row)) return
    current.current.props.onAction?.(row.id)
    if (!admitted(row)) return
    const item = row.props(),
      href = item.href
    if (href) {
      if (item.onNavigate) item.onNavigate(href)
      else {
        let result: Promise<unknown>
        try {
          result = Linking.openURL(href)
        } catch (error) {
          result = Promise.reject(error)
        }
        void result.catch((error: unknown) => {
          if (admitted(row) && row.props().href === href) row.props().onNavigationError?.(error, href)
        })
      }
    }
    if (admitted(row) && (row.props().shouldCloseOnSelect ?? current.current.props.shouldCloseOnSelect))
      current.current.props.close()
  }
  const withNativeAdmission = (row: TNativeMenuRegistration, operation: () => void) => {
    const host = row.view.current,
      target = host && findNodeHandle(host)
    if (!admitted(row) || !host || !target) return false
    return (
      actions?.request(row.node, target, () => {
        if (admitted(row) && row.view.current === host) operation()
      }) ?? false
    )
  }
  const activate = (row: TNativeMenuRegistration, event: TNativePressEvent) => {
    event.persist?.()
    withNativeAdmission(row, () => activateAdmitted(row, event))
  }
  const moveAdmitted = (event: TNativeKeyboardEvent) => {
    const data = event.nativeEvent
    if (
      current.current.props.listProps.shouldUseVirtualFocus &&
      admitted() &&
      data.phase === "down" &&
      !data.cancelled &&
      !data.repeat &&
      data.nativeDefaultHandled &&
      data.key === (direction === "rtl" ? "ArrowLeft" : "ArrowRight")
    ) {
      const row = current.current.active === null ? null : current.current.rows.get(current.current.active)
      if (row?.submenu()) {
        withNativeAdmission(row, () => row.submenu()?.open("first"))
        event.preventDefault()
      }
      return
    }
    if (
      current.current.props.listProps.shouldUseVirtualFocus &&
      admitted() &&
      data.phase === "down" &&
      !data.cancelled &&
      !data.repeat &&
      data.nativeDefaultHandled &&
      (data.key === "Enter" || data.key === " ")
    ) {
      const row = current.current.active === null ? null : current.current.rows.get(current.current.active)
      if (row) activate(row, event)
      return
    }
    const submenu = current.current.props.submenu
    if (
      submenu &&
      admitted() &&
      data.phase === "down" &&
      !data.cancelled &&
      data.nativeDefaultHandled &&
      data.key === (submenu.direction === "rtl" ? "ArrowRight" : "ArrowLeft")
    ) {
      event.preventDefault()
      event.stopPropagation?.()
      submenu.state.close()
      return
    }
    if (
      admitted() &&
      data.phase === "down" &&
      !data.cancelled &&
      !data.repeat &&
      data.nativeDefaultHandled &&
      !data.altKey &&
      (data.ctrlKey || data.metaKey) &&
      data.key.toLocaleLowerCase() === "a" &&
      current.current.props.selectionMode === "multiple"
    ) {
      current.current.manager.selectAll()
      return
    }
    if (
      !admitted() ||
      data.phase !== "down" ||
      data.cancelled ||
      !data.nativeDefaultHandled ||
      data.altKey ||
      data.ctrlKey ||
      data.metaKey
    )
      return
    const available = current.current.model.filter((row) => !row.disabled)
    const tag = "focusedTarget" in data && typeof data.focusedTarget === "number" ? data.focusedTarget : data.target
    const focusedRow = current.current.ordered.find((row) => findNodeHandle(row.view.current) === tag)
    const navigationKey = current.current.props.listProps.shouldUseVirtualFocus
      ? current.current.active
      : (pendingFocus.current?.key ?? focusedRow?.id)
    const index = available.findIndex((row) => row.id === navigationKey)
    if (index < 0 || !available.length) return
    let next = index
    if (data.key === "Home") next = 0
    else if (data.key === "End") next = available.length - 1
    else if (data.key === "ArrowDown")
      next =
        current.current.props.listProps.shouldFocusWrap === false
          ? Math.min(index + 1, available.length - 1)
          : (index + 1) % available.length
    else if (data.key === "ArrowUp")
      next =
        current.current.props.listProps.shouldFocusWrap === false
          ? Math.max(index - 1, 0)
          : (index - 1 + available.length) % available.length
    else {
      const frameFor = (key: TNativeMenuKey) =>
        current.current.renderer.layoutDelegate?.getItemRect(key) ?? frames.current.get(key)
      const frame = frameFor(available[index].id)
      const visibleHeight = current.current.renderer.layoutDelegate?.getVisibleRect().height ?? viewport.current
      if (!frame || !visibleHeight) return
      const destination =
        data.key === "PageDown"
          ? frame.y - frame.height + visibleHeight
          : Math.max(0, frame.y + frame.height - visibleHeight)
      if (data.key === "PageDown")
        while (next < available.length - 1 && (frameFor(available[next].id)?.y ?? Infinity) < destination) next++
      else if (data.key === "PageUp")
        while (next > 0 && (frameFor(available[next].id)?.y ?? -Infinity) > destination) next--
      else return
    }
    requestFocus(available[next].id)
    if (data.shiftKey && current.current.props.selectionMode === "multiple") {
      current.current.manager.extendSelection(available[next].id)
    }
  }
  const move = (event: TNativeKeyboardEvent) => {
    current.current.props.listProps.onKeyDown?.(event)
    if (event.defaultPrevented || event.isDefaultPrevented?.()) return
    const data = event.nativeEvent
    const target = "focusedTarget" in data ? data.focusedTarget : data.target
    const row = current.current.ordered.find((row) => findNodeHandle(row.view.current) === target)
    event.persist?.()
    if (row) withNativeAdmission(row, () => moveAdmitted(event))
    else if (target === findNodeHandle(props.root.current) && typeof target === "number")
      actions?.request(null, target, () => moveAdmitted(event))
  }
  useNativeKeyPolicy({
    tokens: [
      ...(props.submenu
        ? [...keyTokens, ...nativeKeyTokens(props.submenu.direction === "rtl" ? "ArrowRight" : "ArrowLeft")]
        : keyTokens),
      ...(props.listProps.shouldUseVirtualFocus
        ? ["Enter", " ", direction === "rtl" ? "ArrowLeft" : "ArrowRight"].flatMap(nativeKeyTokens)
        : []),
    ],
    targetTag,
    excludeEditable: true,
    excludeComposing: true,
    isEnabled: !!targetTag,
    lifetimeKey: lifetime,
    canAct: admitted,
    onKey: move,
  })
  const typeaheadFrom = (from: TNativeMenuKey, key: string, time: number) => {
    if (!admitted() || current.current.props.listProps.disallowTypeAhead) return
    const before = time - search.current.time < 1000 ? search.current.value : ""
    const text = before && [...before].every((char) => char === key) ? key : before + key
    search.current = { value: text, time }
    const available = current.current.model.filter((item) => !item.disabled)
    const index = available.findIndex((item) => item.id === from),
      choices = [...available.slice(index + 1), ...available.slice(0, index + 1)]
    const fold = (value: string) =>
      value
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLocaleLowerCase()
    const collator =
      typeof Intl.Collator === "function"
        ? new Intl.Collator(undefined, { usage: "search", sensitivity: "base" })
        : null
    const match = choices.find((item) =>
      collator ? collator.compare(item.text.slice(0, text.length), text) === 0 : fold(item.text).startsWith(fold(text)),
    )
    if (match) {
      requestFocus(match.id)
    }
  }
  return (
    <NativeMenuStateContext.Provider value={state}>
      <NativeMenuSelectionManagerContext.Provider value={manager}>
        <NativeMenuItemContext.Provider value={{ shouldCloseOnSelect: props.shouldCloseOnSelect }}>
          <NativeCollectionItemBindingContext.Provider value={actions?.bindingFor(null) ?? ""}>
            <NativeMenuActionsContext.Provider
              value={{
                root: props.root,
                register,
                refresh,
                mode: props.selectionMode,
                text: listStyles.text,
                virtualFocus: props.listProps.shouldUseVirtualFocus ?? false,
                focusVisible,
                disabled,
                selected: (row) => row.selectionManager().isSelected(row.id),
                requestFocus: (row) => withNativeAdmission(row, () => requestFocus(row.id)),
                pointerHandoff: (hitPath, isCurrent) => {
                  if (!isCurrent()) return false
                  const row = hitPath
                    .map((target) =>
                      current.current.ordered.find((candidate) => findNodeHandle(candidate.view.current) === target),
                    )
                    .find((candidate) => candidate !== undefined)
                  if (!row) return false
                  return withNativeAdmission(row, () => {
                    if (isCurrent()) requestFocus(row.id)
                  })
                },
                focus,
                activate,
                openSubmenu: (row, strategy, isCurrent) => {
                  withNativeAdmission(row, () => {
                    if (isCurrent?.() !== false) row.submenu()?.open(strategy)
                  })
                },
                layout: (row, frame) => frames.current.set(row.id, frame),
                typeahead: (row, key, time) => {
                  if (admitted(row)) typeaheadFrom(row.id, key, time)
                },
              }}
            >
              <NativeContentContext.Provider
                value={{ foregroundColor: listStyles.text.color ?? theme.colors.foreground, isButton: false }}
              >
                <MenuListHost
                  {...props.listProps}
                  ref={props.listRef}
                  render={props.listProps.render}
                  isEmpty={collection.size === 0}
                  nativeID={props.listProps.nativeID ?? props.listProps.id ?? props.submenu?.menuID}
                  nativeLabelledBy={
                    nativeAccessibilityIDs(
                      props.listProps.accessibilityLabelledBy ?? props.listProps["aria-labelledby"],
                    ) ??
                    (props.submenu ? [props.submenu.triggerID] : triggerLabelledBy ? [triggerLabelledBy] : undefined)
                  }
                  nativeDescribedBy={nativeAccessibilityIDs(
                    props.listProps.ariaDescribedBy ?? props.listProps["aria-describedby"],
                  )}
                  nativeDetailsBy={nativeAccessibilityIDs(
                    props.listProps.ariaDetails ?? props.listProps["aria-details"],
                  )}
                  nativeDescriptionLabel={props.listProps.descriptionLabel}
                  nativeDetailsLabel={props.listProps.detailsLabel}
                  role="menu"
                  accessible={collection.size === 0 && !props.listProps.renderEmptyState}
                  focusable
                  accessibilityLabel={props.menuAriaLabel}
                  testID={props.listProps.testID ?? "menu-list"}
                  style={listStyles.view}
                  onFocus={(event) => {
                    manager.setFocused(true)
                    setFocusVisible(event.nativeEvent.isFocusVisible)
                    props.listProps.onFocus?.(event)
                  }}
                  onBlur={(event) => {
                    manager.setFocused(false)
                    setFocusVisible(false)
                    props.listProps.onBlur?.(event)
                  }}
                  onKeyDown={(event) => {
                    props.listProps.onKeyDown?.(event)
                    const data = event.nativeEvent
                    if (
                      props.listProps.shouldUseVirtualFocus &&
                      !event.defaultPrevented &&
                      !event.isDefaultPrevented?.() &&
                      !data.cancelled &&
                      !data.altKey &&
                      !data.ctrlKey &&
                      !data.metaKey &&
                      [...data.key].length === 1 &&
                      current.current.active !== null
                    ) {
                      const from = current.current.active
                      event.persist?.()
                      actions?.request(null, findNodeHandle(props.root.current) ?? 0, () =>
                        typeaheadFrom(from, data.key, data.timestamp),
                      )
                    }
                  }}
                  onLayout={(event) => {
                    setTargetTag(findNodeHandle(props.root.current) ?? 0)
                    props.listProps.onLayout?.(event)
                  }}
                >
                  <NativeSelectableCollectionContext.Provider value={null}>
                    {collection.size === 0 && props.listProps.renderEmptyState ? (
                      <NativeFocusHost role="menuitem" accessible focusable={false} testID="menu-empty-state">
                        {getNativeButtonContent(props.listProps.renderEmptyState(), listStyles.text)}
                      </NativeFocusHost>
                    ) : renderer.isVirtualized ? (
                      <CollectionRoot
                        collection={collection}
                        scrollRef={rendererScroll}
                        persistedKeys={persistedKeys}
                      />
                    ) : (
                      <ScrollView
                        ref={scroll}
                        testID="menu-scroll"
                        style={{ flexShrink: 1 }}
                        contentContainerStyle={{
                          flexDirection: listStyles.view.flexDirection,
                          flexWrap: listStyles.view.flexWrap,
                          alignItems: listStyles.view.alignItems,
                          justifyContent: listStyles.view.justifyContent,
                          alignContent: listStyles.view.alignContent,
                          gap: listStyles.view.gap,
                          rowGap: listStyles.view.rowGap,
                          columnGap: listStyles.view.columnGap,
                        }}
                        keyboardShouldPersistTaps="always"
                        scrollEventThrottle={16}
                        onLayout={(event) => {
                          viewport.current = event.nativeEvent.layout.height
                        }}
                        onScroll={(event) => {
                          offset.current = event.nativeEvent.contentOffset.y
                        }}
                      >
                        <CollectionRoot collection={collection} scrollRef={scroll} persistedKeys={persistedKeys} />
                      </ScrollView>
                    )}
                  </NativeSelectableCollectionContext.Provider>
                </MenuListHost>
              </NativeContentContext.Provider>
            </NativeMenuActionsContext.Provider>
          </NativeCollectionItemBindingContext.Provider>
        </NativeMenuItemContext.Provider>
      </NativeMenuSelectionManagerContext.Provider>
    </NativeMenuStateContext.Provider>
  )
}

const MenuListHost = forwardRef<
  View,
  Omit<TNativeMenuListProps, "children"> & {
    children?: React.ReactNode
    isEmpty: boolean
    nativeLabelledBy?: readonly string[]
    nativeDescribedBy?: readonly string[]
    nativeDetailsBy?: readonly string[]
    nativeDescriptionLabel?: string
    nativeDetailsLabel?: string
  }
>((props, ref) => {
  const {
    render,
    slot: _slot,
    isEmpty,
    items: _items,
    dependencies: _dependencies,
    idScope: _idScope,
    filter: _filter,
    shouldUseVirtualFocus: _virtual,
    disallowTypeAhead: _ahead,
    autoFocus: _auto,
    shouldFocusWrap: _wrap,
    selectionMode: _mode,
    selectionBehavior: _behavior,
    selectedKeys: _selected,
    defaultSelectedKeys: _defaults,
    disabledKeys: _disabled,
    disabledBehavior: _disabledBehavior,
    onSelectionChange: _selection,
    disallowEmptySelection: _empty,
    allowDuplicateSelectionEvents: _duplicates,
    expandedKeys: _expanded,
    defaultExpandedKeys: _defaultExpanded,
    onExpandedChange: _expansion,
    onAction: _action,
    onClose: _close,
    shouldCloseOnSelect: _closeSelect,
    renderEmptyState: _emptyRender,
    ariaDescribedBy: _described,
    ariaDetails: _details,
    "aria-describedby": _describedAlias,
    "aria-details": _detailsAlias,
    descriptionLabel: _descriptionLabel,
    detailsLabel: _detailsLabel,
    style,
    ...native
  } = props
  const hostProps = {
    ...native,
    style: style as StyleProp<TextStyle>,
    ref,
  }
  return render ? render(hostProps, { isEmpty }) : <NativeFocusHost {...hostProps} />
})

export { NativeMenuTrigger } from "./NativeMenuTrigger"
