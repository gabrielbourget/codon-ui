/* Native counterpart of pinned RAC ListBox; Apache-2.0. See ../../collection/LICENSE.react-aria.md. */
import {
  createContext,
  forwardRef,
  useContext,
  useCallback,
  useInsertionEffect,
  useLayoutEffect,
  useRef,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
  type RefAttributes,
  type RefObject,
} from "react"
import {
  ScrollView,
  findNodeHandle,
  type ScrollViewProps,
  type StyleProp,
  type TextStyle,
  type View,
  type ViewStyle,
} from "react-native"

import { NativeCollectionActionsContext } from "../../collection/actions"
import { NativeCollectionItemBindingContext } from "../../collection/binding"
import { useNativeCollectionRefs, useNativeContextProps, type TNativeSlotProps } from "../../collection/context"
import { NativeSelectableCollectionContext } from "../../collection/context"
import {
  NativeCollectionRendererContext,
  useNativePersistedKeys,
  type TNativeCollectionScrollHost,
} from "../../collection/renderer"
import { NativeCollectionSemanticsContext, type TNativeCollectionSemantics } from "../../collection/semantics"
import type { TNativeCollectionNode, TNativeCollectionSnapshot } from "../../collection/snapshot"
import type { TNativeCollectionKey } from "../../collection/snapshot"
import { NativeListStateContext } from "../../collection/state"
import { UNSTABLE_useFilteredListState } from "../../collection/state/useListState"
import { focusNativeTarget } from "../../input/focus"
import { NativeFocusHost } from "../../input/NativeFocusView"
import { useNativeKeyScope } from "../../input/NativeKeyboardScope"
import type { TNativeFocusViewProps } from "../../input/types"
import { useNativeTheme } from "../../theme"
import { getNativeButtonContent } from "../Button/content"
import { resolveNativeStyle } from "../colors"
import { NativeContentContext, useNativeContentContext } from "../NativeContentContext"
import { splitNativeTextStyle } from "../nativeTextStyle"

import { NativeComboBoxListContext, NativeComboBoxStateContext } from "./collectionContext"
import { createNativeComboBoxListMetrics, type TNativeComboBoxListMetrics } from "./navigation"
import type { ComboBoxState } from "./state/types"

export type TNativeComboBoxListRenderState = Readonly<{
  isEmpty: boolean
  isFocused: boolean
  isFocusVisible: boolean
  isDropTarget: boolean
  layout: "stack" | "grid"
  orientation: "vertical" | "horizontal"
  state: ComboBoxState<object>
}>
export type TNativeComboBoxListProps = Omit<TNativeFocusViewProps, "children" | "style"> &
  TNativeSlotProps & {
    autoFocus?: boolean | "first" | "last"
    shouldUseVirtualFocus?: boolean
    shouldSelectOnPressUp?: boolean
    shouldFocusOnHover?: boolean
    linkBehavior?: "selection"
    itemBehavior?: "action"
    shouldFocusWrap?: boolean
    onAction?: (key: TNativeCollectionKey) => void
    layout?: "stack" | "grid"
    orientation?: "vertical" | "horizontal"
    style?:
      | StyleProp<TextStyle>
      | ((state: TNativeComboBoxListRenderState & { defaultStyle: TextStyle }) => StyleProp<TextStyle>)
    render?: (props: TNativeFocusViewProps & RefAttributes<View>, state: TNativeComboBoxListRenderState) => ReactElement
    renderEmptyState?: (state: TNativeComboBoxListRenderState) => ReactNode
    onScroll?: ScrollViewProps["onScroll"]
  }
type TEnvironment = Readonly<{
  scrollRef: RefObject<TNativeCollectionScrollHost | null>
  isOpen: boolean
  isCollectionPending: boolean
  metrics?: RefObject<TNativeComboBoxListMetrics>
  contentRef?: RefObject<View | null>
}>
export const NativeComboBoxListEnvironmentContext = createContext<TEnvironment | null>(null)
export const NativeComboBoxListBehaviorContext = createContext<
  Readonly<{
    shouldUseVirtualFocus: boolean
    shouldSelectOnPressUp: boolean
    shouldFocusOnHover: boolean
    shouldFocusWrap: boolean
    onAction?: (key: TNativeCollectionKey) => void
    textStyle?: TextStyle
    parentTarget: number
    ordinals: ReadonlyMap<TNativeCollectionKey, number>
  }>
