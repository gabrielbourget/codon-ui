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
  type ForwardedRef,
  type ReactNode,
  type RefAttributes,
} from "react"
import { findNodeHandle, I18nManager, Linking, Platform, type View } from "react-native"

import { focusNativeTarget } from "../../input/focus"
import { NativeFocusView } from "../../input/NativeFocusView"
import { useNativeKeyPolicy, useNativeKeyScope } from "../../input/NativeKeyboardScope"
import type { TNativeKeyboardEvent } from "../../input/types"
import { NativeFloatingScopeContext, NativeFloatingWindowContext } from "../../overlays/floating/scope"
import { useNativeTheme } from "../../theme"
import { getNativeButtonContent } from "../Button/content"
import { encodeCollectionKey, validateCollectionKey } from "../collection"

import { NativeTagGroupContext, NativeTagItemValueContext, type TNativeTagRegistration } from "./context"
import {
  getNativeTagGroupActionState,
  getNativeTagGroupPressIntent,
  getNativeTagGroupSelectionOperation,
} from "./intent"
import {
  getNativeTagGroupKeyTokens,
  getNativeTagGroupNavigationKey,
  getNativeTagGroupNavigationSelection,
  isNativeTagGroupNavigationKey,
} from "./keyboard"
import {
  equalNativeTagGroupSelection,
  getNativeTagGroupRemovalRequest,
  getNativeTagGroupSelectAllRequest,
  getNativeTagGroupSelectionRequest,
  nativeTagGroupSelected,
  normalizeNativeTagGroupKeys,
  NATIVE_TAG_GROUP_SELECTION_BEHAVIORS,
  NATIVE_TAG_GROUP_SELECTION_MODES,
  type TNativeTagGroupKey,
  type TNativeTagGroupRow,
  type TNativeTagGroupSelection,
} from "./model"
import { getNativeTagGroupStyles } from "./styles"
import type { TNativeTagGroupProps, TNativeTagGroupRef } from "./types"

const hintsFor = (children: ReactNode) => {
  const result = new Map<TNativeTagGroupKey, number>()
  const visit = (nodes: ReactNode) =>
    Children.forEach(nodes, (node) => {
      if (!isValidElement<{ id?: TNativeTagGroupKey; children?: ReactNode }>(node)) return
      if (node.props.id !== undefined) result.set(node.props.id, result.size)
      else if (node.props.children !== undefined) visit(node.props.children)
    })
  visit(children)
  return result
}
const KeyBindings = ({
  targetTag,
  lifetime,
  canAct,
  onKey,
}: {
  targetTag: number
  lifetime: string
  canAct: () => boolean
  onKey: (event: TNativeKeyboardEvent) => void
}) => {
  useNativeKeyPolicy({
    tokens: getNativeTagGroupKeyTokens(Platform.OS === "ios"),
    targetTag,
    lifetimeKey: lifetime,
    isEnabled: targetTag > 0,
    excludeEditable: true,
    excludeComposing: true,
    canAct,
    onKey,
  })
  return null
}

