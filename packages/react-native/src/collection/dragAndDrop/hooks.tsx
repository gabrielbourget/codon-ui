/* Copyright Adobe. Apache-2.0; see ../LICENSE.react-aria.md. Native refs/events replace DOM ownership. */
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useImperativeHandle,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import type { ComponentPropsWithRef, ForwardedRef, ReactElement, ReactNode, RefAttributes, RefObject } from "react"
import { findNodeHandle, View } from "react-native"
import type { StyleProp, ViewStyle } from "react-native"

import type { TNativeButtonProps } from "../../components/Button/types"
import { nativeKeyTokens } from "../../input/keyScope"
import { NativeFocusHost } from "../../input/NativeFocusView"
import { useNativeDragActions } from "../../input/NativeKeyboardScope"
import type { TNativeFocusViewProps, TNativeKeyboardEvent, TNativePressEvent } from "../../input/types"
import { useNativeLocale } from "../../locale/NativeLocaleProvider"
import { useNativeTheme } from "../../theme"
import { useNativeCollectionRefs } from "../context"
import { NativeCollectionSemanticsContext } from "../semantics"
import type { TNativeCollectionKey } from "../snapshot"

import { nativeDragFormatter } from "./messages"
import { NativeCollectionDragBinding } from "./NativeCollectionDragBinding"
import type { TNativeDropCollectionOptions } from "./NativeCollectionDragBinding"
import { NativeListDropTargetDelegate } from "./NativeListDropTargetDelegate"
import type {
  TNativeDragItem,
  TNativeDraggableCollectionProps,
  TNativeDroppableCollectionProps,
  TNativeDragPreviewRenderer,
  TNativeDragPreviewContent,
  TNativeDropTarget,
  TNativeDropTargetDelegate,
} from "./types"
import { useNativeDraggableCollectionState } from "./useNativeDraggableCollectionState"
import type {
  TNativeDraggableCollectionState,
  TNativeDraggableCollectionStateOptions,
} from "./useNativeDraggableCollectionState"
import { useNativeDroppableCollectionState } from "./useNativeDroppableCollectionState"
import type {
  TNativeDroppableCollectionState,
  TNativeDroppableCollectionStateOptions,
} from "./useNativeDroppableCollectionState"
import { nativeVirtualDrag } from "./virtualDrag"

export type TNativeDragElementProps = ComponentPropsWithRef<typeof NativeFocusHost>
export type TNativeDraggableItemProps = { key: TNativeCollectionKey; hasDragButton?: boolean; hasAction?: boolean }
export type TNativeDraggableItemResult = {
  dragProps: TNativeDragElementProps
  dragButtonProps: TNativeButtonProps & RefAttributes<View>
}
export type TNativeDroppableItemOptions = { target: TNativeDropTarget; activateButtonRef?: RefObject<View | null> }
export type TNativeDroppableItemResult = { dropProps: TNativeDragElementProps; isDropTarget: boolean }
export type TNativeDropIndicatorAria = {
  dropIndicatorProps: TNativeDragElementProps
  isDropTarget: boolean
  isHidden: boolean
}
export type TNativeDropIndicatorRenderProps = { isDropTarget: boolean }
export type TNativeDropIndicatorProps = TNativeDroppableItemOptions &
  Omit<TNativeFocusViewProps, "children" | "style"> & {
    children?: ReactNode | ((state: TNativeDropIndicatorRenderProps) => ReactNode)
    style?:
      | StyleProp<ViewStyle>
      | ((state: TNativeDropIndicatorRenderProps & { defaultStyle: ViewStyle }) => StyleProp<ViewStyle>)
  }
export type TNativeDragAndDropOptions<T = object> = Omit<TNativeDraggableCollectionProps<T>, "getItems" | "preview"> &
  TNativeDroppableCollectionProps & {
    getItems?: TNativeDraggableCollectionProps<T>["getItems"]
    isDisabled?: boolean
    renderDragPreview?: (items: TNativeDragItem[]) => TNativeDragPreviewContent
    renderDropIndicator?: (target: TNativeDropTarget) => ReactElement
    dropTargetDelegate?: TNativeDropTargetDelegate
  }
