import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useInsertionEffect,
  useMemo,
  useRef,
  useState,
  type ForwardedRef,
  type RefObject,
} from "react"
import { findNodeHandle, StyleSheet, View, type StyleProp, type TextStyle } from "react-native"

import { NativeCollectionActionsContext } from "../../collection/actions"
import { NativeCollectionItemBindingContext } from "../../collection/binding"
import {
  NativeCollection,
  NativeCollectionBuilder,
  createNativeCollectionLeaf,
} from "../../collection/CollectionBuilder"
import { useNativeCollectionRefs } from "../../collection/context"
import {
  NativeDragAndDropContext,
  useNativeCollectionDragAndDrop,
  useNativeDragAndDrop,
  useNativeDraggableItem,
  useNativeDroppableItem,
} from "../../collection/dragAndDrop/hooks"
import { nativeVirtualDrag } from "../../collection/dragAndDrop/virtualDrag"
import { DefaultNativeCollectionRenderer } from "../../collection/renderer"
import type { TNativeCollectionNode, TNativeCollectionSnapshot } from "../../collection/snapshot"
import { useListState } from "../../collection/state"
import { NativeFocusHost } from "../../input/NativeFocusView"
import { useNativeKeyScope } from "../../input/NativeKeyboardScope"
import type { TNativeKeyboardEvent } from "../../input/types"
import { NativeMotionOwnerHost } from "../../motion/owner/NativeMotionOwnerHost"
import { useNativeTheme } from "../../theme"
import { getNativeCardStyle } from "../Card/styles"
import { resolveNativeStyle } from "../colors"
import { splitNativeTextStyle } from "../nativeTextStyle"
import { NativeTextStyleProvider } from "../NativeTextStyleProvider"
import { QueryGlyph } from "../SortAndFilterPanel/glyphs"
import { Text } from "../Text/Text"

import { reorderNativeSortParameters } from "./reorder"
import type { TNativeSortParameter, TNativeSortParameterListProps } from "./types"

const SortCollectionContext = createContext<TNativeCollectionSnapshot<object> | null>(null)

