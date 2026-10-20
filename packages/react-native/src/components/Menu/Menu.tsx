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
} from "react"
import { findNodeHandle, Linking, ScrollView, type View } from "react-native"

import { NativeCollectionActionsContext } from "../../collection/actions"
import { NativeCollectionItemBindingContext } from "../../collection/binding"
import { NativeCollectionBuilder } from "../../collection/CollectionBuilder"
import {
  NativeCollectionRendererContext,
  useNativePersistedKeys,
  type TNativeCollectionScrollHost,
} from "../../collection/renderer"
import type { TNativeCollectionSessionSnapshot } from "../../collection/session"
import type { TNativeCollectionSnapshot } from "../../collection/snapshot"
import { useTreeState } from "../../collection/state"
import { focusNativeTarget } from "../../input/focus"
import { nativeKeyTokens } from "../../input/keyScope"
import { NativeFocusView } from "../../input/NativeFocusView"
import { useNativeKeyPolicy, useNativeKeyScope } from "../../input/NativeKeyboardScope"
import type { TNativeKeyboardEvent, TNativePressEvent } from "../../input/types"
import { useNativeDialogTrigger } from "../../overlays/floating/NativeDialogTrigger"
import { NativeFloatingScopeContext, NativeFloatingWindowContext } from "../../overlays/floating/scope"
import { useNativeTheme } from "../../theme"
import { NativeFloatingSurface } from "../ClickPopover/ClickPopover"
import { NativeContentContext } from "../NativeContentContext"

import { NativeMenuActionsContext, NativeMenuStateContext, type TNativeMenuRegistration } from "./context"
import {
  getNativeMenuRecoveryKey,
  normalizeNativeMenuKeys,
  NATIVE_MENU_SELECTION_MODES,
  type TNativeMenuKey,
  type TNativeMenuRow,
} from "./model"
import { useNativeMenuFocusStrategy } from "./NativeMenuTrigger"
import { getNativeMenuStyles } from "./styles"
import type { TNativeMenuProps, TNativeMenuRef } from "./types"

const keyTokens = ["ArrowDown", "ArrowUp", "Home", "End", "PageDown", "PageUp"]
  .flatMap((key) => nativeKeyTokens(key).filter((token) => token.startsWith("0000:") || token.startsWith("1000:")))
  .concat(nativeKeyTokens("a").filter((token) => token.startsWith("0010:") || token.startsWith("0001:")))

export const Menu = forwardRef<TNativeMenuRef, TNativeMenuProps>((props, ref) => {
  const {
    children,
    menuAriaLabel,
    selectionMode = "none",
    selectedKeys,
    onSelectionChange,
    disabledKeys,
    onAction,
    shouldCloseOnSelect = true,
    customMenuStyles,
    isOpen,
    defaultOpen,
    onOpenChange,
    customStyles,
    style,
    ...surface
  } = props
  if (!NATIVE_MENU_SELECTION_MODES.includes(selectionMode)) throw new TypeError("Menu: unsupported selectionMode")
  const trigger = useNativeDialogTrigger()
  const contextOwned = isOpen === undefined && defaultOpen === undefined && trigger !== null
  const [local, setLocal] = useState(defaultOpen ?? false)
  const open = contextOwned ? trigger!.isOpen : (isOpen ?? local)
  const current = useRef({ open, contextOwned, trigger, isOpen, onOpenChange })
  useInsertionEffect(() => {
    current.current = { open, contextOwned, trigger, isOpen, onOpenChange }
  })
  const request = useCallback((next: boolean) => {
    const owner = current.current
    if (owner.open === next) return
    if (owner.contextOwned) owner.trigger!.request(next)
    else {
      if (owner.isOpen === undefined) setLocal(next)
      owner.onOpenChange?.(next)
    }
  }, [])
  const theme = useNativeTheme()
  const styles = getNativeMenuStyles(theme, props)
  const list = useRef<View>(null)
  const initialTarget = useRef<View>(null)
  return (
    <NativeFloatingSurface
      {...surface}
      ref={ref}
      testID={props.testID ?? props["data-testid"] ?? "menu"}
      isOpen={open}
      onOpenChange={request}
      childIsDialog={false}
      nativeRootRole={null}
      showOverlayArrow={false}
      initialFocusRef={props.initialFocusRef ?? initialTarget}
      style={styles.root}
    >
      <NativeCollectionBuilder<object> content={children}>
        {(collection, receipt) => (
          <NativeMenuList
            collection={collection}
            receipt={receipt}
            {...{
              props,
              children,
              menuAriaLabel,
              selectionMode,
              selectedKeys,
              onSelectionChange,
              disabledKeys,
              onAction,
              shouldCloseOnSelect,
              styles,
            }}
            root={list}
            initialTarget={initialTarget}
            close={() => request(false)}
          />
        )}
      </NativeCollectionBuilder>
    </NativeFloatingSurface>
  )
})
Menu.displayName = "Menu"

type TListProps = Pick<
  TNativeMenuProps,
  "children" | "menuAriaLabel" | "selectedKeys" | "onSelectionChange" | "disabledKeys" | "onAction"
