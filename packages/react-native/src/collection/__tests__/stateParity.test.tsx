import { act, renderHook } from "@testing-library/react-native"
import { useListState as usePinnedListState } from "react-stately/useListState"

import { useListState } from "../state"
import type { TSourceManagerSurface } from "../state/types"

type TValue = { id: string }
type TCollection = Parameters<typeof useListState<TValue>>[0]["collection"]
type TNode = NonNullable<ReturnType<TCollection["getItem"]>>
type TManager = TSourceManagerSurface & {
  select: (key: string) => void
  withCollection: (collection: TCollection) => TSourceManagerSurface
}
type THook = (props: { collection: TCollection; selectionMode: "multiple" }) => { selectionManager: TManager }

const collection = (): TCollection => {
  const nodes: TNode[] = ["a", "b", "c"].map((key, index) => ({
    type: "item",
    key,
    value: { id: key },
    rendered: key,
    textValue: key,
    level: 0,
    index,
    props: { isDisabled: key === "b", href: key === "c" ? "https://example.test/c" : undefined },
    parentKey: null,
    prevKey: index ? ["a", "b", "c"][index - 1] : null,
    nextKey: ["a", "b", "c"][index + 1] ?? null,
    hasChildNodes: false,
    childNodes: [],
    shouldInvalidate: () => false,
  }))
  const keys = nodes.map((node) => node.key),
    byKey = new Map(nodes.map((node) => [node.key, node]))
  return {
    size: nodes.length,
    [Symbol.iterator]: () => nodes[Symbol.iterator](),
    getKeys: () => byKey.keys(),
    getItem: (key) => byKey.get(key) ?? null,
    at: (index) => nodes[index] ?? null,
    getChildren: () => [],
    getKeyBefore: (key) => keys[keys.indexOf(key) - 1] ?? null,
    getKeyAfter: (key) => keys[keys.indexOf(key) + 1] ?? null,
    getFirstKey: () => keys[0],
    getLastKey: () => keys.at(-1)!,
    getTextValue: (key) => byKey.get(key)?.textValue ?? "",
  }
}
const record = (manager: TSourceManagerSurface) => {
  const raw = manager.rawSelection
  const anchors = raw as Set<string | number> & {
    anchorKey?: string | number | null
    currentKey?: string | number | null
  }
  return {
    raw: raw === "all" ? raw : [...raw],
    keys: [...manager.selectedKeys],
    anchor: raw === "all" ? null : anchors.anchorKey,
    current: raw === "all" ? null : anchors.currentKey,
    focused: manager.isFocused,
    focusedKey: manager.focusedKey,
    childFocus: manager.childFocusStrategy,
    behavior: manager.selectionBehavior,
    empty: manager.isEmpty,
    all: manager.isSelectAll,
    first: manager.firstSelectedKey,
    last: manager.lastSelectedKey,
  }
}
const trace = async (hook: THook) => {
  const data = collection(),
    { result, unmount } = await renderHook(() => hook({ collection: data, selectionMode: "multiple" }))
  const surface = Object.getOwnPropertyNames(Object.getPrototypeOf(result.current.selectionManager))
    .filter((name) => name !== "constructor")
    .sort()
  const observations = [record(result.current.selectionManager)]
  const operations: ((manager: TManager) => void)[] = [
    (manager) => manager.replaceSelection("a"),
    (manager) => manager.toggleSelection("c"),
    (manager) => manager.extendSelection("a"),
    (manager) => manager.setFocused(true),
    (manager) => manager.setFocusedKey("c", "last"),
    (manager) => manager.selectAll(),
    (manager) => manager.toggleSelectAll(),
    (manager) => manager.setSelectedKeys(["missing", "c"]),
    (manager) => manager.setSelectionBehavior("replace"),
    (manager) => manager.select("a"),
    (manager) => manager.clearSelection(),
  ]
  for (const operation of operations) {
    await act(() => operation(result.current.selectionManager))
    observations.push(record(result.current.selectionManager))
  }
  const manager = result.current.selectionManager
  expect(manager.isDisabled("b")).toBe(true)
  expect(manager.canSelectItem("b")).toBe(false)
  expect(manager.isLink("c")).toBe(true)
  expect(manager.getItemProps("a")).toBe(data.getItem("a")!.props)
  expect(manager.withCollection(data).collection).toBe(data)
  await unmount()
  return { surface, observations }
}

it("preserves the complete pinned manager surface and actual uncontrolled selection/focus traces", async () => {
  expect(await trace(useListState)).toEqual(await trace(usePinnedListState))
})