const NativeTagGroup = <T extends object>(props: TNativeTagGroupProps<T>, ref: ForwardedRef<TNativeTagGroupRef>) => {
  const {
    children,
    items,
    getKey,
    selectedKeys,
    defaultSelectedKeys,
    disabledKeys,
    selectionMode = "none",
    selectionBehavior = "toggle",
    onSelectionChange: _selection,
    onRemove: _remove,
    onAction: _action,
    disallowEmptySelection: _empty,
    shouldSelectOnPressUp: _up,
    escapeKeyBehavior: _escape,
    emptyListMessage,
    renderEmptyState,
    labels = {},
    width: _width,
    height: _height,
    orientation: _orientation,
    customStyles: _custom,
    customTagListStyles: _list,
    style: _style,
    testID,
    "data-testid": aliasTestID,
    ...native
  } = props
  if (
    !NATIVE_TAG_GROUP_SELECTION_MODES.includes(selectionMode) ||
    !NATIVE_TAG_GROUP_SELECTION_BEHAVIORS.includes(selectionBehavior)
  )
    throw new TypeError("TagGroup: unsupported selection mode/behavior")
  const [localSelection, setLocalSelection] = useState<TNativeTagGroupSelection>(() =>
    defaultSelectedKeys === "all" ? "all" : normalizeNativeTagGroupKeys(defaultSelectedKeys ?? []),
  )
  const controlled = useMemo<TNativeTagGroupSelection | undefined>(
    () =>
      selectedKeys === undefined
        ? undefined
        : selectedKeys === "all"
          ? "all"
          : normalizeNativeTagGroupKeys(selectedKeys),
    [selectedKeys],
  )
  const selection = controlled ?? localSelection
  const disabled = useMemo(() => normalizeNativeTagGroupKeys(disabledKeys ?? []), [disabledKeys])
  const [behavior, setBehavior] = useState(selectionBehavior)
  const previousBehavior = useRef(selectionBehavior)
  if (previousBehavior.current !== selectionBehavior) {
    previousBehavior.current = selectionBehavior
    setBehavior(selectionBehavior)
  }
  if (selectionBehavior === "replace" && behavior === "toggle" && selection !== "all" && selection.size === 0)
    setBehavior("replace")
  const [rows, setRows] = useState(new Map<TNativeTagGroupKey, TNativeTagRegistration>())
  const [focusedKey, setFocusedKey] = useState<TNativeTagGroupKey | null>(null),
    [focusWithin, setFocusWithin] = useState(false),
    [focusVisible, setFocusVisible] = useState(false),
    [targetTag, setTargetTag] = useState(0)
  const list = useRef<View>(null),
    live = useRef(false),
    previousOrder = useRef<readonly TNativeTagGroupKey[]>([])
  const typeahead = useRef<{
    search: string
    timer: ReturnType<typeof setTimeout> | null
    generation: number
    session: string
  }>({ search: "", timer: null, generation: 0, session: "" })
  const clearTypeahead = () => {
    const state = typeahead.current
    state.generation++
    if (state.timer !== null) clearTimeout(state.timer)
    state.timer = null
    state.search = ""
  }
  const scope = useContext(NativeFloatingScopeContext),
    window = useContext(NativeFloatingWindowContext),
    input = useNativeKeyScope()
  const supplied = useMemo(() => (items === undefined ? undefined : Array.from(items)), [items])
  const content =
    supplied === undefined
      ? typeof children === "function"
        ? null
        : children
      : (() => {
          if (typeof children !== "function") throw new TypeError("TagGroup: items require render children")
          const seen = new Set<string>()
          return supplied.map((item, order) => {
            const rendered = children(item)
            const authored = isValidElement<{ id?: TNativeTagGroupKey }>(rendered) ? rendered.props.id : undefined
            const value = item as { id?: TNativeTagGroupKey; key?: TNativeTagGroupKey }
            const key = getKey ? getKey(item) : (authored ?? value.id ?? value.key)
            validateCollectionKey(key as TNativeTagGroupKey, "item key", "TagGroup")
            const encoded = encodeCollectionKey(key!)
            if (seen.has(encoded)) throw new TypeError("TagGroup: duplicate item key")
            seen.add(encoded)
            return (
              <NativeTagItemValueContext.Provider key={encoded} value={{ key: key!, order }}>
                {rendered}
              </NativeTagItemValueContext.Provider>
            )
          })
        })()
  const hints = supplied === undefined ? hintsFor(content) : new Map<TNativeTagGroupKey, number>()
  const ordered = [...rows.values()].sort(
    (a, b) =>
      (a.order ?? hints.get(a.key) ?? Number.MAX_SAFE_INTEGER) -
      (b.order ?? hints.get(b.key) ?? Number.MAX_SAFE_INTEGER),
  )
  const isDisabled = (row: TNativeTagRegistration, item = row.props()) =>
    disabled.has(row.key) || item.isDisabled === true
  const model = ordered.map(
    (row): TNativeTagGroupRow => ({
      key: row.key,
      textValue: row.text(),
      isDisabled: isDisabled(row),
      hasAction: !!(row.props().onAction || props.onAction),
      href: row.props().href,
    }),
  )
  const current = useRef({
    props,
    ordered,
    rows,
    model,
    selection,
    behavior,
    focusedKey,
    scope,
    window,
    input,
    isDisabled,
  })
  useInsertionEffect(() => {
    current.current = { props, ordered, rows, model, selection, behavior, focusedKey, scope, window, input, isDisabled }
    if (focusedKey === null || rows.has(focusedKey)) previousOrder.current = ordered.map((row) => row.key)
  })
  useInsertionEffect(() => {
    live.current = true
    return () => {
      live.current = false
      clearTypeahead()
    }
  }, [])
  const register = useCallback((row: TNativeTagRegistration) => {
    setRows((old) => {
      if (old.has(row.key) && old.get(row.key) !== row) throw new TypeError("TagGroup: duplicate tag key")
      return new Map(old).set(row.key, row)
    })
    return () => {
      if (live.current)
        setRows((old) => {
          if (old.get(row.key) !== row) return old
          const next = new Map(old)
          next.delete(row.key)
          return next
        })
    }
  }, [])
  const refresh = useCallback((row: TNativeTagRegistration) => {
    if (live.current) setRows((old) => (old.get(row.key) === row ? new Map(old) : old))
  }, [])
  const admitted = (row?: TNativeTagRegistration) =>
    live.current &&
    current.current.scope?.canAct() !== false &&
    current.current.window?.() !== false &&
    current.current.input?.isWindowActive() !== false &&
    (!row || (current.current.rows.get(row.key) === row && !current.current.isDisabled(row)))
  const selected = (row: TNativeTagRegistration) =>
    nativeTagGroupSelected(
      selectionMode,
      selection,
      model.find((item) => item.key === row.key) ?? {
        key: row.key,
        textValue: row.text(),
        isDisabled: isDisabled(row),
        hasAction: false,
      },
    )
  const keyCapture = (row: TNativeTagRegistration, event: TNativeKeyboardEvent) => {
    if (!admitted(row)) {
      clearTypeahead()
      return
    }
    const data = event.nativeEvent
    if (event.defaultPrevented || event.isDefaultPrevented?.() || data.cancelled || data.phase !== "down") return
    const session = JSON.stringify(current.current.input?.acknowledgedSession() ?? null),
      state = typeahead.current
    if (state.session !== session) {
      clearTypeahead()
      state.session = session
    }
    const character = data.key.length === 1 || !/^[A-Z]/i.test(data.key) ? data.key : ""
    if (!character || data.ctrlKey || data.metaKey || (!state.search.length && character === " ")) return
    if (character === " " && state.search.trim().length) {
      event.preventDefault()
      event.stopPropagation?.()
    }
    state.search += character
    state.generation++
    const generation = state.generation
    if (state.timer !== null) clearTimeout(state.timer)
    // The pinned default TagGroup delegate has no collator; its capture buffer still owns Space.
    state.timer = setTimeout(() => {
      if (state.generation === generation) {
        state.search = ""
        state.timer = null
      }
    }, 1000)
  }
  const actionState: NonNullable<React.ContextType<typeof NativeTagGroupContext>>["actionState"] = (
    row,
    item = row.props(),
  ) =>
    getNativeTagGroupActionState({
      mode: selectionMode,
      behavior,
      isEmpty: selection !== "all" && selection.size === 0,
      isDisabled: disabled.has(row.key) || item.isDisabled === true,
      hasAction: !!(item.onAction || props.onAction),
      isLink: !!item.href,
    })
  const requestSelection = (next: TNativeTagGroupSelection | null) => {
    if (!admitted() || next === null || equalNativeTagGroupSelection(current.current.selection, next)) return
    if (current.current.props.selectedKeys === undefined) setLocalSelection(next)
    current.current.props.onSelectionChange?.(next === "all" ? next : normalizeNativeTagGroupKeys(next))
  }
  const action = (row: TNativeTagRegistration) => {
    if (!admitted(row)) return
    row.props().onAction?.()
    if (!admitted(row)) return
    current.current.props.onAction?.(row.key)
    if (!admitted(row)) return
    const href = row.props().href
    if (href) {
      if (row.props().onNavigate) row.props().onNavigate!(href)
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
  }
  const remove: NonNullable<React.ContextType<typeof NativeTagGroupContext>>["remove"] = (row, source, event) => {
    if (!admitted(row) || event.defaultPrevented || event.isDefaultPrevented?.() || !current.current.props.onRemove)
      return
    const keys = getNativeTagGroupRemovalRequest(
      current.current.props.selectionMode ?? "none",
      current.current.selection,
      current.current.model,
      row.key,
      source,
    )
    if (keys) current.current.props.onRemove(keys)
  }
  const press: NonNullable<React.ContextType<typeof NativeTagGroupContext>>["press"] = (
    row,
    phase,
    event,
    metadata,
  ) => {
    if (!admitted(row) || event.defaultPrevented || event.isDefaultPrevented?.()) return
    const owner = current.current,
      state = getNativeTagGroupActionState({
        mode: owner.props.selectionMode ?? "none",
        behavior: owner.behavior,
        isEmpty: owner.selection !== "all" && owner.selection.size === 0,
        isDisabled: owner.isDisabled(row),
        hasAction: !!(row.props().onAction || owner.props.onAction),
        isLink: !!row.props().href,
      })
    const intent = getNativeTagGroupPressIntent(state, {
      ...metadata,
      phase,
      shouldSelectOnPressUp: owner.props.shouldSelectOnPressUp ?? false,
    })
    if (intent.select) {
      const operation = getNativeTagGroupSelectionOperation({
        ...metadata,
        mode: owner.props.selectionMode ?? "none",
        behavior: owner.behavior,
        isSelected: selected(row),
        disallowEmptySelection: owner.props.disallowEmptySelection ?? false,
      })
      requestSelection(
        getNativeTagGroupSelectionRequest(
          owner.props.selectionMode ?? "none",
          owner.selection,
          owner.model,
          row.key,
          operation,
          {
            disallowEmptySelection: owner.props.disallowEmptySelection,
            allowLinkSelection: metadata.pointerType === "keyboard" && metadata.nonContiguousModifier,
          },
        ),
      )
    }
    if (intent.enterToggle && admitted(row)) setBehavior("toggle")
    if (intent.action) action(row)
  }
  const lifetime = JSON.stringify(model.map((row) => [row.key, row.isDisabled, row.textValue, row.href]))
  useLayoutEffect(() => {
    if (focusedKey === null || (rows.has(focusedKey) && !isDisabled(rows.get(focusedKey)!))) return
    const prior = previousOrder.current,
      index = prior.indexOf(focusedKey)
    const keys = index < 0 ? [] : [...prior.slice(index + 1), ...prior.slice(0, index).reverse()]
    const frame = requestAnimationFrame(() => {
      if (!admitted() || current.current.input?.isNativeReady() === false) return
      const target = keys
        .map((key) => current.current.rows.get(key))
        .find((row) => row && !current.current.isDisabled(row))
      if (target) {
        setFocusedKey(target.key)
        focusNativeTarget(target.view.current)
      } else if (current.current.rows.size === 0) {
        setFocusedKey(null)
        focusNativeTarget(list.current)
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [lifetime, focusedKey, scope])
  const onKey = (event: TNativeKeyboardEvent) => {
    const data = event.nativeEvent
    if (!admitted() || data.phase !== "down" || data.cancelled || !data.nativeDefaultHandled) return
    const owner = current.current
    const tag = "focusedTarget" in data && typeof data.focusedTarget === "number" ? data.focusedTarget : data.target
    const row = owner.ordered.find(
      (entry) => findNodeHandle(entry.view.current) === tag || findNodeHandle(entry.removeView.current) === tag,
    )
    if (data.key === "Escape") {
      if (
        (owner.props.selectionMode ?? "none") !== "none" &&
        owner.props.escapeKeyBehavior !== "none" &&
        !owner.props.disallowEmptySelection
      )
        requestSelection(new Set())
      return
    }
    if (data.key === "a" && (Platform.OS === "ios" ? data.metaKey : data.ctrlKey)) {
      requestSelection(
        getNativeTagGroupSelectAllRequest(owner.props.selectionMode ?? "none", owner.selection, owner.model),
      )
      return
    }
    if (data.key === "Delete" || data.key === "Backspace") {
      if (row) remove(row, "keyboard", event)
      return
    }
    if (!isNativeTagGroupNavigationKey(data.key) || (!row && tag !== findNodeHandle(list.current))) return
    if (!row && data.shiftKey && (data.key === "Home" || data.key === "End")) return
    const nextKey = getNativeTagGroupNavigationKey(owner.model, row?.key ?? null, data.key, I18nManager.isRTL)
    const target = nextKey === null ? undefined : owner.rows.get(nextKey)
    if (!target) return
    focusNativeTarget(target.view.current)
    const operation = getNativeTagGroupNavigationSelection({
      key: data.key,
      mode: owner.props.selectionMode ?? "none",
      behavior: owner.behavior,
      isLink: !!target.props().href,
      isApple: Platform.OS === "ios",
      modifiers: data,
    })
    if (operation)
      requestSelection(
        getNativeTagGroupSelectionRequest(
          owner.props.selectionMode ?? "none",
          owner.selection,
          owner.model,
          target.key,
          operation,
          {
            disallowEmptySelection: owner.props.disallowEmptySelection,
            allowLinkSelection: data.key === "Home" || data.key === "End",
          },
        ),
      )
  }
  const theme = useNativeTheme(),
    styles = getNativeTagGroupStyles(theme, props)
  const snapshot = {
    keys: ordered.map((row) => row.key),
    selectedKeys: selection === "all" ? ("all" as const) : normalizeNativeTagGroupKeys(selection),
    focusedKey,
    selectionMode,
    selectionBehavior: behavior,
  }
  const empty =
    rows.size === 0
      ? (renderEmptyState?.({
          isEmpty: true,
          isFocused: focusWithin,
          isFocusVisible: focusVisible,
          state: snapshot,
        }) ?? (renderEmptyState ? null : emptyListMessage))
      : null
  return (
    <NativeFocusView
      {...native}
      ref={ref}
      accessible={false}
      focusable={false}
      testID={testID ?? aliasTestID ?? "tag-group"}
      style={styles.root}
    >
      <NativeTagGroupContext.Provider
        value={{
          register,
          refresh,
          mode: selectionMode,
          behavior,
          labels,
          allowsRemoving: !!props.onRemove,
          disabled: isDisabled,
          selected,
          actionState,
          keyCapture,
          focus: (row, value, visible) => {
            if (value && admitted(row)) {
              setFocusWithin(true)
              setFocusedKey(row.key)
              setFocusVisible(visible)
            } else if (!value) {
              setFocusWithin(false)
              setFocusVisible(false)
            }
          },
          press,
          remove,
        }}
      >
        <NativeFocusView
          ref={list}
          role={rows.size ? "grid" : "group"}
          accessible={rows.size === 0}
          focusable
          accessibilityLabel={props.accessibilityLabel ?? props["aria-label"]}
          accessibilityLabelledBy={props.accessibilityLabelledBy}
          testID="tag-list"
          style={styles.list}
          onLayout={() => setTargetTag(findNodeHandle(list.current) ?? 0)}
          accessibilityLiveRegion={focusWithin ? "polite" : "none"}
          onFocus={(event) => {
            setFocusWithin(true)
            setFocusVisible(event.nativeEvent.isFocusVisible)
          }}
          onBlur={() => {
            setFocusWithin(false)
            setFocusVisible(false)
          }}
        >
          {content}
          {rows.size === 0 ? getNativeButtonContent(empty, { color: theme.colors.controlPlaceholder }) : null}
        </NativeFocusView>
        {input ? <KeyBindings targetTag={targetTag} lifetime={lifetime} canAct={admitted} onKey={onKey} /> : null}
      </NativeTagGroupContext.Provider>
    </NativeFocusView>
  )
}
export const TagGroup = forwardRef(NativeTagGroup) as <T extends object>(
  props: TNativeTagGroupProps<T> & RefAttributes<TNativeTagGroupRef>,
) => ReactNode