export type TNativeDragAndDropHooks<T = object> = {
  useDraggableCollectionState?: (
    props: Omit<TNativeDraggableCollectionStateOptions<T>, "getItems">,
  ) => TNativeDraggableCollectionState
  useDraggableCollection?: (props: object, state: TNativeDraggableCollectionState, ref: RefObject<View | null>) => void
  useDraggableItem?: (
    props: TNativeDraggableItemProps,
    state: TNativeDraggableCollectionState,
  ) => TNativeDraggableItemResult
  DragPreview?: typeof NativeDragPreview
  renderDragPreview?: TNativeDragAndDropOptions<T>["renderDragPreview"]
  isVirtualDragging?: () => boolean
  useDroppableCollectionState?: (props: TNativeDroppableCollectionStateOptions) => TNativeDroppableCollectionState
  useDroppableCollection?: (
    props: TNativeDropCollectionOptions,
    state: TNativeDroppableCollectionState,
    ref: RefObject<View | null>,
  ) => { collectionProps: TNativeDragElementProps }
  useDroppableItem?: (
    props: TNativeDroppableItemOptions,
    state: TNativeDroppableCollectionState,
    ref: RefObject<View | null>,
  ) => TNativeDroppableItemResult
  useDropIndicator?: (
    props: TNativeDroppableItemOptions,
    state: TNativeDroppableCollectionState,
    ref: RefObject<View | null>,
  ) => TNativeDropIndicatorAria
  renderDropIndicator?: TNativeDragAndDropOptions<T>["renderDropIndicator"]
  dropTargetDelegate?: TNativeDropTargetDelegate
  ListDropTargetDelegate?: typeof NativeListDropTargetDelegate
}
export type TNativeDragAndDrop<T = object> = { dragAndDropHooks: TNativeDragAndDropHooks<T> }
export type TNativeDragAndDropContextValue = {
  dragAndDropHooks?: TNativeDragAndDropHooks
  dragState?: TNativeDraggableCollectionState
  dropState?: TNativeDroppableCollectionState
}
export const NativeDragAndDropContext = createContext<TNativeDragAndDropContextValue>({})
export const NativeDropIndicatorContext = createContext<{
  render: (props: TNativeDropIndicatorProps, ref: ForwardedRef<View>) => ReactNode
} | null>(null)
const roots = new WeakMap<RefObject<View | null>, Map<object | null, NativeCollectionDragBinding>>()
const dragRoots = new WeakMap<TNativeDraggableCollectionState, NativeCollectionDragBinding>()
const dropRoots = new WeakMap<TNativeDroppableCollectionState, NativeCollectionDragBinding>()
const dragKeys = [
  "Enter",
  "Escape",
  "Tab",
  "ArrowDown",
  "ArrowUp",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageDown",
  "PageUp",
].flatMap(nativeKeyTokens)
const useVirtual = () =>
  useSyncExternalStore(nativeVirtualDrag.subscribe, nativeVirtualDrag.snapshot, nativeVirtualDrag.snapshot)
