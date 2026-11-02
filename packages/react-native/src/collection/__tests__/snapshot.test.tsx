import { act, renderHook } from "@testing-library/react-native"
import { createRef } from "react"
import type { View } from "react-native"

import {
  createNativeCollectionSnapshot,
  getNativeCollectionNodeIdentity,
  type TNativeCollectionItem,
} from "../snapshot"
import { useListState, useTreeState } from "../state"

type TValue = { id: string | number }
const descriptor = (key: string | number, type = "item"): TNativeCollectionItem<TValue> => ({
  key,
  type,
  value: { id: key },
  textValue: String(key),
  rendered: String(key),
  props: { ref: createRef<View>() },
})
const snapshot = (items: readonly TNativeCollectionItem<TValue>[]) => createNativeCollectionSnapshot(items)

it("keeps typed keys, original payload/ref/renderer identities and immutable owned links", () => {
  const render = jest.fn(() => <></>)
  const numeric = { ...descriptor(0), render }
  const string = descriptor("0")
  const logical = snapshot([numeric, string])
  const node = logical.getItem(0)!
  expect([...logical.getKeys()]).toEqual([0, "0"])
  expect(node.value).toBe(numeric.value)
  expect(node.props).toBe(numeric.props)
  expect(node.props.ref).toBe(numeric.props.ref)
  expect(node.render).toBe(render)
  expect(
    Object.keys(node).filter((key) => ["descriptorId", "descriptorRevision", "metadataTarget"].includes(key)),
  ).toEqual([])
  expect(getNativeCollectionNodeIdentity(node)).toEqual({
    itemId: expect.any(String),
    itemRevision: expect.any(String),
  })
  expect(getNativeCollectionNodeIdentity(logical.filter(() => true).getItem(0)!)).toBe(
    getNativeCollectionNodeIdentity(node),
  )
  expect(render).not.toHaveBeenCalled()
  expect(node.nextKey).toBe("0")
  expect(logical.getKeyBefore("0")).toBe(0)
  expect(Object.isFrozen(logical)).toBe(true)
  expect(Object.isFrozen(node)).toBe(true)
  expect(() => node.childNodes).toThrow("childNodes is not supported")
  expect(Object.isFrozen(numeric.value)).toBe(false)
  expect(Object.isFrozen(numeric.props)).toBe(false)
  expect(() => Reflect.set(node, "nextKey", null)).not.toThrow()
  expect(Reflect.set(node, "nextKey", null)).toBe(false)
  expect(node.nextKey).toBe("0")
  expect(() => logical.at(0)).toThrow("Not implemented")
})

it("separates lookup membership from linked order across reorder, removal and reinsert", () => {
  const nodes = [descriptor("a"), descriptor("b"), descriptor("c")]
  const initial = createNativeCollectionSnapshot(nodes)
  const reordered = createNativeCollectionSnapshot([nodes[1], nodes[2], nodes[0]], initial)
  expect([...reordered].map((node) => node.key)).toEqual(["b", "c", "a"])
  expect([...reordered.getKeys()]).toEqual(["a", "b", "c"])
  expect(reordered.getFirstKey()).toBe("b")
  expect(reordered.getLastKey()).toBe("a")
  expect(reordered.getKeyAfter("c")).toBe("a")
  expect([...initial].map((node) => node.key)).toEqual(["a", "b", "c"])
  const removed = createNativeCollectionSnapshot([nodes[1], nodes[2]], reordered)
  const restored = createNativeCollectionSnapshot(nodes, removed)
  expect([...restored.getKeys()]).toEqual(["b", "c", "a"])
  expect([...restored].map((node) => node.key)).toEqual(["a", "b", "c"])
})

it("filters a submenu by its trigger label and retains the original whole branch only on a match", () => {
  const branch = descriptor("submenu", "submenutrigger"),
    trigger = { ...descriptor(0), textValue: "More actions" },
    sibling = descriptor("other")
  const original = createNativeCollectionSnapshot([{ ...branch, children: [trigger] }, sibling])
  const filter = jest.fn((text: string) => text === "More actions")
  const matched = original.filter(filter)
  expect([...matched].map((node) => node.key)).toEqual(["submenu"])
  expect([...matched.getChildren("submenu")].map((node) => node.key)).toEqual([0])
  expect(matched.getItem(0)?.value).toBe(trigger.value)
  expect(getNativeCollectionNodeIdentity(matched.getItem(0)!)).toBe(
    getNativeCollectionNodeIdentity(original.getItem(0)!),
  )
  expect(filter.mock.calls.map(([text]) => text)).toEqual(["More actions", "other"])
  expect(original.filter(() => false).size).toBe(0)
  expect(original.getItem(0)?.value).toBe(trigger.value)
})

