import { createContext, useCallback, useContext, useInsertionEffect, useRef, useState, type ForwardedRef } from "react"
import type { View } from "react-native"
import { findNodeHandle } from "react-native"

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
  NativeDropIndicatorContext,
  NativeDropIndicator,
  useNativeCollectionDragAndDrop,
  useNativeDragAndDrop,
  useNativeDraggableItem,
  useNativeDroppableItem,
} from "../../collection/dragAndDrop/hooks"
import type { TNativeInsertDropEvent, TNativeReorderDropEvent } from "../../collection/dragAndDrop/types"
import { NativeCollectionRendererContext, useNativePersistedKeys } from "../../collection/renderer"
import { NativeCollectionSemanticsContext } from "../../collection/semantics"
import type { TNativeCollectionSessionSnapshot } from "../../collection/session"
import type { TNativeCollectionNode, TNativeCollectionSnapshot } from "../../collection/snapshot"
import { useListState } from "../../collection/state"
import { NativeFocusHost } from "../../input/NativeFocusView"
import { useNativeKeyScope } from "../../input/NativeKeyboardScope"
import { useNativeTheme } from "../../theme"
import { NativeContentContext } from "../NativeContentContext"
import type { TTableSortInstruction } from "../Table/queryTypes"
import { TableKeyPolicy } from "../Table/TableCellKeys"
import { NativeCollectionTypeahead } from "../Table/TableTypeahead"
import { useNativeCollectionKeyboard } from "../Table/useTableKeyboard"
import { useTableTargetRef } from "../Table/useTableTargetRef"
import { resolveNativeTagTransition, useNativeTagColor, useNativeTagReducedMotion } from "../Tag/motion"

import type { TQueryControlLabels } from "./controlLabels"
import { QuerySortEntry, type TQuerySortEntryProps } from "./QueryControls"
import type { TSortReorderRequest } from "./useSortReorder"