const useRoot = (ref: RefObject<View | null>) => {
  const scope = useNativeDragActions()
  const [failure, setFailure] = useState<{ error: unknown } | null>(null)
  let byScope = roots.get(ref)
  if (!byScope) {
    byScope = new Map()
    roots.set(ref, byScope)
  }
  let runtime = byScope.get(scope)
  if (!runtime) {
    runtime = new NativeCollectionDragBinding(ref, scope)
    byScope.set(scope, runtime)
  }
  const current = runtime
  useInsertionEffect(() =>
    current.configure(
      () => true,
      (error) => setFailure({ error }),
    ),
  )
  useSyncExternalStore(current.controller.subscribe, current.controller.snapshot, current.controller.snapshot)
  useVirtual()
  if (failure) throw failure.error
  return current
}
const rootFor = (state: TNativeDraggableCollectionState | TNativeDroppableCollectionState) => {
  const root = "draggingKeys" in state ? dragRoots.get(state) : dropRoots.get(state)
  if (!root) throw new Error("Native drag/drop item requires its original collection hook")
  return root
}
export const useNativeDraggableCollection = (
  _props: object,
  state: TNativeDraggableCollectionState,
  ref: RefObject<View | null>,
) => {
  const root = useRoot(ref),
    owner = useRef({})
  dragRoots.set(state, root)
  useInsertionEffect(() => root.acquire(owner.current), [root])
  useInsertionEffect(() => {
    root.source = state
    root.sourceEnabled = true
  })
  useLayoutEffect(root.publish)
}
export const useNativeDroppableCollection = (
  props: TNativeDropCollectionOptions,
  state: TNativeDroppableCollectionState,
  ref: RefObject<View | null>,
) => {
  const root = useRoot(ref),
    owner = useRef({}),
    locale = useNativeLocale()
  dropRoots.set(state, root)
  useInsertionEffect(() => root.acquire(owner.current), [root])
  useInsertionEffect(() => {
    root.target = state
    root.targetEnabled = true
    root.dropOptions = { ...props, direction: locale.direction }
  })
  useLayoutEffect(root.publish)
  useLayoutEffect(() => nativeVirtualDrag.register(root), [root])
  return {
    collectionProps: {
      capturedKeys: nativeVirtualDrag.isDragging() ? dragKeys : undefined,
      onKeyDown: (event: TNativeKeyboardEvent) => {
        if (!nativeVirtualDrag.key(event)) props.onKeyDown?.(event)
      },
      onKeyUp: (event: TNativeKeyboardEvent) => {
        nativeVirtualDrag.key(event, true)
      },
    },
  }
}
const virtualPress = (event: TNativePressEvent) =>
  "kind" in event.nativeEvent && (event.nativeEvent.kind === "keyboard" || event.nativeEvent.kind === "activation")
