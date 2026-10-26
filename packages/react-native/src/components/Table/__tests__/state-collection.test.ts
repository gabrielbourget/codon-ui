import {
  createNativeCollectionSnapshot,
  getNativeCollectionMetadataIdentity,
  type TNativeCollectionDescriptor,
  type TNativeCollectionHierarchyEntry,
  type TNativeCollectionKey,
} from "../../../collection/snapshot"
import { NativeTableCollection } from "../state/TableCollection"

type TEntry = {
  key: TNativeCollectionKey
  type: string
  props?: object
  text?: string
  span?: number
  value?: object
  children?: TEntry[]
}
const value = { id: "a", name: "Alpha" }
const source = (
  rows: TEntry[] = [
    {
      key: "a",
      type: "item",
      value,
      children: [
        { key: "a-name", type: "cell", text: "Alpha" },
        { key: "a-value", type: "cell" },
      ],
    },
    {
      key: "b",
      type: "item",
      children: [
        { key: "b-name", type: "cell", text: "Beta" },
        { key: "b-value", type: "cell" },
      ],
    },
  ],
) => {
  const descriptors = new Map<string, TNativeCollectionDescriptor<object>>()
  const hierarchy: TNativeCollectionHierarchyEntry[] = []
  const visit = (entries: TEntry[], parent = "") =>
    entries.forEach((entry, index) => {
      const id = `descriptor-${hierarchy.length}`
      descriptors.set(id, {
        descriptorId: id,
        descriptorRevision: `${id}-revision`,
        key: entry.key,
        type: entry.type,
        props: entry.props ?? {},
        value: entry.value ?? null,
        rendered: null,
        textValue: entry.text ?? "",
        colSpan: entry.span,
      })
      hierarchy.push({
        descriptorId: id,
        descriptorRevision: `${id}-revision`,
        parentDescriptorId: parent,
        target: 100 + hierarchy.length,
        index,
        retainedIndex: index,
        hasRetainedChildren: !!entry.children?.length,
      })
      visit(entry.children ?? [], id)
    })
  visit([
    {
      key: "head",
      type: "header",
      children: [
        { key: "name", type: "column", props: { isRowHeader: true, columnID: "name" } },
        { key: "value", type: "column", props: { columnID: "value" } },
      ],
    },
    { key: "body", type: "body", children: rows },
  ])
  return createNativeCollectionSnapshot(hierarchy, descriptors)
}

