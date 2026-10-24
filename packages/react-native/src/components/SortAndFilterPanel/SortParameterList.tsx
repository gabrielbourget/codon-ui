import { createContext, useCallback, useContext, useRef, useState, type ForwardedRef } from "react"
import { findNodeHandle, type View } from "react-native"

import { NativeCollectionActionsContext } from "../../collection/actions"
import { NativeCollectionItemBindingContext } from "../../collection/binding"
import {
  NativeCollection,
  NativeCollectionBuilder,
  createNativeCollectionLeaf,
} from "../../collection/CollectionBuilder"
import { useNativeCollectionRefs } from "../../collection/context"
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
import { resolveNativeTagTransition, useNativeTagColor, useNativeTagReducedMotion } from "../Tag/motion"

import type { TQueryControlLabels } from "./controlLabels"
import { QuerySortEntry, type TQuerySortEntryProps } from "./QueryControls"

export type TQuerySortParameterListProps = Omit<TQuerySortEntryProps, "parameter"> & {
  sortParameterList: TTableSortInstruction[]
  listLabels: TQueryControlLabels["sortParameterList"]
}
const BACKGROUND_TRANSITION = resolveNativeTagTransition()
type TKeyboard = ReturnType<typeof useNativeCollectionKeyboard>
const ListContext = createContext<{
  keyboard: TKeyboard
  manager: ReturnType<typeof useListState>["selectionManager"]
  parentTarget: number
  ordinals: ReadonlyMap<string | number, number>
} | null>(null)
type TItemProps = TQuerySortEntryProps & { id: string; textValue: string; label: string }
const Option = (props: TItemProps, ref: ForwardedRef<View>, node: TNativeCollectionNode<object>) => {
  const list = useContext(ListContext)!
  const actions = useContext(NativeCollectionActionsContext)!
  const theme = useNativeTheme()
  const target = useRef<View | null>(null)
  const register = useCallback(
    (view: View | null) => {
      target.current = view
      list.keyboard.register(node, view)
    },
    [node, list.keyboard.register],
  )
  const merged = useNativeCollectionRefs(ref, register)
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
          accessibilityLabel={label}
          focusable
          nativeTabStop={list.manager.focusedKey === node.key}
          capturedKeys={scope ? [] : list.keyboard.keysFor(node.key)}
          onFocus={(event) => list.keyboard.observe(node.key, event)}
          onKeyDown={(event) => list.keyboard.onKeyDown(event, node.key)}
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
            tokens={list.keyboard.keysFor(node.key)}
            lifetimeKey={binding}
            isEnabled={!!binding}
            excludeEditable
            excludeComposing
            canAct={list.keyboard.canAct}
            onKey={(event) => list.keyboard.onKeyDown(event, node.key)}
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
  const persistedKeys = useNativePersistedKeys(
    state.selectionManager.focusedKey,
    keyboard.requestedKey,
    keyboard.observedKey,
  )
  return (
    <ListContext.Provider
      value={{
        keyboard,
        manager: state.selectionManager,
        parentTarget: target,
        ordinals: new Map(rows.map((row, index) => [row.key, index])),
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
            <NativeCollectionTypeahead keyboard={keyboard} target={root} tag={target} />
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