export const useNativeDraggableItem = (
  props: TNativeDraggableItemProps,
  state: TNativeDraggableCollectionState,
): TNativeDraggableItemResult => {
  const root = rootFor(state),
    owner = useRef({}),
    key = props.key,
    locale = useNativeLocale()
  useVirtual()
  const formatter = useMemo(() => nativeDragFormatter(locale.locale), [locale.locale])
  const disabled = !!state.isDisabled || state.selectionManager.isDisabled(key)
  const ref = useCallback((view: View | null) => root.member(key, owner.current, view), [root, key])
  const handleRef = useCallback((view: View | null) => root.handle(key, view), [root, key])
  useLayoutEffect(() => () => root.member(key, owner.current, null), [root, key])
  const count = state.getKeysForDrag(key).size,
    selected = count > 1 && state.selectionManager.isSelected(key)
  const text = state.collection.getTextValue?.(key) ?? state.collection.getItem(key)?.textValue ?? ""
  const label = selected
    ? formatter.format("dragSelectedItems", { count })
    : formatter.format("dragItem", { itemText: text })
  const description = formatter.format(
    `${selected ? "dragSelectedKeyboard" : "dragDescriptionKeyboard"}${props.hasAction ? "Alt" : ""}`,
    { count },
  )
  const begin = (mode: "keyboard" | "virtual", source: "source" | "handle" = "source") =>
    nativeVirtualDrag.start(root, key, formatter, mode, source).catch((error) => root.fail(error))
  const acceptsKey = (event: TNativeKeyboardEvent) => {
    const data = event.nativeEvent
    return (
      !disabled &&
      data.target === findNodeHandle(root.rowView(key)) &&
      data.key === "Enter" &&
      !data.repeat &&
      (!props.hasAction || data.altKey) &&
      !data.ctrlKey &&
      !data.metaKey
    )
  }
  const down = (event: TNativeKeyboardEvent) => {
    if (nativeVirtualDrag.key(event)) return
    if (acceptsKey(event)) {
      event.preventDefault()
      event.stopPropagation()
    }
  }
  const up = (event: TNativeKeyboardEvent) => {
    if (nativeVirtualDrag.key(event, true)) return
    if (acceptsKey(event)) {
      event.preventDefault()
      event.stopPropagation()
      begin("keyboard")
    }
  }
  return {
    dragProps: disabled
      ? {}
      : {
          ref,
          nativePressable: !props.hasDragButton,
          onNativeActivation: props.hasDragButton
            ? undefined
            : () => {
                if (nativeVirtualDrag.isDragging()) nativeVirtualDrag.cancel().catch((error) => root.fail(error))
                else begin("virtual")
              },
          accessibilityHint: props.hasDragButton ? undefined : description,
          capturedKeys: props.hasDragButton ? undefined : dragKeys,
          onKeyDown: props.hasDragButton ? undefined : down,
          onKeyUp: props.hasDragButton ? undefined : up,
          accessibilityActions: props.hasDragButton ? undefined : [{ name: "activate", label }],
          onAccessibilityAction: props.hasDragButton
            ? undefined
            : (event) => {
                if (event.nativeEvent.actionName === "activate") {
                  if (nativeVirtualDrag.isDragging()) nativeVirtualDrag.cancel().catch((error) => root.fail(error))
                  else begin("virtual")
                }
              },
        },
    dragButtonProps: {
      ref: handleRef,
      isDisabled: disabled,
      accessibilityLabel: label,
      accessibilityHint: description,
      onPress: (event) => {
        if (virtualPress(event)) {
          if (nativeVirtualDrag.isDragging()) nativeVirtualDrag.cancel().catch((error) => root.fail(error))
          else
            begin(
              "kind" in event.nativeEvent && event.nativeEvent.kind === "keyboard" ? "keyboard" : "virtual",
              "handle",
            )
        }
      },
    },
  }
}
const useDroppableItemBinding = (
  options: TNativeDroppableItemOptions,
  state: TNativeDroppableCollectionState,
  ref: RefObject<View | null>,
  label?: string,
): TNativeDroppableItemResult => {
  const root = rootFor(state),
    owner = useRef({}),
    locale = useNativeLocale(),
    source = useRef({ options, label })
  useInsertionEffect(() => {
    source.current = { options, label }
  })
  useVirtual()
  useLayoutEffect(() => {
    const target = options.target
    if (target.type === "item" && target.dropPosition === "on")
      root.member(target.key, owner.current, ref.current, "target")
    nativeVirtualDrag.endpoint(owner.current, {
      root,
      target,
      view: () => ref.current,
      activate: () => source.current.options.activateButtonRef?.current ?? null,
      label: () => source.current.label ?? "",
    })
  })
  useLayoutEffect(
    () => () => {
      const target = source.current.options.target
      if (target.type === "item" && target.dropPosition === "on") root.member(target.key, owner.current, null, "target")
      nativeVirtualDrag.endpoint(owner.current, null)
    },
    [root],
  )
  const session = nativeVirtualDrag.active()
  const valid =
    !session || root.operation(options.target, session.types, session.operations, session.source) !== "cancel"
  const isDropTarget = state.isDropTarget(options.target)
  return {
    dropProps: {
      nativePressable: !!session && valid,
      onNativeActivation: () => {
        if (nativeVirtualDrag.choose(root, options.target)) nativeVirtualDrag.drop().catch((error) => root.fail(error))
      },
      accessibilityActions:
        session && valid
          ? [
              { name: "activate", label: label ?? nativeDragFormatter(locale.locale).format("dropOnRoot") },
              { name: "escape", label: nativeDragFormatter(locale.locale).format("dropCanceled") },
            ]
          : undefined,
      accessibilityElementsHidden: !valid,
      importantForAccessibility: valid ? "auto" : "no-hide-descendants",
      onKeyDown: (event) => {
        nativeVirtualDrag.key(event)
      },
      onKeyUp: (event) => {
        nativeVirtualDrag.key(event, true)
      },
      onAccessibilityAction: (event) => {
        if (event.nativeEvent.actionName === "activate" && nativeVirtualDrag.choose(root, options.target))
          nativeVirtualDrag.drop().catch((error) => root.fail(error))
        else if (event.nativeEvent.actionName === "escape")
          nativeVirtualDrag.cancel().catch((error) => root.fail(error))
      },
    },
    isDropTarget,
  }
}
export const useNativeDroppableItem = (
  options: TNativeDroppableItemOptions,
  state: TNativeDroppableCollectionState,
  ref: RefObject<View | null>,
) => useDroppableItemBinding(options, state, ref)
export const useNativeDropIndicator = (
  props: TNativeDroppableItemOptions,
  state: TNativeDroppableCollectionState,
  ref: RefObject<View | null>,
): TNativeDropIndicatorAria => {
  const locale = useNativeLocale(),
    formatter = nativeDragFormatter(locale.locale)
  const target = props.target,
    collection = state.collection
  const text = (key: TNativeCollectionKey | null | undefined) =>
    key == null ? "" : (collection.getTextValue?.(key) ?? collection.getItem(key)?.textValue ?? "")
  let label: string
  if (target.type === "root")
    label = [formatter.format("dropOnRoot"), rootFor(state).dropOptions.rootLabel].filter(Boolean).join(" ")
  else if (target.dropPosition === "on") label = formatter.format("dropOnItem", { itemText: text(target.key) })
  else {
    const node = collection.getItem(target.key)
    const previous = node?.prevKey != null ? collection.getItem(node.prevKey) : null
    const next = node?.nextKey != null ? collection.getItem(node.nextKey) : null
    const before = target.dropPosition === "before" ? (previous?.type === "item" ? previous.key : null) : target.key
    const after = target.dropPosition === "after" ? (next?.type === "item" ? next.key : null) : target.key
    label =
      before != null && after != null
        ? formatter.format("insertBetween", { beforeItemText: text(before), afterItemText: text(after) })
        : before != null
          ? formatter.format("insertAfter", { itemText: text(before) })
          : formatter.format("insertBefore", { itemText: text(after) })
  }
  const result = useDroppableItemBinding(props, state, ref, label)
  const hidden = !nativeVirtualDrag.isDragging() || !!result.dropProps.accessibilityElementsHidden
  return {
    dropIndicatorProps: {
      ...result.dropProps,
      accessibilityLabel: label,
      focusable: true,
      accessible: !hidden,
      accessibilityElementsHidden: hidden,
      importantForAccessibility: hidden ? "no-hide-descendants" : "auto",
      role: "button",
      accessibilityHint: formatter.format("dropIndicator"),
      capturedKeys: dragKeys,
      nativeTabStop: false,
    },
    isDropTarget: result.isDropTarget,
    isHidden: !result.isDropTarget && hidden,
  }
}
export const NativeDropIndicator = forwardRef<View, TNativeDropIndicatorProps>((props, ref) => {
  const context = useContext(NativeDropIndicatorContext)
  if (!context) throw new Error("NativeDropIndicator requires a drag/drop collection")
  return <>{context.render(props, ref)}</>
})
export const NativeCollectionDropIndicator = forwardRef<View, TNativeDropIndicatorProps>((props, ref) => {
  const context = useContext(NativeDragAndDropContext),
    theme = useNativeTheme(),
    original = useRef<View | null>(null)
  const merged = useNativeCollectionRefs(ref, original)
  if (!context.dropState || !context.dragAndDropHooks?.useDropIndicator)
    throw new Error("Native drop indicator requires the original drop state/hooks")
  const aria = context.dragAndDropHooks.useDropIndicator(props, context.dropState, original)
  if (aria.isHidden) return null
  const state = { isDropTarget: aria.isDropTarget },
    defaults: ViewStyle = { height: 2, backgroundColor: theme.colors.controlBorder, width: "100%" }
  const { target: _target, activateButtonRef: _activate, style, children, ...native } = props
  return (
    <NativeCollectionSemanticsContext.Provider value="">
      <NativeFocusHost
        {...native}
        {...aria.dropIndicatorProps}
        ref={merged}
        style={typeof style === "function" ? style({ ...state, defaultStyle: defaults }) : [defaults, style]}
      >
        {typeof children === "function" ? children(state) : children}
      </NativeFocusHost>
    </NativeCollectionSemanticsContext.Provider>
  )
})
export const NativeDragPreview = forwardRef<
  TNativeDragPreviewRenderer,
  { children: (items: TNativeDragItem[]) => TNativeDragPreviewContent }