> & {
  props: TNativeMenuProps
  selectionMode: NonNullable<TNativeMenuProps["selectionMode"]>
  shouldCloseOnSelect: boolean
  styles: ReturnType<typeof getNativeMenuStyles>
  collection: TNativeCollectionSnapshot<object>
  receipt: TNativeCollectionSessionSnapshot<unknown>["receipt"]
  root: RefObject<View | null>
  initialTarget: RefObject<View | null>
  close: () => void
}
const NativeMenuList = (props: TListProps) => {
  const theme = useNativeTheme()
  const strategy = useNativeMenuFocusStrategy()
  const [rows, setRows] = useState(new Map<TNativeMenuKey, TNativeMenuRegistration>())
  const [targetTag, setTargetTag] = useState(0)
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
  const collection = props.collection
  const renderer = useContext(NativeCollectionRendererContext)
  const CollectionRoot = renderer.CollectionRoot
  const actions = useContext(NativeCollectionActionsContext)
  const state = useTreeState({
    collection,
    selectionMode: props.selectionMode,
    selectedKeys,
    disabledKeys,
    onSelectionChange: props.onSelectionChange,
  })
  const manager = state.selectionManager
  const normalized = manager.rawSelection
  const active = manager.focusedKey
  const [requestedFocusKey, setRequestedFocusKey] = useState<TNativeMenuKey | null>(null)
  const persistedKeys = useNativePersistedKeys(active, requestedFocusKey)
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
  const disabled = (row: TNativeMenuRegistration) => row.props().isDisabled ?? disabledKeys.has(row.id)
  const model = logicalMembers.map(
    (node): TNativeMenuRow => ({
      id: node.key,
      text: node.textValue,
      disabled: node.props.isDisabled ?? disabledKeys.has(node.key),
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
    pendingFocus.current = null
    observedFocusKey.current = row.id
    setRequestedFocusKey(null)
    manager.setFocused(true)
    setActive(row.id)
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
    pendingFocus.current = { key, node, window: focusWindowStamp(), commandedTarget: null, commandedLease: null }
    setRequestedFocusKey(key)
    current.current.renderer.layoutDelegate?.requestRendering?.(key)
    void current.current.renderer.layoutDelegate?.scrollToKey?.(key)
    attemptFocus()
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
    props.initialTarget.current = (initial && current.current.rows.get(initial.id)?.view.current) ?? props.root.current
    const frame = requestAnimationFrame(() => {
      if (!admitted() || current.current.input?.isNativeReady() === false) return
      if (current.current.props.props.initialFocusRef !== undefined && current.current.active === null) return
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
    const owner = current.current
    if (!owner.manager.isLink(row.id)) {
      if (
        "kind" in event.nativeEvent &&
        event.nativeEvent.kind === "keyboard" &&
        event.nativeEvent.shiftKey &&
        owner.props.selectionMode === "multiple"
      )
        owner.manager.extendSelection(row.id)
      else owner.manager.select(row.id)
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
    const index = available.findIndex((row) => row.id === focusedRow?.id)
    if (index < 0 || !available.length) return
    let next = index
    if (data.key === "Home") next = 0
    else if (data.key === "End") next = available.length - 1
    else if (data.key === "ArrowDown") next = (index + 1) % available.length
    else if (data.key === "ArrowUp") next = (index - 1 + available.length) % available.length
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
    const data = event.nativeEvent
    const target = "focusedTarget" in data ? data.focusedTarget : data.target
    const row = current.current.ordered.find((row) => findNodeHandle(row.view.current) === target)
    event.persist?.()
    if (row) withNativeAdmission(row, () => moveAdmitted(event))
    else if (target === findNodeHandle(props.root.current) && typeof target === "number")
      actions?.request(null, target, () => moveAdmitted(event))
  }
  useNativeKeyPolicy({
    tokens: keyTokens,
    targetTag,
    excludeEditable: true,
    excludeComposing: true,
    isEnabled: !!targetTag,
    lifetimeKey: lifetime,
    canAct: admitted,
    onKey: move,
  })
  const typeahead = (row: TNativeMenuRegistration, key: string, time: number) => {
    if (!admitted(row)) return
    const before = time - search.current.time < 1000 ? search.current.value : ""
    const text = before && [...before].every((char) => char === key) ? key : before + key
    search.current = { value: text, time }
    const available = current.current.model.filter((item) => !item.disabled)
    const index = available.findIndex((item) => item.id === row.id),
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
      <NativeCollectionItemBindingContext.Provider value={actions?.bindingFor(null) ?? ""}>
        <NativeMenuActionsContext.Provider
          value={{
            register,
            refresh,
            mode: props.selectionMode,
            text: props.styles.list.text,
            disabled,
            selected: (row) => manager.isSelected(row.id),
            requestFocus: (row) => withNativeAdmission(row, () => requestFocus(row.id)),
            focus,
            activate,
            layout: (row, frame) => frames.current.set(row.id, frame),
            typeahead,
          }}
        >
          <NativeContentContext.Provider
            value={{ foregroundColor: props.styles.list.text.color ?? theme.colors.foreground, isButton: false }}
          >
            <NativeFocusView
              ref={props.root}
              role="menu"
              accessible={collection.size === 0}
              focusable
              accessibilityLabel={props.menuAriaLabel}
              testID="menu-list"
              onLayout={() => setTargetTag(findNodeHandle(props.root.current) ?? 0)}
            >
              {renderer.isVirtualized ? (
                <CollectionRoot collection={collection} scrollRef={rendererScroll} persistedKeys={persistedKeys} />
              ) : (
                <ScrollView
                  ref={scroll}
                  testID="menu-scroll"
                  style={{ flexShrink: 1 }}
                  contentContainerStyle={props.styles.list.view}
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
            </NativeFocusView>
          </NativeContentContext.Provider>
        </NativeMenuActionsContext.Provider>
      </NativeCollectionItemBindingContext.Provider>
    </NativeMenuStateContext.Provider>
  )
}

export { NativeMenuTrigger } from "./NativeMenuTrigger"
