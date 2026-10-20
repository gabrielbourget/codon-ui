import { writeFileSync } from "node:fs"

import { createRef } from "react"
import { afterAll, expect, it } from "vitest"

import type * as TSource from "../../../../packages/react/node_modules/react-aria/dist/types/src/collections/BaseCollection"
import type * as TDocument from "../../../../packages/react/node_modules/react-aria/dist/types/src/collections/Document"
import {
  createNativeCollectionSnapshot,
  getNativeCollectionMetadataIdentity,
  type TNativeCollectionDescriptor,
  type TNativeCollectionHierarchyEntry,
  type TNativeCollectionSnapshot,
} from "../../../../packages/react-native/src/collection/snapshot"

// These are the actual installed implementation files, never native production imports or a replacement oracle.
const basePath = "../../../../packages/react/node_modules/react-aria/dist/private/collections/BaseCollection.mjs"
const documentPath = "../../../../packages/react/node_modules/react-aria/dist/private/collections/Document.mjs"
const source = (await import(basePath)) as typeof TSource
const { Document } = (await import(documentPath)) as typeof TDocument
type TValue = { title: string }
type TCollection = TSource.BaseCollection<TValue> | TNativeCollectionSnapshot<TValue>
class SeparatorNode extends source.CollectionNode<TValue> {
  static override readonly type = "separator"
}
class ContentNode extends source.CollectionNode<TValue> {
  static override readonly type = "content"
}
const records: unknown[] = []
afterAll(() =>
  writeFileSync("/private/tmp/codon-native-collection-snapshot-oracle.json", JSON.stringify(records, null, 2) + "\n"),
)

const observe = (collection: TCollection) => ({
  size: collection.size,
  logical: Array.from(collection, (node) => node.key),
  lookup: [...collection.getKeys()],
  first: collection.getFirstKey(),
  last: collection.getLastKey(),
  nodes: [...collection.getKeys()].map((key) => {
    const node = collection.getItem(key)!
    return {
      key,
      type: node.type,
      index: node.index,
      level: node.level,
      parent: node.parentKey,
      previous: node.prevKey,
      next: node.nextKey,
      first: node.firstChildKey,
      last: node.lastChildKey,
      hasChildren: node.hasChildNodes,
      before: collection.getKeyBefore(key),
      after: collection.getKeyAfter(key),
      children: Array.from(collection.getChildren(key), (child) => child.key),
      text: node.textValue,
      ariaLabel: node["aria-label"],
      colSpan: "colSpan" in node ? node.colSpan : null,
      colIndex: "colIndex" in node ? node.colIndex : null,
    }
  }),
})

const fixture = () => {
  const document = new Document<TValue>(new source.BaseCollection())
  const descriptors = new Map<string, TNativeCollectionDescriptor<TValue>>()
  const elements = new Map<string, TDocument.ElementNode<TValue>>()
  const retainedParents = new Set<string>()
  const add = (
    id: string,
    key: string | number,
    type: "item" | "section" | "header" | "separator" | "content" = "item",
    parent = "",
    colSpan?: number,
  ) => {
    const classes = {
      item: source.ItemNode,
      section: source.SectionNode,
      header: source.HeaderNode,
      separator: SeparatorNode,
      content: ContentNode,
    }
    const element = document.createElement(type)
    const value = { title: String(key) }
    const ref = createRef<HTMLDivElement>()
    const rendered = <>{String(key)}</>
    const render = () => <>{rendered}</>
    element.setProps({ id: key, value, textValue: String(key), colSpan }, ref, classes[type], rendered, render)
    ;(parent ? elements.get(parent)! : document).appendChild(element)
    elements.set(id, element)
    if (parent) retainedParents.add(parent)
    descriptors.set(id, {
      descriptorId: id,
      descriptorRevision: "1",
      key,
      type,
      value,
      rendered,
      render,
      textValue: String(key),
      props: { ref, colSpan },
      colSpan,
    })
    return element
  }
  const native = (
    rows: readonly (string | readonly [string, string, number])[],
    previous?: TNativeCollectionSnapshot<TValue>,
  ) => {
    const positions = new Map<string, number>()
    const hierarchy: TNativeCollectionHierarchyEntry[] = rows.map((row) => {
      const [id, parent, retainedIndex] = typeof row === "string" ? [row, "", positions.get("") ?? 0] : row
      const index = positions.get(parent) ?? 0
      positions.set(parent, index + 1)
      return {
        descriptorId: id,
        descriptorRevision: "1",
        parentDescriptorId: parent,
        index,
        retainedIndex,
        hasRetainedChildren: retainedParents.has(id),
        target: [...descriptors.keys()].indexOf(id) + 100,
      }
    })
    return createNativeCollectionSnapshot(hierarchy, descriptors, previous)
  }
  const compare = (name: string, logical: TNativeCollectionSnapshot<TValue>) => {
    const canonical = document.getCollection()
    expect(observe(logical)).toEqual(observe(canonical))
    records.push({
      case: name,
      source: observe(canonical),
      native: observe(logical),
      scope: "Actual pinned Document/BaseCollection source; synthetic native hierarchy input only",
    })
    return canonical
  }
  return { document, add, native, compare, elements, descriptors }
}