>((props, ref) => {
  const [request, setRequest] = useState<{
    items: TNativeDragItem[]
    callback: (view: View | null, x?: number, y?: number) => void
  } | null>(null)
  const view = useRef<View | null>(null),
    context = useContext(NativeDragAndDropContext)
  useImperativeHandle(ref, () => (items, callback) => setRequest({ items, callback }), [])
  const content = request ? props.children(request.items) : null
  const rendered = content && "element" in content ? content.element : content
  const x = content && "element" in content ? content.x : 0,
    y = content && "element" in content ? content.y : 0
  useLayoutEffect(() => {
    if (!request || !view.current) return
    request.callback(view.current, x, y)
    return () => request.callback(null)
  }, [request, x, y])
  useLayoutEffect(() => {
    if (!context.dragState?.draggingKeys.size) setRequest(null)
  }, [context.dragState?.draggingKeys.size])
  if (!request) return null
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: "absolute", left: -1000000, top: 0 }}
    >
      <View ref={view} collapsable={false}>
        {rendered}
      </View>
    </View>
  )
})
export const useNativeDragAndDrop = <T,>(options: TNativeDragAndDropOptions<T>): TNativeDragAndDrop<T> => {
  const hooks = useMemo(() => {
    const value: TNativeDragAndDropHooks<T> = {}
    if (options.getItems) {
      value.useDraggableCollectionState = (props) =>
        useNativeDraggableCollectionState({ ...props, ...options, getItems: options.getItems! })
      value.useDraggableCollection = useNativeDraggableCollection
      value.useDraggableItem = useNativeDraggableItem
      value.DragPreview = NativeDragPreview
      value.renderDragPreview = options.renderDragPreview
      value.isVirtualDragging = nativeVirtualDrag.isDragging
    }
    if (
      options.onDrop ||
      options.onInsert ||
      options.onItemDrop ||
      options.onReorder ||
      options.onMove ||
      options.onRootDrop
    ) {
      value.useDroppableCollectionState = (props) => useNativeDroppableCollectionState({ ...props, ...options })
      value.useDroppableCollection = (props, state, ref) =>
        useNativeDroppableCollection({ ...props, ...options }, state, ref)
      value.useDroppableItem = useNativeDroppableItem
      value.useDropIndicator = useNativeDropIndicator
      value.renderDropIndicator = options.renderDropIndicator
      value.dropTargetDelegate = options.dropTargetDelegate
      value.ListDropTargetDelegate = NativeListDropTargetDelegate
    }
    return value
  }, [options])
  return { dragAndDropHooks: hooks }
}
export const nativeDragRootFor = (ref: RefObject<View | null>, scope: ReturnType<typeof useNativeDragActions>) =>
  roots.get(ref)?.get(scope) ?? null
