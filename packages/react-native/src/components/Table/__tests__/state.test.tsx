import "../../../collection/__tests__/nativeReceipts"

import { createRef, useContext } from "react"
import { StyleSheet, type View } from "react-native"

import {
  actWithNativeCollections as act,
  renderWithNativeCollections as render,
  screen,
} from "../../../collection/__tests__/nativeReceipts"
import { NativeSelectableCollectionContext } from "../../../collection/context"
import {
  DefaultNativeCollectionRenderer,
  NativeCollectionRendererContext,
  type TNativeCollectionRootProps,
} from "../../../collection/renderer"
import { NativeThemeProvider } from "../../../theme"
import { NativeTableStateContext, useNativeTable } from "../context"
import { Table } from "../Table"
import { TableBody } from "../TableBody"
import { TableHeader } from "../TableHeader"
import type { TNativeTableColumnMetadata, TNativeTableProps } from "../types"

type TState = NonNullable<React.ContextType<typeof NativeTableStateContext>>
let current: TState | null = null
let renderedCollection: TNativeCollectionRootProps["collection"] | null = null
let runtimeManager: ReturnType<typeof useNativeTable>["manager"] | null = null
let nestedContext: React.ContextType<typeof NativeSelectableCollectionContext>
const CaptureRoot = (props: TNativeCollectionRootProps) => {
  current = useContext(NativeTableStateContext)
  runtimeManager = useNativeTable().manager
  renderedCollection = props.collection
  nestedContext = useContext(NativeSelectableCollectionContext)
  return <DefaultNativeCollectionRenderer.CollectionRoot {...props} />
}
const renderer = { ...DefaultNativeCollectionRenderer, CollectionRoot: CaptureRoot }
const items = [
  { id: "a", name: "Alpha", value: 0 },
  { id: "b", name: "Beta", value: false },
]
const columns = [
  { id: "name", name: "Name", isRowHeader: true, sort: { enabled: true, criteriaID: "name-sort" } },
  { id: "value", name: "Value" },
]
const tree = (
  props: Partial<TNativeTableProps<(typeof items)[number]>> = {},
  rows = items,
  viewColumns: TNativeTableColumnMetadata<(typeof items)[number]>[] = columns,
) => (
  <NativeThemeProvider>
    <NativeCollectionRendererContext.Provider value={renderer}>
      <Table accessibilityLabel="Table" {...props}>
        <TableHeader columns={viewColumns} />
        <TableBody items={rows} columns={viewColumns} rowKey={(item) => item.id} />
      </Table>
    </NativeCollectionRendererContext.Provider>
  </NativeThemeProvider>
)
beforeEach(() => {
  current = null
  renderedCollection = null
  runtimeManager = null
  nestedContext = undefined
})
const state = () => {
  if (!current) throw new Error("Expected committed Table state")
  return current
}
it("provides the complete source state over the same collection and manager used by the real renderer", async () => {
  await render(tree())
  expect(Object.keys(state()).sort()).toEqual([
    "collection",
    "disabledKeys",
    "expandedKeys",
    "isKeyboardNavigationDisabled",
    "selectionManager",
    "setKeyboardNavigationDisabled",
    "showSelectionCheckboxes",
    "sort",
    "sortDescriptor",
    "toggleKey",
    "treeColumn",
  ])
  expect(state().collection === renderedCollection).toBe(true)
  expect(state().selectionManager === runtimeManager).toBe(true)
  expect([...state().collection].map((node) => node.type)).toEqual(["tableheader", "tablebody"])
  expect(state().collection.columns.map((node) => node.key)).toEqual(["name", "value"])
  expect(state().collection.rows.map((node) => node.key)).toEqual(["a", "b"])
  expect(state().collection.getFirstKey()).toBe("a")
  expect(state().collection.getItem("a")!.value === items[0]).toBe(true)
  expect(state().collection.getTextValue("a")).toBe("")
  expect(state().sortDescriptor).toBeNull()
  expect(state().showSelectionCheckboxes).toBe(false)
})
it("keeps programmatic selection requests owner-controlled through repeated veto and echo", async () => {
  const change = jest.fn()
  const props = { selectionMode: "multiple" as const, selectedKeys: new Set<string>(), onSelectionChange: change }
  const view = await render(tree(props))
  await act(() => state().selectionManager.toggleSelection("a"))
  await act(() => state().selectionManager.toggleSelection("a"))
  expect(change.mock.calls.map(([keys]) => [...keys])).toEqual([["a"], ["a"]])
  expect(state().selectionManager.isSelected("a")).toBe(false)
  await view.rerender(tree({ ...props, selectedKeys: new Set(["a"]) }))
  expect(state().selectionManager.isSelected("a")).toBe(true)
  expect(state().collection.columns.map((node) => node.key)).toEqual(["__selection", "name", "value"])
  expect(state().showSelectionCheckboxes).toBe(false)
})
it("routes state sort requests through the existing source query bridge and current owner", async () => {
  const change = jest.fn()
  const view = await render(tree({ columns, queryControls: { sorting: { activeSorts: [], onSortChange: change } } }))
  await act(() => state().sort("name", "descending"))
  expect(change.mock.calls[0][0][0].sortDirection).toBe("Ascending")
  expect(state().sortDescriptor).toBeNull()
  await view.rerender(
    tree({ columns, queryControls: { sorting: { activeSorts: change.mock.calls[0][0], onSortChange: change } } }),
  )
  expect(state().sortDescriptor).toEqual({ column: "name", direction: "ascending" })
})
it("retains expansion vetoes, tree-column keys and independent navigation state", async () => {
  const change = jest.fn()
  await render(tree({ expandedKeys: new Set(), onExpandedChange: change, treeColumn: "name" }))
  await act(() => state().toggleKey("a"))
  await act(() => state().toggleKey("a"))
  expect(change.mock.calls.map(([keys]) => [...keys])).toEqual([["a"], ["a"]])
  expect([...state().expandedKeys]).toEqual([])
  expect(state().treeColumn).toBe("name")
  await act(() => state().setKeyboardNavigationDisabled(true))
  expect(state().isKeyboardNavigationDisabled).toBe(true)
  await act(() => state().setKeyboardNavigationDisabled(false))
  expect(state().isKeyboardNavigationDisabled).toBe(false)
  const root = screen.getByTestId("table")
  for (const name of ["expandedKeys", "defaultExpandedKeys", "onExpandedChange", "treeColumn", "filter", "slot"])
    expect(Object.hasOwn(root.props, name)).toBe(false)
})
it("uses current cell-based filtering and resets the shared context inside the table", async () => {
  const view = await render(
    <NativeSelectableCollectionContext.Provider value={{ filter: (_text, node) => node.parentKey === "b" }}>
      {tree()}
    </NativeSelectableCollectionContext.Provider>,
  )
  expect(state().collection.rows.map((node) => node.key)).toEqual(["b"])
  expect(state().collection.getItem("a")).toBeNull()
  expect(state().selectionManager.collection === state().collection).toBe(true)
  expect(nestedContext).toBeNull()
  await view.rerender(tree())
  expect(state().collection.rows.map((node) => node.key)).toEqual(["a", "b"])
})
it("merges shared native props/styles/refs after authored wrapper styles without replacing the grid", async () => {
  const ref = createRef<View>()
  const content = (margin: number) => (
    <NativeSelectableCollectionContext.Provider
      value={{ ref, style: { marginTop: 7, marginBottom: 9 }, accessibilityLabel: "Inherited" }}
    >
      {tree({ customStyles: { marginTop: margin } })}
    </NativeSelectableCollectionContext.Provider>
  )
  const view = await render(content(11))
  const original = ref.current
  expect(original !== null).toBe(true)
  expect(screen.getByTestId("table").props.accessibilityLabel).toBe("Table")
  expect(StyleSheet.flatten(screen.getByTestId("table").props.style)).toMatchObject({ marginTop: 11, marginBottom: 9 })
  await view.rerender(content(13))
  expect(ref.current === original).toBe(true)
})

it("recovers the same column's logical focus when its original row is removed", async () => {
  const view = await render(tree())
  const key = [...state().collection.getChildren("a")][1].key
  await act(() => state().selectionManager.setFocusedKey(key))
  await view.rerender(tree({}, [items[1]]))
  expect(state().selectionManager.focusedKey).toBe([...state().collection.getChildren("b")][1].key)
})
it("restores the default collection renderer for arbitrary nested cell content", async () => {
  let nested: React.ContextType<typeof NativeCollectionRendererContext> | null = null
  const Probe = () => {
    nested = useContext(NativeCollectionRendererContext)
    return null
  }
  await render(tree({}, items, [{ ...columns[0], cellRenderer: () => <Probe /> }, columns[1]]))
  expect(nested === DefaultNativeCollectionRenderer).toBe(true)
})