it("matches typed keys, reorder lookup order, hidden raw indices and restored lifetimes", () => {
  const f = fixture()
  const a = f.add("a", 0),
    b = f.add("b", "0"),
    c = f.add("c", "c")
  const initial = f.native(["a", "b", "c"])
  f.compare("typed initial", initial)
  f.document.appendChild(a)
  const reordered = f.native(["b", "c", "a"], initial)
  f.compare("keyed reorder", reordered)
  b.style.display = "none"
  const hidden = f.native(
    [
      ["c", "", 1],
      ["a", "", 2],
    ],
    reordered,
  )
  f.compare("hidden retained-index gap", hidden)
  b.style.display = ""
  const restored = f.native(["b", "c", "a"], hidden)
  f.compare("restored membership insertion", restored)
  expect(observe(initial).logical).toEqual([0, "0", "c"])
  expect(restored.getItem("c")?.value).toBe(c.node?.value)
  expect(restored.getItem(0)?.render).toBe(a.node?.render)
  expect(restored.getItem(0)?.props.ref).toBe(a.node?.props.ref)
})

it("matches complete nested section/content links, item levels, lookup membership and column propagation", () => {
  const f = fixture()
  f.add("s", "section", "section")
  f.add("h", "header", "header", "s")
  f.add("a", "a", "item", "s", 2)
  f.add("content", "content", "content", "a")
  f.add("b", "b", "item", "s")
  f.add("separator", "separator", "separator")
  f.add("c", "c")
  const logical = f.native(["s", ["h", "s", 0], ["a", "s", 1], ["content", "a", 0], ["b", "s", 2], "separator", "c"])
  const canonical = f.compare("section/header/item/content/separator", logical)
  const predicate = (text: string) => text !== "b"
  expect(observe(logical.filter(predicate))).toEqual(observe(canonical.filter(predicate)))
  expect(() => logical.getItem("a")!.childNodes).toThrow("childNodes is not supported")
  expect(() => canonical.getItem("a")!.childNodes).toThrow("childNodes is not supported")
  records.push({
    case: "actual section filter",
    source: observe(canonical.filter(predicate)),
    native: observe(logical.filter(predicate)),
  })
})

it("preserves the pinned source's numeric-zero filtering edge rather than silently repairing it", () => {
  const f = fixture()
  f.add("a", "a")
  f.add("zero", 0)
  f.add("b", "b")
  const logical = f.native(["a", "zero", "b"])
  const canonical = f.compare("zero-key filter input", logical)
  const filtered = logical.filter(() => true)
  expect(observe(filtered)).toEqual(observe(canonical.filter(() => true)))
  expect([...filtered.getKeys()]).toEqual(["a"])
  records.push({
    case: "source zero-key filter edge",
    source: observe(canonical.filter(() => true)),
    native: observe(filtered),
  })
})

it("preserves retained child membership and cached column identity when logical nodes hide", () => {
  const f = fixture()
  const a = f.add("a", "a", "item", "", 2)
  const content = f.add("content", "content", "content", "a")
  f.add("b", "b")
  const initial = f.native(["a", ["content", "a", 0], "b"])
  f.compare("retained child initial", initial)
  content.style.display = "none"
  const hiddenContent = f.native(["a", "b"], initial)
  f.compare("parent retains only hidden child", hiddenContent)
  expect(hiddenContent.getItem("a")?.hasChildNodes).toBe(true)
  expect([...hiddenContent.getChildren("a")]).toEqual([])
  a.style.display = "none"
  const hiddenParent = f.native([["b", "", 1]], hiddenContent)
  f.compare("hidden preceding column span", hiddenParent)
  expect(hiddenParent.getItem("b")?.colIndex).toBe(2)
})

it("matches actual duplicate business-key map replacement independently from unique private descriptor identities", () => {
  const f = fixture()
  f.add("first", "x")
  f.add("b", "b")
  f.add("last", "x")
  f.add("c", "c")
  const logical = f.native(["first", "b", "last", "c"])
  f.compare("duplicate business-key replacement", logical)
  expect(getNativeCollectionMetadataIdentity(logical.getItem("x")!)?.descriptorId).toBe("last")
  expect([...logical].map((node) => node.key)).toEqual(["x", "c"])
  expect([...logical.getKeys()]).toEqual(["x", "b", "c"])
})

it("retains the actual source changed-ID and unimplemented-at contracts", () => {
  const f = fixture()
  const a = f.add("a", "a")
  const logical = f.native(["a"])
  const canonical = f.compare("changed-ID/at input", logical)
  expect(() => a.setProps({ id: "changed" }, null, source.ItemNode)).toThrow("Cannot change the id of an item")
  expect(() => canonical.at()).toThrow("Not implemented")
  expect(() => logical.at(0)).toThrow("Not implemented")
})

it("preserves the source's retained nonempty node label after its authored prop clears", () => {
  const f = fixture()
  const element = f.add("a", "a"),
    descriptor = f.descriptors.get("a")!
  element.setProps(
    { id: "a", value: descriptor.value, textValue: "a", "aria-label": "Original" },
    descriptor.props.ref,
    source.ItemNode,
    descriptor.rendered,
    descriptor.render,
  )
  f.descriptors.set("a", {
    ...descriptor,
    "aria-label": "Original",
    props: { ...descriptor.props, "aria-label": "Original" },
  })
  const initial = f.native(["a"])
  f.compare("authored node label", initial)
  element.setProps(
    { id: "a", value: descriptor.value, textValue: "a", "aria-label": undefined },
    descriptor.props.ref,
    source.ItemNode,
    descriptor.rendered,
    descriptor.render,
  )
  f.descriptors.set("a", {
    ...descriptor,
    "aria-label": undefined,
    props: { ...descriptor.props, "aria-label": undefined },
  })
  const cleared = f.native(["a"], initial)
  f.compare("cleared authored/retained node label", cleared)
  expect(cleared.getItem("a")?.["aria-label"]).toBe("Original")
  expect(cleared.getItem("a")?.props["aria-label"]).toBeUndefined()
})
