import {
  forwardRef,
  isValidElement,
  useCallback,
  useContext,
  useId,
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

import { NativeCollectionActionsContext } from "../../collection/actions"
import { NativeCollectionItemBindingContext } from "../../collection/binding"
import { NativeCollectionBuilder } from "../../collection/CollectionBuilder"
import { NativeSelectableCollectionContext, useNativeContextProps } from "../../collection/context"
import {
  NativeCollectionRendererContext,
  useNativePersistedKeys,
  type TNativeCollectionScrollHost,
} from "../../collection/renderer"
import { NativeCollectionSemanticsContext, type TNativeCollectionSemantics } from "../../collection/semantics"
import type { TNativeCollectionSessionSnapshot } from "../../collection/session"
import type { TNativeCollectionNode, TNativeCollectionSnapshot } from "../../collection/snapshot"
import { NativeListStateContext, useListState, UNSTABLE_useFilteredListState } from "../../collection/state"
import type { Node } from "../../collection/state/types"
import { nativeAccessibilityIDs, nativeCompositeLabelProps } from "../../input/accessibilityReferences"
import { focusNativeTarget } from "../../input/focus"
import { NativeFocusView } from "../../input/NativeFocusView"
import { useNativeKeyPolicy, useNativeKeyScope } from "../../input/NativeKeyboardScope"
import type { TNativeFocusViewProps, TNativeKeyboardEvent } from "../../input/types"
import { NativeFloatingScopeContext, NativeFloatingWindowContext } from "../../overlays/floating/scope"
import { useNativeTheme } from "../../theme"
import { encodeCollectionKey, validateCollectionKey } from "../collection"

import {
  NativeTagGroupActionsContext,
  NativeTagGroupContext,
  NativeTagListContext,
  NativeTagListRenderContext,
  NativeTagGroupStateContext,
  NativeTagItemValueContext,
  type TNativeTagRegistration,
} from "./context"
import {
  getNativeTagGroupActionState,
  getNativeTagGroupPressIntent,
  getNativeTagGroupSelectionOperation,
} from "./intent"
import {
  getNativeTagGroupKeyTokens,
  getNativeTagGroupNavigationKey,
  getNativeTagGroupNavigationSelection,
  getNativeTagGroupPageKey,
  isNativeTagGroupNavigationKey,
} from "./keyboard"
import {
  getNativeTagGroupRemovalRequest,
  normalizeNativeTagGroupKeys,
  NATIVE_TAG_GROUP_SELECTION_BEHAVIORS,
  NATIVE_TAG_GROUP_SELECTION_MODES,
  type TNativeTagGroupKey,
  type TNativeTagGroupRow,
  type TNativeTagGroupSelectionOperation,
} from "./model"
import { getNativeTagGroupStyles } from "./styles"
import { NativeTagList } from "./TagList"
import type { TNativeTagGroupProps, TNativeTagGroupRef } from "./types"

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

const NativeTagGroup = <T extends object>({
  props: authoredProps,
  forwardedRef: ref,
  collection: unfilteredCollection,
  receipt,
}: {
  props: TNativeTagGroupProps<T>
  forwardedRef: ForwardedRef<TNativeTagGroupRef>
  collection: TNativeCollectionSnapshot<T>
  receipt: TNativeCollectionSessionSnapshot<unknown>["receipt"]
}) => {
  const listID = `codon-tag-list-${useId()}`
  const list = useRef<View>(null)
  const { id, ...otherProps } = authoredProps
  const [props, listRef] = useNativeContextProps(otherProps, list, NativeSelectableCollectionContext)
  const {
    children: _children,
    items: _items,
    getKey: _getKey,
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
    ariaDescribedBy: _describedBy,
    ariaDetails: _details,
    "aria-describedby": _describedAlias,
    "aria-details": _detailsAlias,
    render,
    slot: _slot,
    filter,
    shouldUseVirtualFocus: _virtualFocus,
    disallowTypeAhead: _disallowTypeAhead,
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
  const controlled = useMemo(() => {
    if (selectedKeys === undefined || selectedKeys === "all") return selectedKeys
    const keys = normalizeNativeTagGroupKeys(selectedKeys)
    return selectedKeys instanceof Set ? selectedKeys : keys
  }, [selectedKeys])
  const defaults = useMemo(() => {
    if (defaultSelectedKeys === "all") return "all" as const
    const keys = normalizeNativeTagGroupKeys(defaultSelectedKeys ?? [])
    return defaultSelectedKeys instanceof Set ? defaultSelectedKeys : keys
  }, [defaultSelectedKeys])
  const disabled = useMemo(() => normalizeNativeTagGroupKeys(disabledKeys ?? []), [disabledKeys])
  const renderer = useContext(NativeCollectionRendererContext)
  const unfilteredState = useListState({
    collection: unfilteredCollection,
    layoutDelegate: renderer.layoutDelegate,
    selectionMode,
    selectionBehavior,
    selectedKeys: controlled,
    defaultSelectedKeys: defaults,
    disabledKeys: disabled,
    disallowEmptySelection: props.disallowEmptySelection,
    onSelectionChange: props.onSelectionChange,
  })
  const filterNode = useMemo(
    () => (filter ? (text: string, node: Node<T>) => filter(text, node as TNativeCollectionNode<T>) : undefined),
    [filter],
  )
  const state = UNSTABLE_useFilteredListState(unfilteredState, filterNode)
  const collection = state.collection as TNativeCollectionSnapshot<T>
  const actions = useContext(NativeCollectionActionsContext)
  const manager = state.selectionManager
  const selection = manager.rawSelection,
    behavior = manager.selectionBehavior,
    focusedKey = manager.focusedKey
  const [rows, setRows] = useState(new Map<TNativeTagGroupKey, TNativeTagRegistration>())
  const focusWithin = manager.isFocused
  const setFocusWithin = (value: boolean) => manager.setFocused(value)
  const setFocusedKey = (key: TNativeTagGroupKey | null) => manager.setFocusedKey(key)
  const [targetTag, setTargetTag] = useState(0)
  const scroll = useRef<TNativeCollectionScrollHost | null>(null)
  const [requestedFocusKey, setRequestedFocusKey] = useState<TNativeTagGroupKey | null>(null)
  const pendingFocus = useRef<{
    key: TNativeTagGroupKey | null
    node: ReturnType<TNativeCollectionSnapshot<T>["getItem"]>
    window: string
    commandedTarget: View | null
    commandedLease: TNativeCollectionSessionSnapshot<unknown>["receipt"]["lease"]
  } | null>(null)
  const observedFocus = useRef<TNativeTagGroupKey | null>(null)
  const retiredFocusIntent = useRef<TNativeTagGroupKey | null>(null)
  const persistedKeys = useNativePersistedKeys(focusedKey, requestedFocusKey, observedFocus.current)
  const live = useRef(false)
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
  const members: TNativeCollectionNode<T>[] = []
  for (let key = collection.getFirstKey(); key !== null; key = collection.getKeyAfter(key)) {
    const node = collection.getItem(key)!
    if (node.type === "item") members.push(node)
  }
  const ordered = members.flatMap((node) => {
    const row = rows.get(node.key)
    return row ? [row] : []
  })
  const isDisabled = (row: TNativeTagRegistration, item = row.props()) =>
    disabled.has(row.key) || item.isDisabled === true
  const model = members.map(
    (node): TNativeTagGroupRow => ({
      key: node.key,
      textValue: node.textValue,
      isDisabled: disabled.has(node.key) || node.props.isDisabled === true,
      hasAction: !!(node.props.onAction || props.onAction),
      href: node.props.href,
    }),
  )
  const current = useRef({
    props,
    collection,
    receipt,
    manager,
    renderer,
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
    current.current = {
      props,
      collection,
      receipt,
      manager,
      renderer,
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
    }
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
    current.current.receipt.status === "confirmed" &&
    current.current.scope?.canAct() !== false &&
    current.current.window?.() !== false &&
    current.current.input?.isWindowActive() !== false &&
    (!row ||
      (current.current.collection.getItem(row.key) !== null &&
        row.view.current !== null &&
        current.current.rows.get(row.key) === row &&
        !current.current.isDisabled(row)))
  const selected = (row: TNativeTagRegistration) => manager.isSelected(row.key)
  const keyCapture = (row: TNativeTagRegistration, event: TNativeKeyboardEvent) => {
    if (current.current.props.disallowTypeAhead) return
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
  const actionState: NonNullable<React.ContextType<typeof NativeTagGroupActionsContext>>["actionState"] = (
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
  const requestSelection = (
    key: TNativeTagGroupKey,
    operation: TNativeTagGroupSelectionOperation,
    allowLinkSelection = false,
  ) => {
    if (!admitted()) return
    const manager = current.current.manager
    if (manager.isLink(key) && !allowLinkSelection) return
    if (operation === "toggle") manager.toggleSelection(key)
    else if (operation === "replace") manager.replaceSelection(key)
    else manager.extendSelection(key)
  }
  const withNativeAdmission = (row: TNativeTagRegistration, operation: () => void) => {
    if (!admitted(row)) return false
    const node = row.node
    const host = row.view.current
    const target = host && findNodeHandle(host)
    if (!node || !target) return false
    return (
      actions?.request(node, target, () => {
        if (admitted(row) && row.view.current === host) operation()
      }) ?? false
    )
  }
  const focusWindowStamp = () => {
    const lease = current.current.receipt.lease,
      session = current.current.input?.acknowledgedSession()
    return JSON.stringify([
      lease?.rootRevision,
      lease?.target,
      lease?.surfaceId,
      lease?.windowId,
      lease?.epoch,
      session?.windowId,
      session?.epoch,
    ])
  }
  const cancelFocusRequest = () => {
    if (pendingFocus.current?.key != null) retiredFocusIntent.current = pendingFocus.current.key
    pendingFocus.current = null
    if (live.current) setRequestedFocusKey(null)
  }
  const attemptFocusRequest = () => {
    const request = pendingFocus.current
    if (!request || !admitted() || current.current.input?.isNativeReady() === false) return
    const window = focusWindowStamp()
    if (request.window !== window || !actions?.bindingFor(request.node)) {
      cancelFocusRequest()
      return
    }
    if (request.commandedLease !== current.current.receipt.lease) request.commandedTarget = null
    if (request.key === null) {
      const host = list.current
      const target = host && findNodeHandle(host)
      if (
        target &&
        host !== request.commandedTarget &&
        actions.request(null, target, () => {
          if (pendingFocus.current === request && admitted() && list.current === host) focusNativeTarget(host)
        })
      ) {
        request.commandedTarget = host
        request.commandedLease = current.current.receipt.lease
      }
    } else {
      const row = current.current.rows.get(request.key)
      const host = row?.view.current
      if (
        row &&
        host &&
        host !== request.commandedTarget &&
        withNativeAdmission(row, () => {
          if (pendingFocus.current === request) focusNativeTarget(host)
        })
      ) {
        request.commandedTarget = host
        request.commandedLease = current.current.receipt.lease
      }
    }
  }
  const requestFocus = (key: TNativeTagGroupKey) => {
    const node = current.current.collection.getItem(key)
    if (!node || !admitted()) return
    pendingFocus.current = {
      key,
      node,
      window: focusWindowStamp(),
      commandedTarget: null,
      commandedLease: null,
    }
    retiredFocusIntent.current = null
    current.current.manager.setFocusedKey(key)
    setRequestedFocusKey(key)
    current.current.renderer.layoutDelegate?.requestRendering?.(key)
    void current.current.renderer.layoutDelegate?.scrollToKey?.(key)
    attemptFocusRequest()
  }
  useLayoutEffect(attemptFocusRequest)
  useLayoutEffect(
    () =>
      input?.subscribe(() => {
        if (current.current.input?.isWindowActive() === false) cancelFocusRequest()
        else attemptFocusRequest()
      }),
    [input, actions],
  )
  useLayoutEffect(() => {
    if (
      manager.isFocused &&
      focusedKey !== null &&
      retiredFocusIntent.current !== focusedKey &&
      observedFocus.current !== focusedKey &&
      !pendingFocus.current
    )
      requestFocus(focusedKey)
  }, [focusedKey, manager.isFocused, receipt])
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
  const removeAdmitted: NonNullable<React.ContextType<typeof NativeTagGroupActionsContext>>["remove"] = (
    row,
    source,
    event,
  ) => {
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
  const pressAdmitted: NonNullable<React.ContextType<typeof NativeTagGroupActionsContext>>["press"] = (
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
      requestSelection(row.key, operation, metadata.pointerType === "keyboard" && metadata.nonContiguousModifier)
    }
    if (intent.enterToggle && admitted(row)) current.current.manager.setSelectionBehavior("toggle")
    if (intent.action) action(row)
  }
  const remove: NonNullable<React.ContextType<typeof NativeTagGroupActionsContext>>["remove"] = (
    row,
    source,
    event,
  ) => {
    event.persist?.()
    withNativeAdmission(row, () => removeAdmitted(row, source, event))
  }
  const press: NonNullable<React.ContextType<typeof NativeTagGroupActionsContext>>["press"] = (
    row,
    phase,
    event,
    metadata,
  ) => {
    event.persist?.()
    withNativeAdmission(row, () => pressAdmitted(row, phase, event, metadata))
  }
  const lifetime = JSON.stringify(model.map((row) => [row.key, row.isDisabled, row.textValue, row.href]))
  useLayoutEffect(() => {
    if (collection.size !== 0 || observedFocus.current === null || !manager.isFocused) return
    observedFocus.current = null
    pendingFocus.current = {
      key: null,
      node: null,
      window: focusWindowStamp(),
      commandedTarget: null,
      commandedLease: null,
    }
    setRequestedFocusKey(null)
    attemptFocusRequest()
  }, [collection.size, receipt])
  const onKeyAdmitted = (event: TNativeKeyboardEvent) => {
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
        owner.manager.clearSelection()
      return
    }
    if (data.key === "a" && (Platform.OS === "ios" ? data.metaKey : data.ctrlKey)) {
      owner.manager.selectAll()
      return
    }
    if (data.key === "Delete" || data.key === "Backspace") {
      if (row) removeAdmitted(row, "keyboard", event)
      return
    }
    if (!isNativeTagGroupNavigationKey(data.key) || (!row && tag !== findNodeHandle(list.current))) return
    if (!row && data.shiftKey && (data.key === "Home" || data.key === "End")) return
    const navigationKey = pendingFocus.current?.key ?? row?.key ?? null
    const nextKey =
      data.key === "PageUp" || data.key === "PageDown"
        ? row
          ? getNativeTagGroupPageKey(
              owner.model,
              navigationKey ?? row.key,
              data.key,
              owner.renderer.layoutDelegate,
              scroll.current !== null,
            )
          : null
        : getNativeTagGroupNavigationKey(owner.model, navigationKey, data.key, I18nManager.isRTL)
    if (nextKey === null) return
    requestFocus(nextKey)
    const operation = getNativeTagGroupNavigationSelection({
      key: data.key,
      mode: owner.props.selectionMode ?? "none",
      behavior: owner.behavior,
      isLink: owner.manager.isLink(nextKey),
      isApple: Platform.OS === "ios",
      modifiers: data,
    })
    if (operation) requestSelection(nextKey, operation, data.key === "Home" || data.key === "End")
  }
  const onKey = (event: TNativeKeyboardEvent) => {
    const data = event.nativeEvent
    if (!admitted() || data.phase !== "down" || data.cancelled || !data.nativeDefaultHandled) return
    const tag = "focusedTarget" in data && typeof data.focusedTarget === "number" ? data.focusedTarget : data.target
    const row = current.current.ordered.find(
      (entry) => findNodeHandle(entry.view.current) === tag || findNodeHandle(entry.removeView.current) === tag,
    )
    event.persist?.()
    if (row) withNativeAdmission(row, () => onKeyAdmitted(event))
    else if (tag === findNodeHandle(list.current))
      actions?.request(null, tag, () => {
        if (admitted()) onKeyAdmitted(event)
      })
  }
  const theme = useNativeTheme(),
    styles = getNativeTagGroupStyles(theme, props)
  const listProps = {
    ...nativeCompositeLabelProps(
      {
        id: props.id,
        accessibilityLabel: props.accessibilityLabel ?? props["aria-label"],
        nativeLabelledBy: nativeAccessibilityIDs(props.accessibilityLabelledBy ?? props["aria-labelledby"]),
      },
      listID,
    ),
    ref: listRef,
    role: collection.size ? ("grid" as const) : ("group" as const),
    accessible: collection.size === 0,
    focusable: true,
    accessibilityLabel: props.accessibilityLabel ?? props["aria-label"],
    accessibilityLabelledBy: props.accessibilityLabelledBy,
    nativeDescribedBy: nativeAccessibilityIDs(props.ariaDescribedBy ?? props["aria-describedby"]),
    nativeDetailsBy: nativeAccessibilityIDs(props.ariaDetails ?? props["aria-details"]),
    nativeDescriptionLabel: labels.descriptionLabel,
    nativeDetailsLabel: labels.detailsLabel,
    accessibilityHint: props.accessibilityHint,
    style: { ...styles.list, ...styles.text },
    onLayout: () => setTargetTag(findNodeHandle(list.current) ?? 0),
    accessibilityLiveRegion: focusWithin ? ("polite" as const) : ("none" as const),
    onFocus: () => {
      if (pendingFocus.current?.key === null) pendingFocus.current = null
      setFocusWithin(true)
    },
    onBlur: () => {
      setFocusWithin(false)
    },
  }
  return (
    <NativeCollectionItemBindingContext.Provider value={actions?.bindingFor(null) ?? ""}>
      <TagGroupRoot
        {...native}
        id={id}
        render={render}
        ref={ref}
        accessible={false}
        focusable={false}
        testID={testID ?? aliasTestID ?? "tag-group"}
        style={styles.root}
      >
        <NativeListStateContext.Provider value={state}>
          <NativeTagGroupStateContext.Provider value={state}>
            <NativeTagGroupActionsContext.Provider
              value={{
                text: styles.text,
                register,
                refresh,
                mode: selectionMode,
                behavior,
                labels,
                allowsRemoving: !!props.onRemove,
                disabled: isDisabled,
                selected,
                semantics: (row) =>
                  JSON.stringify({
                    kind: "cell",
                    parentTarget: targetTag,
                    rowIndex: members.findIndex((node) => node.key === row.key),
                    columnIndex: 0,
                    rowSpan: 1,
                    columnSpan: 1,
                    heading: false,
                    selected: selected(row),
                    rowHeaderTargets: [],
                    columnHeaderTargets: [],
                  } satisfies TNativeCollectionSemantics),
                actionState,
                keyCapture,
                focus: (row, value) => {
                  if (value && admitted(row)) {
                    observedFocus.current = row.key
                    retiredFocusIntent.current = null
                    if (!pendingFocus.current || pendingFocus.current.key === row.key) {
                      pendingFocus.current = null
                      setRequestedFocusKey(null)
                      setFocusedKey(row.key)
                    }
                    setFocusWithin(true)
                  } else if (!value) {
                    setFocusWithin(false)
                  }
                },
                press,
                remove,
              }}
            >
              <NativeTagListContext.Provider value={listProps}>
                <NativeCollectionSemanticsContext.Provider
                  value={JSON.stringify({
                    kind: "root",
                    rowCount: members.length,
                    columnCount: 1,
                    hierarchical: false,
                    selectionMode,
                  } satisfies TNativeCollectionSemantics)}
                >
                  <NativeTagListRenderContext.Provider
                    value={{ persistedKeys, scrollRef: scroll, defaultStyle: { ...styles.list, ...styles.text } }}
                  >
                    <NativeTagList
                      testID="tag-list"
                      renderEmptyState={renderEmptyState ?? (emptyListMessage ? () => emptyListMessage : undefined)}
                    />
                  </NativeTagListRenderContext.Provider>
                </NativeCollectionSemanticsContext.Provider>
              </NativeTagListContext.Provider>
              {input ? <KeyBindings targetTag={targetTag} lifetime={lifetime} canAct={admitted} onKey={onKey} /> : null}
            </NativeTagGroupActionsContext.Provider>
          </NativeTagGroupStateContext.Provider>
        </NativeListStateContext.Provider>
      </TagGroupRoot>
    </NativeCollectionItemBindingContext.Provider>
  )
}

const TagGroupRoot = forwardRef<TNativeTagGroupRef, TNativeFocusViewProps & Pick<TNativeTagGroupProps, "render">>(
  ({ render, ...props }, ref) =>
    render ? render({ ...props, ref }, undefined) : <NativeFocusView {...props} ref={ref} />,
)
export { NativeTagList } from "./TagList"
const TagGroupAuthoring = <T extends object>({ props }: { props: TNativeTagGroupProps<T> }) => {
  const { items, children, getKey } = props
  const supplied = useMemo(() => (items === undefined ? undefined : Array.from(items)), [items])
  if (!getKey) return <NativeTagList items={supplied}>{children}</NativeTagList>
  return supplied === undefined
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
            <NativeTagItemValueContext.Provider key={encoded} value={{ key: key!, order, value: item }}>
              {rendered}
            </NativeTagItemValueContext.Provider>
          )
        })
      })()
}
export const TagGroup = forwardRef(
  <T extends object>(authoredProps: TNativeTagGroupProps<T>, forwardedRef: ForwardedRef<TNativeTagGroupRef>) => {
    const [props, ref] = useNativeContextProps(authoredProps, forwardedRef, NativeTagGroupContext)
    return (
      <NativeListStateContext.Provider value={null}>
        <NativeCollectionBuilder<T> content={<TagGroupAuthoring props={props} />}>
          {(collection, receipt) => (
            <NativeTagGroup props={props} forwardedRef={ref} collection={collection} receipt={receipt} />
          )}
        </NativeCollectionBuilder>
      </NativeListStateContext.Provider>
    )
  },
) as <T extends object>(props: TNativeTagGroupProps<T> & RefAttributes<TNativeTagGroupRef>) => ReactNode