>({
  shouldUseVirtualFocus: true,
  shouldSelectOnPressUp: true,
  shouldFocusOnHover: true,
  shouldFocusWrap: true,
  parentTarget: 0,
  ordinals: new Map(),
})

const firstEnabled = (state: ComboBoxState<object>, last: boolean) => {
  const collection = state.collection
  let key = last ? collection.getLastKey() : collection.getFirstKey()
  while (key != null) {
    const node = collection.getItem(key)
    if (node?.type === "item" && !state.selectionManager.isDisabled(key)) return key
    key = last ? collection.getKeyBefore(key) : collection.getKeyAfter(key)
  }
  return null
}

// The collection manager's virtual focus is independent of original editor keyboard focus.
export const NativeComboBoxList = forwardRef<View, TNativeComboBoxListProps>((authored, forwardedRef) => {
  const [scoped, inheritedRef] = useNativeContextProps(authored, forwardedRef, NativeComboBoxListContext)
  const [props, selectedRef] = useNativeContextProps(scoped, inheritedRef, NativeSelectableCollectionContext)
  const inputState = useContext(NativeComboBoxStateContext)
  if (!inputState) throw new Error("ComboBoxList requires a native collection ComboBox")
  const {
    autoFocus = false,
    shouldUseVirtualFocus = true,
    shouldSelectOnPressUp = true,
    shouldFocusOnHover = true,
    shouldFocusWrap = true,
    onAction,
    linkBehavior: _linkBehavior,
    itemBehavior: _itemBehavior,
    filter,
    disallowTypeAhead: _disallowTypeAhead,
    slot: _slot,
    layout = "stack",
    orientation = "vertical",
    style,
    render,
    renderEmptyState,
    onScroll,
    ...native
  } = props
  const nativeFilter = useMemo<Parameters<typeof UNSTABLE_useFilteredListState<object>>[1]>(
    () => (filter ? (text, node) => filter(text, node as TNativeCollectionNode<object>) : undefined),
    [filter],
  )
  const filtered = UNSTABLE_useFilteredListState(inputState, nativeFilter)
  const state = useMemo(
    () => ({ ...inputState, ...filtered, collection: filtered.collection as TNativeCollectionSnapshot<object> }),
    [inputState, filtered],
  )
  const environment = useContext(NativeComboBoxListEnvironmentContext)
  const metrics = environment?.metrics
  useInsertionEffect(() => {
    if (metrics) metrics.current = createNativeComboBoxListMetrics()
    return () => {
      if (metrics) metrics.current = { ...createNativeComboBoxListMetrics(), revision: metrics.current.revision + 1 }
    }
  }, [metrics])
  const renderer = useContext(NativeCollectionRendererContext)
  const { CollectionRoot } = renderer
  const fallbackScroll = useRef<TNativeCollectionScrollHost | null>(null)
  const scroll = environment?.scrollRef ?? fallbackScroll
  const persistedKeys = useNativePersistedKeys(state.selectionManager.focusedKey)
  const actions = useContext(NativeCollectionActionsContext)
  const original = useRef<View | null>(null)
  const live = useRef(false)
  const [parentTarget, setParentTarget] = useState(0)
  const bindOriginal = useCallback((target: View | null) => {
    original.current = target
    if (live.current) setParentTarget(target ? (findNodeHandle(target) ?? 0) : 0)
  }, [])
  const ref = useNativeCollectionRefs(selectedRef, bindOriginal)
  const ordinals = useMemo(() => {
    const result = new Map<TNativeCollectionKey, number>()
    let key = state.collection.getFirstKey()
    while (key != null) {
      if (state.collection.getItem(key)?.type === "item") result.set(key, result.size)
      key = state.collection.getKeyAfter(key)
    }
    return result
  }, [state.collection])
  const autoFocusPending = useRef(autoFocus)
  const focusAttempt = useRef<{ target: View; binding: string } | null>(null)
  const current = useRef({ props, state, environment, actions })
  useInsertionEffect(() => {
    current.current = { props, state, environment, actions }
  })
  useInsertionEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])
  const scope = useNativeKeyScope()
  useSyncExternalStore(scope?.subscribe ?? (() => () => {}), scope?.snapshot ?? (() => 0), () => 0)
  const active = () =>
    live.current &&
    original.current !== null &&
    scope?.isWindowActive() !== false &&
    current.current.environment?.isOpen !== false
  const [observedFocused, setObservedFocused] = useState(false)
  const [observedVisible, setObservedVisible] = useState(false)
  const observedFocus = useRef(false)
  useLayoutEffect(
    () =>
      scope?.subscribe(() => {
        if (scope.isWindowActive() === false) {
          observedFocus.current = false
          setObservedFocused(false)
          setObservedVisible(false)
        } else if (observedFocus.current && scope.lastInput())
          setObservedVisible(scope.lastInput()!.origin === "keyboard")
      }),
    [scope],
  )
  useLayoutEffect(() => {
    const owner = current.current
    if (!active() || !autoFocusPending.current || owner.environment?.isCollectionPending) return
    const manager = owner.state.selectionManager
    let key = autoFocus === "first" || autoFocus === "last" ? firstEnabled(owner.state, autoFocus === "last") : null
    for (const selected of manager.selectedKeys)
      if (manager.canSelectItem(selected)) {
        key = selected
        break
      }
    manager.setFocused(true)
    manager.setFocusedKey(key)
    const target = original.current,
      binding = actions?.bindingFor(null)
    if (
      !shouldUseVirtualFocus &&
      key == null &&
      target &&
      binding &&
      (focusAttempt.current?.target !== target || focusAttempt.current.binding !== binding)
    ) {
      focusAttempt.current = { target, binding }
      actions?.request(null, findNodeHandle(target) ?? 0, () => {
        const owner = current.current
        if (
          active() &&
          original.current === target &&
          owner.props.shouldUseVirtualFocus === false &&
          owner.actions?.bindingFor(null) === binding &&
          !owner.environment?.isCollectionPending &&
          owner.state.selectionManager.isFocused &&
          owner.state.selectionManager.focusedKey == null
        )
          focusNativeTarget(target)
      })
    }
    if (owner.state.collection.size > 0) autoFocusPending.current = false
  })
  useLayoutEffect(() => {
    const key = state.selectionManager.focusedKey
    if (!active() || !state.selectionManager.isFocused || key == null) return
    renderer.layoutDelegate?.requestRendering?.(key)
    renderer.layoutDelegate?.scrollToKey?.(key)
  }, [state.selectionManager.focusedKey, state.selectionManager.isFocused, renderer.layoutDelegate])
  const flags: TNativeComboBoxListRenderState = {
    isEmpty: state.collection.size === 0,
    isFocused: observedFocused,
    isFocusVisible: observedFocused && observedVisible,
    isDropTarget: false,
    layout,
    orientation,
    state,
  }
  const theme = useNativeTheme()
  const inheritedContent = useNativeContentContext()
  const defaultStyle: ViewStyle = {}
  const resolved = typeof style === "function" ? style({ ...flags, defaultStyle }) : style
  const styles = splitNativeTextStyle(resolveNativeStyle(resolved, "ComboBoxList", "style"))
  const content = (
    <>
      <CollectionRoot
        collection={state.collection}
        persistedKeys={persistedKeys}
        scrollRef={scroll}
        onScroll={renderer.isVirtualized ? onScroll : undefined}
      />
      {flags.isEmpty &&
        renderEmptyState &&
        getNativeButtonContent(renderEmptyState(flags), { ...inheritedContent?.textStyle, ...styles.text })}
    </>
  )
  const host = {
    ...native,
    ref,
    role: native.role ?? ("list" as const),
    accessible: native.accessible ?? false,
    focusable: native.focusable ?? !shouldUseVirtualFocus,
    style: styles.view,
    onFocus: (event: Parameters<NonNullable<TNativeFocusViewProps["onFocus"]>>[0]) => {
      if (!active()) return
      observedFocus.current = true
      setObservedFocused(true)
      setObservedVisible(event.nativeEvent.isFocusVisible)
      current.current.state.selectionManager.setFocused(true)
      current.current.props.onFocus?.(event)
    },
    onBlur: (event: Parameters<NonNullable<TNativeFocusViewProps["onBlur"]>>[0]) => {
      if (!active()) return
      observedFocus.current = false
      setObservedFocused(false)
      setObservedVisible(false)
      current.current.state.selectionManager.setFocused(false)
      current.current.props.onBlur?.(event)
    },
    onLayout: (event: Parameters<NonNullable<TNativeFocusViewProps["onLayout"]>>[0]) => {
      if (!live.current) return
      setParentTarget(original.current ? (findNodeHandle(original.current) ?? 0) : 0)
      current.current.props.onLayout?.(event)
    },
    children: (
      <NativeCollectionSemanticsContext.Provider value="">
        <NativeContentContext.Provider
          value={{
            foregroundColor: styles.text.color ?? inheritedContent?.foregroundColor ?? theme.colors.foreground,
            isButton: false,
            textStyle: { ...inheritedContent?.textStyle, ...styles.text },
          }}
        >
          <NativeComboBoxListContext.Provider value={props}>
            <NativeComboBoxStateContext.Provider value={state}>
              <NativeListStateContext.Provider value={state}>
                <NativeComboBoxListBehaviorContext.Provider
                  value={{
                    shouldUseVirtualFocus,
                    shouldSelectOnPressUp,
                    shouldFocusOnHover,
                    shouldFocusWrap,
                    onAction,
                    textStyle: styles.text,
                    parentTarget,
                    ordinals,
                  }}
                >
                  <NativeCollectionItemBindingContext.Provider value={actions?.bindingFor(null) ?? ""}>
                    {renderer.isVirtualized ? (
                      content
                    ) : (
                      <ScrollView
                        ref={scroll as React.Ref<ScrollView>}
                        innerViewRef={environment?.contentRef as RefObject<View>}
                        testID={native.testID ? `${native.testID}-scroll` : undefined}
                        keyboardShouldPersistTaps="always"
                        keyboardDismissMode="none"
                        onContentSizeChange={(width, height) => {
                          if (metrics)
                            metrics.current = {
                              ...metrics.current,
                              revision: metrics.current.revision + 1,
                              content:
                                Number.isFinite(width) && Number.isFinite(height) && width >= 0 && height >= 0
                                  ? { width, height }
                                  : null,
                            }
                        }}
                        onScroll={(event) => {
                          if (metrics)
                            metrics.current = {
                              ...metrics.current,
                              revision: metrics.current.revision + 1,
                            }
                          onScroll?.(event)
                        }}
                        style={{ maxHeight: 280 }}
                      >
                        {content}
                      </ScrollView>
                    )}
                  </NativeCollectionItemBindingContext.Provider>
                </NativeComboBoxListBehaviorContext.Provider>
              </NativeListStateContext.Provider>
            </NativeComboBoxStateContext.Provider>
          </NativeComboBoxListContext.Provider>
        </NativeContentContext.Provider>
      </NativeCollectionSemanticsContext.Provider>
    ),
  }
  return (
    <NativeCollectionItemBindingContext.Provider value={actions?.bindingFor(null) ?? ""}>
      <NativeCollectionSemanticsContext.Provider
        value={JSON.stringify({ kind: "list-root", count: ordinals.size } satisfies TNativeCollectionSemantics)}
      >
        {render ? render(host, flags) : <NativeFocusHost {...host} />}
      </NativeCollectionSemanticsContext.Provider>
    </NativeCollectionItemBindingContext.Provider>
  )
})
NativeComboBoxList.displayName = "NativeComboBoxList"