type TListOwner = {
  props: TNativeSortParameterListProps
  start: (key: string) => void
  drop: (key: string) => void
  end: (operation: string) => void
}
type TItemProps = { id: string; item: TNativeSortParameter; owner: TListOwner; textValue: string }
const calibrated = (defaults: TextStyle, styles: StyleProp<TextStyle>) => {
  const authored = Object.fromEntries(
    Object.entries(StyleSheet.flatten(styles) ?? {}).filter(([, value]) => value !== undefined),
  )
  return splitNativeTextStyle(resolveNativeStyle([defaults, authored], "SortParameterList", "style"))
}
const rootTarget = { getDropTargetFromPoint: () => ({ type: "root" as const }) }
const RowContent = ({
  node,
  owner,
  item,
  original,
  binding,
  dragAndDrop,
  forwarded,
}: {
  node: TNativeCollectionNode<object>
  owner: TListOwner
  item: TNativeSortParameter
  original: RefObject<View | null>
  binding: string
  dragAndDrop: ReturnType<typeof useNativeCollectionDragAndDrop>
  forwarded: ForwardedRef<View>
}) => {
  const theme = useNativeTheme()
  const actions = useContext(NativeCollectionActionsContext)!
  const scope = useNativeKeyScope()
  const draggable = useNativeDraggableItem({ key: node.key }, dragAndDrop.dragState)
  const droppable = useNativeDroppableItem({ target: { type: "root" } }, dragAndDrop.dropState, original)
  const sourceRef = useNativeCollectionRefs(original, draggable.dragProps.ref)
  const merged = useNativeCollectionRefs(forwarded, sourceRef)
  const row = calibrated(
    {
      width: "100%",
      padding: theme.spacing.unit * 2,
      gap: theme.spacing.unit,
      flexDirection: "row",
      alignItems: "center",
      borderRadius: theme.radius.rounded,
      backgroundColor: theme.colors.controlBackground,
    },
    owner.props.customItemStyles,
  )
  const icon = calibrated({}, owner.props.customItemIconStyles)
  const text = calibrated({}, owner.props.customItemTextStyles)
  const drop = droppable.dropProps
  const pressable = nativeVirtualDrag.isDragging() ? drop : draggable.dragProps
  const onKey = (event: TNativeKeyboardEvent) => {
    const run = () => {
      if (event.nativeEvent.phase === "up") {
        draggable.dragProps.onKeyUp?.(event)
        if (!event.defaultPrevented) drop.onKeyUp?.(event)
      } else {
        draggable.dragProps.onKeyDown?.(event)
        if (!event.defaultPrevented) drop.onKeyDown?.(event)
      }
    }
    const data = event.nativeEvent
    if (
      !scope ||
      !(nativeVirtualDrag.isDragging() || (data.key === "Enter" && !data.repeat && !data.ctrlKey && !data.metaKey))
    ) {
      run()
      return
    }
    const view = original.current,
      tag = view && findNodeHandle(view),
      input = scope.lastInput()
    const cancel = () => {
      nativeVirtualDrag.cancel().catch((error) => dragAndDrop.binding?.fail(error))
    }
    event.persist?.()
    event.preventDefault()
    event.stopPropagation()
    if (view && tag)
      actions.request(
        node,
        tag,
        () => {
          if (original.current === view && dragAndDrop.binding?.current() && scope.lastInput() === input) run()
          else cancel()
        },
        (outcome) => {
          if (outcome !== "accepted") cancel()
        },
      )
  }
  return (
    <NativeCollectionItemBindingContext.Provider value={binding}>
      <NativeTextStyleProvider style={row.text}>
        <NativeMotionOwnerHost
          {...draggable.dragProps}
          {...drop}
          ref={merged}
          nativeID={item.ID}
          role="button"
          accessible
          focusable
          nativeTabStop
          accessibilityLabel={`Sort Parameter - ${item.name}`}
          testID="sort-parameter-list-item"
          nativePressable={pressable.nativePressable}
          onNativeActivation={pressable.onNativeActivation}
          onAccessibilityAction={pressable.onAccessibilityAction}
          accessibilityActions={pressable.accessibilityActions}
          capturedKeys={[...(draggable.dragProps.capturedKeys ?? []), ...(drop.capturedKeys ?? [])]}
          onKeyDown={onKey}
          onKeyUp={onKey}
          computedStyles={row.view}
          motion={{
            layout: true,
            whileDrag: { scale: 1.05 },
            transition: { type: "spring", stiffness: 300, damping: 50 },
          }}
        >
          <View testID="sort-parameter-list-item-icon" style={icon.view} accessible={false}>
            <QueryGlyph
              kind="grip"
              size={10}
              color={icon.text.color ?? row.text.color ?? theme.colors.foreground}
              testID="sort-parameter-list-item-default-drag-indicator-icon"
            />
          </View>
          <Text customStyles={[text.view, text.text]}>{item.name}</Text>
        </NativeMotionOwnerHost>
      </NativeTextStyleProvider>
    </NativeCollectionItemBindingContext.Provider>
  )
}
const Row = (props: TItemProps, ref: ForwardedRef<View>, node: TNativeCollectionNode<object>) => {
  const actions = useContext(NativeCollectionActionsContext)!
  const collection = useContext(SortCollectionContext)!
  const state = useListState({ collection, selectionMode: "none" })
  const original = useRef<View | null>(null)
  const latest = useRef({ props, live: true })
  useInsertionEffect(() => {
    latest.current = { props, live: true }
  })
  useInsertionEffect(
    () => () => {
      latest.current.live = false
    },
    [],
  )
  const { dragAndDropHooks } = useNativeDragAndDrop({
    getItems: () => [{ "text/plain": latest.current.props.item.ID }],
    onDragStart: () => latest.current.props.owner.start(latest.current.props.item.ID),
    onDragEnd: (event) => latest.current.props.owner.end(event.dropOperation),
    onDrop: () => latest.current.props.owner.drop(latest.current.props.item.ID),
    dropTargetDelegate: rootTarget,
  })
  const dragAndDrop = useNativeCollectionDragAndDrop({
    hooks: dragAndDropHooks,
    collection,
    selectionManager: state.selectionManager,
    root: original,
    current: () => latest.current.live,
    rootLabel: `Sort Parameter - ${props.item.name}`,
    dropTargetDelegate: rootTarget,
  })
  return (
    <NativeDragAndDropContext.Provider value={dragAndDrop.context}>
      <RowContent
        node={node}
        owner={props.owner}
        item={props.item}
        original={original}
        binding={actions.bindingFor(node)}
        dragAndDrop={dragAndDrop}
        forwarded={ref}
      />
    </NativeDragAndDropContext.Provider>
  )
}
const SortItem = createNativeCollectionLeaf<object, TItemProps, View>("item", Row)