it("revises changed items and gives removed/reinserted keys a fresh occurrence", () => {
  const a = descriptor("a"),
    b = descriptor("b")
  const initial = snapshot([a, b])
  const originalIdentity = getNativeCollectionNodeIdentity(initial.getItem("a")!)!
  const next = createNativeCollectionSnapshot([{ ...a, textValue: "Changed" }, b], initial)
  const revised = getNativeCollectionNodeIdentity(next.getItem("a")!)!
  expect(revised.itemId).toBe(originalIdentity.itemId)
  expect(revised.itemRevision).not.toBe(originalIdentity.itemRevision)
  const removed = createNativeCollectionSnapshot([b], next)
  const restored = createNativeCollectionSnapshot([a, b], removed)
  expect(getNativeCollectionNodeIdentity(restored.getItem("a")!)!.itemId).not.toBe(originalIdentity.itemId)
  expect([...restored.getKeys()]).toEqual(["b", "a"])
})

it("feeds the actual list selection manager with full membership and controlled veto", async () => {
  const logical = snapshot([descriptor(0), descriptor("0"), descriptor("missing-row")])
  const owner = new Set<string | number>([0, "absent"])
  const onSelectionChange = jest.fn()
  const { result } = await renderHook(() =>
    useListState({ collection: logical, selectionMode: "multiple", selectedKeys: owner, onSelectionChange }),
  )
  await act(() => result.current.selectionManager.replaceSelection("missing-row"))
  expect(result.current.collection).toBe(logical)
  expect([...owner]).toEqual([0, "absent"])
  expect([...result.current.selectionManager.selectedKeys]).toEqual([0, "absent"])
  expect([...onSelectionChange.mock.calls[0][0]]).toEqual(["missing-row"])
  expect(logical.size).toBe(3)
})

it("feeds tree expansion without reducing the supplied collection or owner keys", async () => {
  const logical = snapshot([descriptor(0), descriptor("a")])
  const expandedKeys = new Set<string | number>([0])
  const onExpandedChange = jest.fn()
  const { result } = await renderHook(() => useTreeState({ collection: logical, expandedKeys, onExpandedChange }))
  await act(() => result.current.toggleKey("a"))
  expect(result.current.collection).toBe(logical)
  expect([...result.current.expandedKeys]).toEqual([0])
  expect([...expandedKeys]).toEqual([0])
  expect([...onExpandedChange.mock.calls[0][0]]).toEqual([0, "a"])
})

it("uses logical navigation for actual range selection and focus recovery across missing and disabled rows", async () => {
  const nodes = [descriptor("a"), descriptor("b"), descriptor("c"), descriptor("d")]
  const initial = snapshot(nodes)
  const { result, rerender } = await renderHook(
    ({ collection }: { collection: ReturnType<typeof snapshot> }) =>
      useListState({ collection, selectionMode: "multiple", disabledKeys: ["c"] }),
    { initialProps: { collection: initial } },
  )
  await act(() => result.current.selectionManager.replaceSelection("a"))
  await act(() => {
    result.current.selectionManager.extendSelection("d")
    result.current.selectionManager.setFocusedKey("b")
  })
  expect([...result.current.selectionManager.selectedKeys]).toEqual(["a", "b", "d"])
  const removed = createNativeCollectionSnapshot([nodes[0], nodes[2], nodes[3]], initial)
  await rerender({ collection: removed })
  expect(result.current.selectionManager.focusedKey).toBe("d")
  expect(result.current.collection).toBe(removed)
  expect(initial.getKeyAfter("b")).toBe("c")
})

it("rejects duplicate, missing and invalid keys without evaluating renderers", () => {
  const item = descriptor("a")
  expect(() => snapshot([item, item])).toThrow("Duplicate")
  expect(() => snapshot([{ ...item, key: undefined } as unknown as TNativeCollectionItem<TValue>])).toThrow(
    "explicit stable keys",
  )
  expect(() => snapshot([{ ...item, key: NaN }])).toThrow("explicit stable keys")
  const cyclic = { ...item, children: [] as TNativeCollectionItem<TValue>[] }
  cyclic.children.push(cyclic)
  expect(() => snapshot([cyclic])).toThrow()
})

it("preserves section children, column spans and complete empty branches", () => {
  const section = {
    ...descriptor("section", "section"),
    children: [descriptor("header", "header"), descriptor("a"), descriptor("b")],
  }
  const collection = snapshot([section, { ...descriptor("empty", "section"), children: [] }])
  expect([...collection.getChildren("section")].map((node) => node.key)).toEqual(["header", "a", "b"])
  expect(collection.size).toBe(2)
  expect(collection.getItem("empty")!.hasChildNodes).toBe(false)
  expect(collection.getItem("b")!.index).toBe(2)
  const columns = snapshot([{ ...descriptor("x", "column"), colSpan: 2 }, descriptor("y", "column")])
  expect(columns.getItem("y")!.colIndex).toBe(2)
})

it("retains source label and span history while explicit item revisions advance", () => {
  const original = { ...descriptor("a", "column"), "aria-label": "Accessible", colSpan: 3 }
  const first = snapshot([original])
  const next = createNativeCollectionSnapshot([{ ...descriptor("a", "column"), colSpan: null }], first)
  expect(next.getItem("a")!["aria-label"]).toBe("Accessible")
  expect(next.getItem("a")!.colSpan).toBe(3)
})