it("matches the actual canonical row/column/header navigation and preserves original metadata identities", () => {
  const original = source()
  const collection = new NativeTableCollection(original)
  expect([...collection].map((node) => node.type)).toEqual(["tableheader", "tablebody"])
  expect([
    collection.getFirstKey(),
    collection.getLastKey(),
    collection.getKeyAfter("a"),
    collection.getKeyBefore("b"),
    collection.getKeyBefore("a"),
  ]).toEqual(["a", "b", "b", "a", null])
  expect([collection.getKeyAfter("name"), collection.getKeyBefore("value")]).toEqual(["value", "name"])
  expect(collection.columns.map((node) => [node.key, node.index, node.colIndex, node.colSpan])).toEqual([
    ["name", 0, 0, null],
    ["value", 1, 1, null],
  ])
  expect(
    collection.headerRows.map((row) => [row.key, ...[...collection.getChildren(row.key)].map((node) => node.key)]),
  ).toEqual([["headerrow-0", "name", "value"]])
  expect([...collection.rowHeaderColumnKeys]).toEqual(["name"])
  expect(collection.getItem("a")!.value === value).toBe(true)
  expect(collection.getItem("a")!.props === original.getItem("a")!.props).toBe(true)
  expect(getNativeCollectionMetadataIdentity(collection.getItem("a")!)).toBe(
    getNativeCollectionMetadataIdentity(original.getItem("a")!),
  )
  expect(getNativeCollectionMetadataIdentity(collection.headerRows[0])).toBeUndefined()
  expect(Object.isFrozen(collection)).toBe(true)
})
it("retains the source row text override and row-header cell fallback", () => {
  const collection = new NativeTableCollection(source())
  expect(collection.getTextValue("a")).toBe("Alpha")
  expect(collection.getTextValue("missing")).toBe("")
  expect(
    new NativeTableCollection(
      source([{ key: "a", type: "item", text: "Explicit", children: [{ key: "one", type: "cell", span: 2 }] }]),
    ).getTextValue("a"),
  ).toBe("Explicit")
})
it("filters rows by their actual child cells, retaining columns, raw data and descriptor leases", () => {
  const collection = new NativeTableCollection(source())
  expect(collection.filter((_text, node) => node.key === "b").rows).toEqual([])
  const filtered = collection.filter((_text, node) => node.parentKey === "b")
  expect(filtered.rows.map((node) => node.key)).toEqual(["b"])
  expect(filtered.getItem("a")).toBeNull()
  expect(filtered.getFirstKey()).toBe("b")
  expect(filtered.getKeyBefore("b")).toBeNull()
  expect(filtered.columns.map((node) => node.key)).toEqual(["name", "value"])
  expect(getNativeCollectionMetadataIdentity(filtered.getItem("b")!)).toBe(
    getNativeCollectionMetadataIdentity(collection.getItem("b")!),
  )
  expect(collection.rows.map((node) => node.key)).toEqual(["a", "b"])
})
it("validates actual spanning-cell counts and retains the first cell's null source colIndex", () => {
  const collection = new NativeTableCollection(
    source([{ key: "a", type: "item", children: [{ key: "span", type: "cell", span: 2 }] }]),
  )
  expect([collection.getItem("span")!.colSpan, collection.getItem("span")!.colIndex]).toEqual([2, null])
  expect(
    () => new NativeTableCollection(source([{ key: "a", type: "item", children: [{ key: "short", type: "cell" }] }])),
  ).toThrow("Cell count must match column count. Found 1 cells and 2 columns.")
})
it("flattens expanded rows into the body and exposes only cells as each row's children", () => {
  const root = source([
    {
      key: "a",
      type: "item",
      children: [
        { key: "a-name", type: "cell" },
        { key: "a-value", type: "cell" },
        {
          key: "child",
          type: "item",
          children: [
            { key: "child-name", type: "cell" },
            { key: "child-value", type: "cell" },
          ],
        },
      ],
    },
    {
      key: "b",
      type: "item",
      children: [
        { key: "b-name", type: "cell" },
        { key: "b-value", type: "cell" },
      ],
    },
  ])
  const collapsed = new NativeTableCollection(root)
  const expanded = collapsed.withExpandedKeys(new Set(["a"]))
  expect(collapsed.rows.map((node) => node.key)).toEqual(["a", "b"])
  expect(expanded.rows.map((node) => node.key)).toEqual(["a", "child", "b"])
  expect([...expanded.getChildren("a")].map((node) => node.key)).toEqual(["a-name", "a-value"])
  expect(expanded.getKeyBefore("b")).toBe("child")
  expect(expanded.getKeyAfter("child")).toBe("b")
  expect(expanded.columns === collapsed.columns).toBe(true)
  expect(collapsed.clone().rows === collapsed.rows).toBe(true)
})
it("keeps the accepted native zero/empty-key traversal and missing-key null contract", () => {
  const collection = new NativeTableCollection(
    source([
      { key: 0, type: "item", children: [{ key: "zero", type: "cell", span: 2 }] },
      { key: "", type: "item", children: [{ key: "empty", type: "cell", span: 2 }] },
    ]),
  )
  expect(collection.rows.map((node) => node.key)).toEqual([0, ""])
  expect(collection.getKeyAfter(0)).toBe("")
  expect(collection.getKeyBefore("")).toBe(0)
  expect(collection.getKeyBefore("absent")).toBeNull()
  expect(() => collection.at(0)).toThrow("Not implemented")
})