export const SortParameterList = (props: TNativeSortParameterListProps) => {
  const {
    sortParameterList,
    onSortParameterListChange,
    customStyles,
    style,
    customItemStyles: _item,
    customItemIconStyles: _icon,
    customItemTextStyles: _text,
    "data-testid": testAlias,
    testID,
    "aria-label": label,
    ariaLabel,
    "aria-labelledby": labelledBy,
    ariaLabelledBy,
    "aria-describedby": describedBy,
    ariaDescribedBy,
    "aria-details": details,
    ariaDetails,
    ...native
  } = props
  const [state, setState] = useState<{ draggedID: string | null; parameters: TNativeSortParameter[] }>({
    draggedID: null,
    parameters: [],
  })
  useEffect(() => {
    setState((previous) => ({ ...previous, parameters: sortParameterList }))
  }, [sortParameterList])
  const start = useCallback((key: string) => setState((previous) => ({ ...previous, draggedID: key })), [])
  const end = useCallback((operation: string) => {
    if (operation === "move") setState((previous) => ({ ...previous, draggedID: null }))
  }, [])
  const dropped = useCallback(
    (key: string) =>
      setState((previous) => {
        const parameters = reorderNativeSortParameters(previous.parameters, previous.draggedID, key)
        if (parameters !== previous.parameters) onSortParameterListChange?.(parameters)
        return { parameters, draggedID: null }
      }),
    [onSortParameterListChange],
  )
  const owner = useMemo(() => ({ props, start, drop: dropped, end }), [props, start, dropped, end])
  const theme = useNativeTheme()
  const root = calibrated(
    {
      ...getNativeCardStyle({ width: 250, height: 200, borderRadius: theme.radius.rounded }, theme),
      padding: theme.spacing.unit * 2,
      gap: theme.spacing.unit,
    },
    [customStyles, style],
  )
  return (
    <NativeCollectionBuilder<object>
      content={
        <NativeCollection items={state.parameters} dependencies={[owner]}>
          {(item) => <SortItem id={item.ID} item={item} owner={owner} textValue={item.name} />}
        </NativeCollection>
      }
    >
      {(collection) => (
        <SortCollectionContext.Provider value={collection}>
          <NativeTextStyleProvider style={root.text}>
            <NativeFocusHost
              {...native}
              style={root.view}
              testID={testID ?? testAlias ?? "sort-parameter-list"}
              accessibilityLabel={label ?? ariaLabel ?? native.accessibilityLabel}
              nativeLabelledBy={(labelledBy ?? ariaLabelledBy)?.split(/\s+/).filter(Boolean)}
              nativeDescribedBy={(describedBy ?? ariaDescribedBy)?.split(/\s+/).filter(Boolean)}
              nativeDetailsBy={(details ?? ariaDetails)?.split(/\s+/).filter(Boolean)}
            >
              <DefaultNativeCollectionRenderer.CollectionRoot collection={collection} />
            </NativeFocusHost>
          </NativeTextStyleProvider>
        </SortCollectionContext.Provider>
      )}
    </NativeCollectionBuilder>
  )
}