export const nativeDragVirtualKeys = dragKeys

export type TNativeCollectionDragAndDropResult = {
  dragState: TNativeDraggableCollectionState
  dropState: TNativeDroppableCollectionState
  dragEnabled: boolean
  dropEnabled: boolean
  binding: NativeCollectionDragBinding | null
  context: TNativeDragAndDropContextValue
  isDropTarget: boolean
  persistedKeys: Set<TNativeCollectionKey>
  renderDropIndicator?: (target: TNativeDropTarget) => ReactNode
  collectionProps: TNativeDragElementProps
  preview: ReactNode
  rootDropIndicator: ReactNode
  renderIndicator: (props: TNativeDropIndicatorProps, ref: ForwardedRef<View>) => ReactNode
}
export const useNativeCollectionDragAndDrop = <T = object,>({
  hooks,
  collection,
  selectionManager,
  root,
  current,
  layoutDelegate,
  focusKey,
  rootLabel,
  scrollRef,
}: {
  hooks?: TNativeDragAndDropHooks<T>
  collection: TNativeDraggableCollectionStateOptions["collection"]
  selectionManager: TNativeDraggableCollectionStateOptions["selectionManager"]
  root: RefObject<View | null>
  current: () => boolean
  layoutDelegate?: TNativeDropCollectionOptions["layoutDelegate"]
  focusKey?: TNativeDropCollectionOptions["focusKey"]
  rootLabel?: string
  scrollRef?: TNativeDropCollectionOptions["scrollRef"]
}): TNativeCollectionDragAndDropResult => {
  const [failure, setFailure] = useState<{ error: unknown } | null>(null)
  const dragEnabled = !!hooks?.useDraggableCollectionState,
    dropEnabled = !!hooks?.useDroppableCollectionState
  const props: Omit<TNativeDraggableCollectionStateOptions<T>, "getItems"> = {
    collection,
    selectionManager,
    isDisabled: !dragEnabled,
  }
  const drag = (
    hooks?.useDraggableCollectionState ??
    ((props) => useNativeDraggableCollectionState({ ...props, getItems: () => [] }))
  )(props)
  const drop = (hooks?.useDroppableCollectionState ?? useNativeDroppableCollectionState)({
    collection,
    selectionManager,
    isDisabled: !dropEnabled,
  })
  ;(hooks?.useDraggableCollection ?? useNativeDraggableCollection)({}, drag, root)
  const result = (hooks?.useDroppableCollection ?? useNativeDroppableCollection)(
    { layoutDelegate, focusKey, rootLabel, scrollRef, dropTargetDelegate: hooks?.dropTargetDelegate },
    drop,
    root,
  )
  const scope = useNativeDragActions(),
    binding = nativeDragRootFor(root, scope)
  useInsertionEffect(() => {
    if (binding) {
      binding.sourceEnabled = dragEnabled
      binding.targetEnabled = dropEnabled
      binding.configure(current, (error) => setFailure({ error }))
    }
  })
  useVirtual()
  const focused = selectionManager.focusedKey
  const persistedKeys = useMemo(() => {
    const keys = new Set<TNativeCollectionKey>(drag.draggingKeys)
    if (focused != null) keys.add(focused)
    if (drop.target?.type === "item") {
      let key: TNativeCollectionKey = drop.target.key
      if (drop.target.dropPosition === "after") {
        const targetLevel = collection.getItem(key)?.level ?? 0
        let next = collection.getKeyAfter(key),
          descendant: TNativeCollectionKey | null = null
        while (next != null) {
          const node = collection.getItem(next)
          if (!node) break
          if (node.type !== "item") {
            next = collection.getKeyAfter(next)
            continue
          }
          if ((node.level ?? 0) <= targetLevel) break
          descendant = next
          next = collection.getKeyAfter(next)
        }
        key = next ?? descendant ?? key
      }
      keys.add(key)
    }
    return keys
  }, [drag.draggingKeys, drop.target, focused, collection])
  const context: TNativeDragAndDropContextValue = {
    dragAndDropHooks: hooks as TNativeDragAndDropHooks,
    dragState: drag,
    dropState: drop,
  }
  const renderDropIndicator = useCallback(
    (target: TNativeDropTarget) => {
      if (!hooks?.useDropIndicator || (!nativeVirtualDrag.isDragging() && !drop.isDropTarget(target))) return null
      return hooks.renderDropIndicator ? hooks.renderDropIndicator(target) : <NativeDropIndicator target={target} />
    },
    [hooks, drop.target],
  )
  const preview = useRef<TNativeDragPreviewRenderer | null>(null)
  // The state hook already receives this ref in RAC's parent; the native owner
  // keeps the same ref on its committed state before any original lift.
  useInsertionEffect(() => {
    if (hooks?.renderDragPreview) drag.preview = preview
  })
  const Preview = hooks?.DragPreview
  if (failure) throw failure.error
  return {
    dragState: drag,
    dropState: drop,
    dragEnabled,
    dropEnabled,
    binding,
    context,
    isDropTarget: dropEnabled && drop.isDropTarget({ type: "root" }),
    persistedKeys,
    renderDropIndicator: hooks?.useDropIndicator ? renderDropIndicator : undefined,
    collectionProps: result.collectionProps,
    preview: Preview && hooks?.renderDragPreview ? <Preview ref={preview}>{hooks.renderDragPreview}</Preview> : null,
    rootDropIndicator:
      hooks?.useDropIndicator && dropEnabled && collection.size === 0 ? renderDropIndicator({ type: "root" }) : null,
    renderIndicator: (props: TNativeDropIndicatorProps, ref: ForwardedRef<View>) => (
      <NativeCollectionDropIndicator {...props} ref={ref} />
    ),
  }
}
