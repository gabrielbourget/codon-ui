import { createContext, useCallback, useContext, useMemo, useRef, useState, type ForwardedRef } from "react"
import { findNodeHandle, PanResponder, View } from "react-native"

import { NativeCollectionActionsContext } from "../../collection/actions"
import { NativeCollectionItemBindingContext } from "../../collection/binding"
import {
  NativeCollection,
  NativeCollectionBuilder,
  createNativeCollectionLeaf,
} from "../../collection/CollectionBuilder"
import { NativeCollectionRendererContext, useNativePersistedKeys } from "../../collection/renderer"
import { NativeCollectionSemanticsContext } from "../../collection/semantics"
import type { TNativeCollectionSessionSnapshot } from "../../collection/session"
import type { TNativeCollectionNode, TNativeCollectionSnapshot } from "../../collection/snapshot"
import { useListState } from "../../collection/state"
import { nativeKeyTokens } from "../../input/keyScope"
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
import { useSortReorder, type TSortReorderRequest } from "./useSortReorder"

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
  reorder: ReturnType<typeof useSortReorder>
  register: TKeyboard["register"]
} | null>(null)
type TItemProps = TQuerySortEntryProps & { id: string; textValue: string; label: string }
const Option = (props: TItemProps, ref: ForwardedRef<View>, node: TNativeCollectionNode<object>) => {
  const list = useContext(ListContext)!
  const actions = useContext(NativeCollectionActionsContext)!
  const theme = useNativeTheme()
  const target = useRef<View | null>(null)
  const merged = useTableTargetRef(target, ref, { node, register: list.register })
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
    ...(list.reorder.enabled ? ["Enter", "Escape", "Tab", "PageUp", "PageDown"].flatMap(nativeKeyTokens) : []),
  ]
  const onKey = (event: Parameters<TKeyboard["onKeyDown"]>[0]) => {
    if (!list.reorder.key(String(node.key), event)) list.keyboard.onKeyDown(event, node.key)
  }
  const { begin, move, drop, cancel, enabled } = list.reorder
  const gesture = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, state) =>
          enabled && state.numberActiveTouches === 1 && Math.abs(state.dy) > 5,
        onPanResponderGrant: () => begin(String(node.key), false),
        onPanResponderMove: (event, state) => {
          if (state.numberActiveTouches !== 1) cancel()
          else move(event.nativeEvent.pageX, event.nativeEvent.pageY)
        },
        onPanResponderRelease: (event) => {
          move(event.nativeEvent.pageX, event.nativeEvent.pageY)
          drop()
        },
        onPanResponderTerminate: cancel,
        onPanResponderTerminationRequest: () => true,
      }),
    [enabled, node.key, begin, move, drop, cancel],
  )
  const ordinal = list.ordinals.get(node.key) ?? 0
  const indicator = list.reorder.indicator
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
          {...gesture.panHandlers}
          ref={merged}
          testID={`query-sort-option-${node.key}`}
          role="option"
          accessible
          accessibilityLabel={label}
          focusable
          nativeTabStop={list.manager.focusedKey === node.key}
          capturedKeys={scope ? [] : keys}
          onFocus={(event) => list.keyboard.observe(node.key, event)}
          onKeyDown={onKey}
          onKeyUp={onKey}
          accessibilityActions={
            enabled
              ? [
                  { name: "activate", label: "Drag sort parameter" },
                  { name: "dropBefore", label: "Drop before this sort parameter" },
                  { name: "dropAfter", label: "Drop after this sort parameter" },
                  { name: "escape", label: "Cancel sort parameter drag" },
                ]
              : undefined
          }
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === "activate") begin(String(node.key), true)
            else if (event.nativeEvent.actionName === "escape") cancel()
            else if (event.nativeEvent.actionName === "dropBefore") list.reorder.dropAt(String(node.key), "before")
            else if (event.nativeEvent.actionName === "dropAfter") list.reorder.dropAt(String(node.key), "after")
          }}
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
          {(indicator === ordinal || (indicator === list.ordinals.size && ordinal === indicator - 1)) && (
            <View
              testID="query-sort-drop-indicator"
              pointerEvents="none"
              accessible={false}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                ...(indicator === ordinal ? { top: 0 } : { bottom: 0 }),
                height: 2,
                backgroundColor: theme.colors.controlBorder,
              }}
            />
          )}
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
  const reorder = useSortReorder(collection, keyboard.canAct, props.onReorder, root)
  const focusedKeys = useNativePersistedKeys(
    state.selectionManager.focusedKey,
    keyboard.requestedKey,
    keyboard.observedKey,
  )
  const persistedKeys = useMemo(() => {
    if (reorder.source === null && reorder.targetKey === null && reorder.indicatorKey === null) return focusedKeys
    const keys = new Set(focusedKeys ?? [])
    for (const key of [reorder.source, reorder.targetKey, reorder.indicatorKey]) if (key !== null) keys.add(key)
    return keys
  }, [focusedKeys, reorder.source, reorder.targetKey, reorder.indicatorKey])
  const register = useCallback<TKeyboard["register"]>(
    (node, view) => {
      keyboard.register(node, view)
      reorder.register(node, view)
    },
    [keyboard.register, reorder.register],
  )
  return (
    <ListContext.Provider
      value={{
        keyboard,
        manager: state.selectionManager,
        parentTarget: target,
        ordinals: new Map(rows.map((row, index) => [row.key, index])),
        reorder,
        register,
      }}
    >
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
            capturedKeys={keyboard.keysFor(null)}
            onFocus={keyboard.onFocus}
            onKeyDown={keyboard.onKeyDown}
            style={{ width: "100%", gap: theme.spacing.unit }}
          >
            <NativeCollectionTypeahead
              keyboard={{ ...keyboard, typeaheadEnabled: keyboard.typeaheadEnabled && reorder.source === null }}
              target={root}
              tag={target}
            />
            <NativeContentContext.Provider value={{ foregroundColor: theme.colors.foreground, isButton: false }}>
              <renderer.CollectionRoot collection={collection} persistedKeys={persistedKeys} />
            </NativeContentContext.Provider>
          </NativeFocusHost>
        </NativeCollectionItemBindingContext.Provider>
      </NativeCollectionSemanticsContext.Provider>
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
