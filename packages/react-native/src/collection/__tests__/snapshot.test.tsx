import { act, renderHook } from "@testing-library/react-native"
import { createRef } from "react"
import type { View } from "react-native"

import {
  createNativeCollectionSnapshot,
  getNativeCollectionMetadataIdentity,
  type TNativeCollectionDescriptor,
  type TNativeCollectionHierarchyEntry,
} from "../snapshot"
import { useListState, useTreeState } from "../state"

type TValue = { id: string | number }
const descriptor = (key: string | number, type = "item"): TNativeCollectionDescriptor<TValue> => ({
  descriptorId: `${typeof key}:${key}`,
  descriptorRevision: "1",
  key,
  type,
  value: { id: key },
  textValue: String(key),
  rendered: String(key),
  props: { ref: createRef<View>() },
})
const entries = (descriptors: readonly TNativeCollectionDescriptor<TValue>[]): TNativeCollectionHierarchyEntry[] =>
  descriptors.map((node, index) => ({
    descriptorId: node.descriptorId,
    descriptorRevision: node.descriptorRevision,
    parentDescriptorId: "",
    target: index + 10,
    index,
    retainedIndex: index,
    hasRetainedChildren: false,
  }))
const snapshot = (descriptors: readonly TNativeCollectionDescriptor<TValue>[]) =>
  createNativeCollectionSnapshot(entries(descriptors), new Map(descriptors.map((node) => [node.descriptorId, node])))

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
  expect(getNativeCollectionMetadataIdentity(node)?.metadataTarget).toBe(10)
  expect(getNativeCollectionMetadataIdentity(logical.filter(() => true).getItem(0)!)?.metadataTarget).toBe(10)
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
  const descriptors = new Map(nodes.map((node) => [node.descriptorId, node]))
  const initial = createNativeCollectionSnapshot(entries(nodes), descriptors)
  const reordered = createNativeCollectionSnapshot(entries([nodes[1], nodes[2], nodes[0]]), descriptors, initial)
  expect([...reordered].map((node) => node.key)).toEqual(["b", "c", "a"])
  expect([...reordered.getKeys()]).toEqual(["a", "b", "c"])
  expect(reordered.getFirstKey()).toBe("b")
  expect(reordered.getLastKey()).toBe("a")
  expect(reordered.getKeyAfter("c")).toBe("a")
  expect([...initial].map((node) => node.key)).toEqual(["a", "b", "c"])
  const removed = createNativeCollectionSnapshot(entries([nodes[1], nodes[2]]), descriptors, reordered)
  const restored = createNativeCollectionSnapshot(entries(nodes), descriptors, removed)
  expect([...restored.getKeys()]).toEqual(["b", "c", "a"])
  expect([...restored].map((node) => node.key)).toEqual(["a", "b", "c"])
})

it("filters a submenu by its trigger label and retains the original whole branch only on a match", () => {
  const branch = descriptor("submenu", "submenutrigger"),
    trigger = { ...descriptor(0), textValue: "More actions" },
    sibling = descriptor("other")
  const descriptors = [branch, trigger, sibling]
  const hierarchy = entries(descriptors).map((entry, index) => ({
    ...entry,
    parentDescriptorId: index === 1 ? branch.descriptorId : "",
    index: index === 2 ? 1 : 0,
    retainedIndex: index === 2 ? 1 : 0,
    hasRetainedChildren: index === 0,
  }))
  const original = createNativeCollectionSnapshot(
    hierarchy,
    new Map(descriptors.map((node) => [node.descriptorId, node])),
  )
  const filter = jest.fn((text: string) => text === "More actions")
  const matched = original.filter(filter)
  expect([...matched].map((node) => node.key)).toEqual(["submenu"])
  expect([...matched.getChildren("submenu")].map((node) => node.key)).toEqual([0])
  expect(matched.getItem(0)?.value).toBe(trigger.value)
  expect(getNativeCollectionMetadataIdentity(matched.getItem(0)!)?.metadataTarget).toBe(11)
  expect(filter.mock.calls.map(([text]) => text)).toEqual(["More actions", "other"])
  expect(original.filter(() => false).size).toBe(0)
  expect(original.getItem(0)?.value).toBe(trigger.value)
})

it("treats a replacement descriptor with the same business key as a new lookup lifetime", () => {
  const a = descriptor("a"),
    b = descriptor("b")
  const initial = snapshot([a, b])
  const replacement = { ...a, descriptorId: "replacement" }
  const next = createNativeCollectionSnapshot(
    entries([replacement, b]),
    new Map([
      [replacement.descriptorId, replacement],
      [b.descriptorId, b],
    ]),
    initial,
  )
  expect([...next.getKeys()]).toEqual(["b", "a"])
  expect(getNativeCollectionMetadataIdentity(next.getItem("a")!)?.descriptorId).toBe("replacement")
  expect(getNativeCollectionMetadataIdentity(initial.getItem("a")!)?.descriptorId).toBe(a.descriptorId)
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
  const removed = createNativeCollectionSnapshot(
    entries([nodes[0], nodes[2], nodes[3]]),
    new Map(nodes.map((node) => [node.descriptorId, node])),
    initial,
  )
  await rerender({ collection: removed })
  expect(result.current.selectionManager.focusedKey).toBe("d")
  expect(result.current.collection).toBe(removed)
  expect(initial.getKeyAfter("b")).toBe("c")
})

it.each(["cycle", "reopened-parent", "duplicate-target", "missing-revision"])(
  "rejects malformed complete hierarchy: %s",
  (kind) => {
    const nodes = [descriptor("a"), descriptor("b"), descriptor("c")]
    const hierarchy = entries(nodes)
    if (kind === "cycle") hierarchy[0] = { ...hierarchy[0], parentDescriptorId: nodes[0].descriptorId }
    if (kind === "reopened-parent")
      hierarchy.push({ ...hierarchy[0], descriptorId: "fourth", parentDescriptorId: nodes[0].descriptorId })
    if (kind === "duplicate-target") hierarchy[1] = { ...hierarchy[1], target: hierarchy[0].target }
    if (kind === "missing-revision") hierarchy[1] = { ...hierarchy[1], descriptorRevision: "not-committed" }
    expect(() =>
      createNativeCollectionSnapshot(hierarchy, new Map(nodes.map((node) => [node.descriptorId, node]))),
    ).toThrow()
  },
)