export type TQuerySortParameterListProps = Omit<TQuerySortEntryProps, "parameter"> & {
  sortParameterList: TTableSortInstruction[]
  listLabels: TQueryControlLabels["sortParameterList"]
  onReorder?: TSortReorderRequest
}
const BACKGROUND_TRANSITION = resolveNativeTagTransition()
type TKeyboard = ReturnType<typeof useNativeCollectionKeyboard>
const ListContext = createContext<{
  keyboard: TKeyboard
  manager: ReturnType<typeof useListState>["selectionManager"]
  parentTarget: number
  ordinals: ReadonlyMap<string | number, number>
  dragAndDrop: ReturnType<typeof useNativeCollectionDragAndDrop>
  register: TKeyboard["register"]
} | null>(null)
type TItemProps = TQuerySortEntryProps & { id: string; textValue: string; label: string }
const Option = (props: TItemProps, ref: ForwardedRef<View>, node: TNativeCollectionNode<object>) => {
  const list = useContext(ListContext)!
  const actions = useContext(NativeCollectionActionsContext)!
  const theme = useNativeTheme()
  const target = useRef<View | null>(null)
  const original = useTableTargetRef(target, ref, { node, register: list.register })
  const draggable = useNativeDraggableItem({ key: node.key, hasAction: false }, list.dragAndDrop.dragState)
  const droppable = useNativeDroppableItem(
    { target: { type: "item", key: node.key, dropPosition: "on" } },
    list.dragAndDrop.dropState,
    target,
  )
  const merged = useNativeCollectionRefs(original, draggable.dragProps.ref)
  const scope = useNativeKeyScope()
  const focused = list.manager.isFocused && list.manager.focusedKey === node.key
  const reduced = useNativeTagReducedMotion()
  const background = useNativeTagColor(
    focused ? theme.colors.controlHoverBackground : "transparent",
    BACKGROUND_TRANSITION,
    reduced,
    true,
  )
  const { id: _id, textValue: _text, label, ...entry } = props
  const binding = actions.bindingFor(node)
  const keys = [
    ...list.keyboard.keysFor(node.key),
    ...(draggable.dragProps.capturedKeys ?? []),
    ...(list.dragAndDrop.collectionProps.capturedKeys ?? []),
  ]
  const onKey = (event: Parameters<TKeyboard["onKeyDown"]>[0]) => {
    if (event.nativeEvent.phase === "up") {
      draggable.dragProps.onKeyUp?.(event)
      if (!event.defaultPrevented) droppable.dropProps.onKeyUp?.(event)
    } else {
      draggable.dragProps.onKeyDown?.(event)
      if (!event.defaultPrevented) droppable.dropProps.onKeyDown?.(event)
      if (!event.defaultPrevented) list.keyboard.onKeyDown(event, node.key)
    }
  }
  return (
    <NativeCollectionSemanticsContext.Provider
      value={JSON.stringify({
        kind: "list-item",
        parentTarget: list.parentTarget,
        ordinal: list.ordinals.get(node.key) ?? 0,
      })}
    >
      <NativeCollectionItemBindingContext.Provider value={binding}>
        <NativeFocusHost
          ref={merged}
          testID={`query-sort-option-${node.key}`}
          role="option"
          accessible
          nativePressable={draggable.dragProps.nativePressable || droppable.dropProps.nativePressable}
          onNativeActivation={
            droppable.dropProps.nativePressable
              ? droppable.dropProps.onNativeActivation
              : draggable.dragProps.onNativeActivation
          }
          accessibilityLabel={label}
          focusable
          nativeTabStop={list.manager.focusedKey === node.key}
          capturedKeys={scope ? [] : keys}
          onFocus={(event) => list.keyboard.observe(node.key, event)}
          onKeyDown={onKey}
          onKeyUp={onKey}
          accessibilityHint={draggable.dragProps.accessibilityHint}
          accessibilityActions={
            droppable.dropProps.nativePressable
              ? droppable.dropProps.accessibilityActions
              : draggable.dragProps.accessibilityActions
          }
          onAccessibilityAction={(event) => {
            draggable.dragProps.onAccessibilityAction?.(event)
            droppable.dropProps.onAccessibilityAction?.(event)
          }}
          accessibilityElementsHidden={droppable.dropProps.accessibilityElementsHidden}
          importantForAccessibility={droppable.dropProps.importantForAccessibility}
          style={{
            minHeight: 20,
            width: "100%",
            flexDirection: "row",
            alignItems: "center",
            borderRadius: theme.radius.rounded,
            backgroundColor: background.rendered,
          }}
        >
          <TableKeyPolicy
            target={target}
            tokens={keys}
            lifetimeKey={binding}
            isEnabled={!!binding}
            excludeEditable
            excludeComposing
            canAct={list.keyboard.canAct}
            onKey={onKey}
          />
          <QuerySortEntry {...entry} />
        </NativeFocusHost>
      </NativeCollectionItemBindingContext.Provider>
    </NativeCollectionSemanticsContext.Provider>
  )
}
const SortOption = createNativeCollectionLeaf<object, TItemProps, View>("item", Option)
const noHeaders = new Set<string>()
const policy = { disallowSelectAll: true, escapeKeyBehavior: "none" as const, shouldFocusWrap: false }
const List = ({
  collection,
  receipt,
  props,
}: {
  collection: TNativeCollectionSnapshot<object>
  receipt: TNativeCollectionSessionSnapshot<unknown>["receipt"]
  props: TQuerySortParameterListProps
}) => {
  const state = useListState({ collection, selectionMode: "none" })
  const root = useRef<View | null>(null)
  const [target, setTarget] = useState(0)
  const bind = useCallback((view: View | null) => {
    root.current = view
    setTarget(view ? (findNodeHandle(view) ?? 0) : 0)
  }, [])
  const renderer = useContext(NativeCollectionRendererContext)
  const actions = useContext(NativeCollectionActionsContext)!
  const theme = useNativeTheme()
  const rows = Array.from(collection).filter((node) => node.type === "item")
  const keyboard = useNativeCollectionKeyboard({
    collection,
    rows,
    manager: state.selectionManager,
    root,
    props: policy,
    rowHeaderColumns: noHeaders,
    receipt,
    layout: renderer.layoutDelegate,
    allowItemDescendantKeys: true,
    canAct: props.canAct,
  })
  const owner = useRef({ props, canAct: () => props.canAct?.() !== false })
  const dragged = useRef<string | null>(null)
  useInsertionEffect(() => {
    owner.current = { props, canAct: () => props.canAct?.() !== false }
  })
  const dropped = (event: TNativeInsertDropEvent | TNativeReorderDropEvent) => {
    const current = owner.current
    if (
      !current.canAct() ||
      dragged.current === null ||
      typeof event.target.key !== "string" ||
      event.target.dropPosition === "on"
    )
      return
    current.props.onReorder?.(dragged.current, event.target.key, event.target.dropPosition)
  }
  const { dragAndDropHooks } = useNativeDragAndDrop({
    isDisabled: !props.onReorder,
    onDragStart: (event) => {
      const key = event.keys.values().next().value
      dragged.current = typeof key === "string" ? key : null
    },
    onReorder: dropped,
    onInsert: dropped,
    getItems: (keys) =>
      [...keys].map((key) => {
        const parameter = owner.current.props.sortParameterList.find((item) => item.id === key)
        if (!parameter) throw new Error("Sort drag source is no longer in the original query")
        return { "text/plain": parameter.criteriaName }
      }),
    renderDropIndicator: (target) => <NativeDropIndicator target={target} testID="query-sort-drop-indicator" />,
  })
  const dragAndDrop = useNativeCollectionDragAndDrop({
    hooks: dragAndDropHooks,
    collection,
    selectionManager: state.selectionManager,
    root,
    current: () => props.canAct?.() !== false,
    layoutDelegate: renderer.layoutDelegate,
    focusKey: keyboard.requestFocus,
    rootLabel: props.listLabels.listAriaLabel,
  })
  const focusedKeys = useNativePersistedKeys(
    state.selectionManager.focusedKey,
    keyboard.requestedKey,
    keyboard.observedKey,
  )
  const persistedKeys = new Set([...(focusedKeys ?? []), ...dragAndDrop.persistedKeys])
  return (
    <ListContext.Provider
      value={{
        keyboard,
        manager: state.selectionManager,
        parentTarget: target,
        ordinals: new Map(rows.map((row, index) => [row.key, index])),
        dragAndDrop,
        register: keyboard.register,
      }}
    >
      <NativeDragAndDropContext.Provider value={dragAndDrop.context}>
        <NativeDropIndicatorContext.Provider value={{ render: dragAndDrop.renderIndicator }}>
          <NativeCollectionSemanticsContext.Provider value={JSON.stringify({ kind: "list-root", count: rows.length })}>
            <NativeCollectionItemBindingContext.Provider value={actions.bindingFor(null)}>
              <NativeFocusHost
                ref={bind}
                testID="query-sort-list"
                role="list"
                accessible={false}
                accessibilityLabel={props.listLabels.listAriaLabel}
                focusable
                nativeTabStop={state.selectionManager.focusedKey == null}
                capturedKeys={[...keyboard.keysFor(null), ...(dragAndDrop.collectionProps.capturedKeys ?? [])]}
                onFocus={keyboard.onFocus}
                onKeyDown={(event) => {
                  dragAndDrop.collectionProps.onKeyDown?.(event)
                  if (!event.defaultPrevented) keyboard.onKeyDown(event)
                }}
                onKeyUp={dragAndDrop.collectionProps.onKeyUp}
                style={{ width: "100%", gap: theme.spacing.unit }}
              >
                <NativeCollectionTypeahead
                  keyboard={{
                    ...keyboard,
                    typeaheadEnabled: keyboard.typeaheadEnabled && !dragAndDrop.dragState.draggingKeys.size,
                  }}
                  target={root}
                  tag={target}
                />
                <NativeContentContext.Provider value={{ foregroundColor: theme.colors.foreground, isButton: false }}>
                  <renderer.CollectionRoot
                    collection={collection}
                    persistedKeys={persistedKeys}
                    renderDropIndicator={dragAndDrop.renderDropIndicator}
                  />
                </NativeContentContext.Provider>
              </NativeFocusHost>
            </NativeCollectionItemBindingContext.Provider>
          </NativeCollectionSemanticsContext.Provider>
        </NativeDropIndicatorContext.Provider>
      </NativeDragAndDropContext.Provider>
    </ListContext.Provider>
  )
}
// The complete original metadata collection owns membership; rendering and native admission keep their existing owners.
export const QuerySortParameterList = (props: TQuerySortParameterListProps) => (
  <NativeCollectionBuilder<object>
    content={
      <NativeCollection items={props.sortParameterList} dependencies={[props]}>
        {(parameter) => {
          const label = props.listLabels.itemAriaLabel({
            criteriaName: parameter.criteriaName,
            sortDirection: parameter.sortDirection,
          })
          return <SortOption {...props} id={parameter.id} parameter={parameter} label={label} textValue={label} />
        }}
      </NativeCollection>
    }
  >
    {(collection, receipt) => <List collection={collection} receipt={receipt} props={props} />}
  </NativeCollectionBuilder>
)
