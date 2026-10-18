import {
  Children,
  forwardRef,
  isValidElement,
  useCallback,
  useContext,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react"
import { findNodeHandle, Linking, ScrollView, type View } from "react-native"

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

import { NativeMenuContext, type TNativeMenuRegistration } from "./context"
import { MenuItem } from "./MenuItem"
import {
  equalNativeMenuSelection,
  getNativeMenuRecoveryKey,
  getNativeMenuSelectionRequest,
  nativeMenuSelected,
  normalizeNativeMenuKeys,
  NATIVE_MENU_SELECTION_MODES,
  type TNativeMenuKey,
  type TNativeMenuRow,
  type TNativeMenuSelection,
} from "./model"
import { useNativeMenuFocusStrategy } from "./NativeMenuTrigger"
import { getNativeMenuStyles } from "./styles"
import type { TNativeMenuProps, TNativeMenuRef } from "./types"

const orderHints = (children: ReactNode) => {
  const keys: TNativeMenuKey[] = []
  const visit = (nodes: ReactNode) =>
    Children.forEach(nodes, (node) => {
      if (!isValidElement<{ children?: ReactNode; id?: TNativeMenuKey }>(node)) return
      if (node.type === MenuItem) {
        if (node.props.id !== undefined) keys.push(node.props.id)
      } else if (node.props.children !== undefined) visit(node.props.children)
    })
  visit(children)
  return new Map(keys.map((key, index) => [key, index]))
}
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
      <NativeMenuList
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
  root: RefObject<View | null>
  initialTarget: RefObject<View | null>
  close: () => void
}
const NativeMenuList = (props: TListProps) => {
  const theme = useNativeTheme()
  const strategy = useNativeMenuFocusStrategy()
  const [rows, setRows] = useState(new Map<TNativeMenuKey, TNativeMenuRegistration>())
  const [localSelection, setLocalSelection] = useState<TNativeMenuSelection>(new Set())
  const [active, setActive] = useState<TNativeMenuKey | null>(null)
  const [targetTag, setTargetTag] = useState(0)
  const live = useRef(false),
    scroll = useRef<ScrollView>(null)
  const frames = useRef(new Map<TNativeMenuKey, { y: number; height: number }>())
  const recoveryOrder = useRef<readonly TNativeMenuKey[]>([])
  const viewport = useRef(0),
    offset = useRef(0),
    search = useRef({ value: "", time: 0 })
  const scope = useContext(NativeFloatingScopeContext),
    window = useContext(NativeFloatingWindowContext),
    input = useNativeKeyScope()
  const selectedKeys = useMemo(
    () =>
      props.selectedKeys === undefined || props.selectedKeys === "all"
        ? (props.selectedKeys as "all" | undefined)
        : normalizeNativeMenuKeys(props.selectedKeys),
    [props.selectedKeys],
  )
  const normalized = selectedKeys ?? localSelection
  const disabledKeys = useMemo(() => normalizeNativeMenuKeys(props.disabledKeys ?? []), [props.disabledKeys])
  const hints = orderHints(props.children)
  const ordered = [...rows.values()].sort(
    (a, b) => (hints.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (hints.get(b.id) ?? Number.MAX_SAFE_INTEGER),
  )
  const disabled = (row: TNativeMenuRegistration) => row.props().isDisabled ?? disabledKeys.has(row.id)
  const model = ordered.map(
    (row): TNativeMenuRow => ({
      id: row.id,
      text: row.text(),
      disabled: disabled(row),
      selectionDisabled: disabledKeys.has(row.id),
      href: row.props().href,
    }),
  )
  const current = useRef({ props, rows, ordered, model, disabled, normalized, active, scope, window, input })
  useInsertionEffect(() => {
    current.current = { props, rows, ordered, model, disabled, normalized, active, scope, window, input }
    if (active === null || rows.has(active)) recoveryOrder.current = ordered.map((row) => row.id)
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
    current.current.scope?.canAct() !== false &&
    current.current.window?.() !== false &&
    current.current.input?.isWindowActive() !== false &&
    (!row || (current.current.rows.get(row.id) === row && !current.current.disabled(row)))
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
    setActive(row.id)
    reveal(row)
    return true
  }
  const requestFocus = (row: TNativeMenuRegistration) => {
    if (admitted(row)) {
      reveal(row)
      focusNativeTarget(row.view.current)
    }
  }
  const lifetime = JSON.stringify(model.map((row) => [row.id, row.text, row.disabled, row.href]))
  useLayoutEffect(() => {
    const registered = current.current.ordered.filter((row) => !current.current.disabled(row))
    const initial = strategy === "last" ? registered[registered.length - 1] : registered[0]
    props.initialTarget.current = initial?.view.current ?? props.root.current
    const frame = requestAnimationFrame(() => {
      if (!admitted() || current.current.input?.isNativeReady() === false) return
      if (current.current.props.props.initialFocusRef !== undefined && current.current.active === null) return
      const available = current.current.ordered.filter((row) => !current.current.disabled(row))
      const recovered = getNativeMenuRecoveryKey(recoveryOrder.current, current.current.model, current.current.active)
      const target =
        available.find((row) => row.id === current.current.active) ??
        available.find((row) => row.id === recovered) ??
        (strategy === "last" ? available[available.length - 1] : available[0])
      if (target && !available.some((row) => row.id === current.current.active)) {
        setActive(target.id)
        requestFocus(target)
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [lifetime, scope, strategy, props.initialTarget, props.root])
  const activate = (row: TNativeMenuRegistration, event: TNativePressEvent) => {
    if (!admitted(row) || event.defaultPrevented || event.isDefaultPrevented?.()) return
    const owner = current.current
    const next = getNativeMenuSelectionRequest(
      owner.props.selectionMode,
      owner.normalized,
      owner.model,
      row.id,
      "kind" in event.nativeEvent && event.nativeEvent.kind === "keyboard" && event.nativeEvent.shiftKey,
    )
    if (next !== null && !equalNativeMenuSelection(owner.normalized, next)) {
      if (owner.props.selectedKeys === undefined) setLocalSelection(next)
      owner.props.onSelectionChange?.(next)
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
  const move = (event: TNativeKeyboardEvent) => {
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
      const owner = current.current
      const selectable = owner.model.filter((item) => !item.disabled && !item.selectionDisabled)
      const all =
        owner.normalized === "all" ||
        (selectable.length > 0 &&
          selectable.every((item) => owner.normalized !== "all" && owner.normalized.has(item.id)))
      const next = all ? new Set<TNativeMenuKey>() : "all"
      if (owner.props.selectedKeys === undefined) setLocalSelection(next)
      owner.props.onSelectionChange?.(next)
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
    const available = current.current.ordered.filter((row) => !current.current.disabled(row))
    const tag = "focusedTarget" in data && typeof data.focusedTarget === "number" ? data.focusedTarget : data.target
    const index = available.findIndex((row) => findNodeHandle(row.view.current) === tag)
    if (index < 0 || !available.length) return
    let next = index
    if (data.key === "Home") next = 0
    else if (data.key === "End") next = available.length - 1
    else if (data.key === "ArrowDown") next = (index + 1) % available.length
    else if (data.key === "ArrowUp") next = (index - 1 + available.length) % available.length
    else {
      const frame = frames.current.get(available[index].id)
      if (!frame || !viewport.current) return
      const destination =
        data.key === "PageDown"
          ? frame.y - frame.height + viewport.current
          : Math.max(0, frame.y + frame.height - viewport.current)
      if (data.key === "PageDown")
        while (next < available.length - 1 && (frames.current.get(available[next].id)?.y ?? Infinity) < destination)
          next++
      else if (data.key === "PageUp")
        while (next > 0 && (frames.current.get(available[next].id)?.y ?? -Infinity) > destination) next--
      else return
    }
    setActive(available[next].id)
    requestFocus(available[next])
    if (data.shiftKey && current.current.props.selectionMode === "multiple") {
      const selection = getNativeMenuSelectionRequest(
        "multiple",
        current.current.normalized,
        current.current.model,
        available[next].id,
        true,
      )
      if (selection && !equalNativeMenuSelection(selection, current.current.normalized)) {
        if (current.current.props.selectedKeys === undefined) setLocalSelection(selection)
        current.current.props.onSelectionChange?.(selection)
      }
    }
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
    const available = current.current.ordered.filter((item) => !current.current.disabled(item))
    const index = available.indexOf(row),
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
      collator
        ? collator.compare(item.text().slice(0, text.length), text) === 0
        : fold(item.text()).startsWith(fold(text)),
    )
    if (match) {
      setActive(match.id)
      requestFocus(match)
    }
  }
  return (
    <NativeMenuContext.Provider
      value={{
        register,
        refresh,
        mode: props.selectionMode,
        text: props.styles.list.text,
        disabled,
        selected: (row) =>
          props.selectionMode !== "none" &&
          nativeMenuSelected(
            normalized,
            model.find((item) => item.id === row.id) ?? { id: row.id, text: row.text(), disabled: disabled(row) },
          ),
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
          accessible={rows.size === 0}
          focusable
          accessibilityLabel={props.menuAriaLabel}
          testID="menu-list"
          onLayout={() => setTargetTag(findNodeHandle(props.root.current) ?? 0)}
        >
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
            {props.children}
          </ScrollView>
        </NativeFocusView>
      </NativeContentContext.Provider>
    </NativeMenuContext.Provider>
  )
}

export { NativeMenuTrigger } from "./NativeMenuTrigger"
