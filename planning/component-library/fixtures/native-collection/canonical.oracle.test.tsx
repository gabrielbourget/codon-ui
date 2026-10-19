import { writeFileSync } from "node:fs"

import { act, render, screen } from "@testing-library/react"
import { Activity, createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { CollectionRendererContext, DefaultCollectionRenderer, I18nProvider } from "react-aria-components"
import { afterAll, expect, it, vi } from "vitest"

import Tag from "../../../../packages/react/src/components/TagGroup/AdobeTag/AdobeTag"
import TagGroup from "../../../../packages/react/src/components/TagGroup/TagGroup"

type TRenderer = React.ContextType<typeof CollectionRendererContext>
type TObservedNode = { key: string | number; render: (node: unknown) => ReactNode }
const collectionNodes = (items: Iterable<unknown>) =>
  Array.from(items, (node) => {
    if (
      typeof node !== "object" ||
      node === null ||
      !("key" in node) ||
      (typeof node.key !== "string" && typeof node.key !== "number") ||
      !("render" in node) ||
      typeof node.render !== "function"
    )
      throw new TypeError("The canonical collection observer requires keyed renderable nodes")
    return node as TObservedNode
  })
const records: unknown[] = []
afterAll(() =>
  writeFileSync("/private/tmp/codon-native-collection-canonical.json", JSON.stringify(records, null, 2) + "\n"),
)
const rows = () => screen.queryAllByRole("row").map((row) => row.textContent)
const observer = (visibleLimit?: number) => {
  const current = { keys: [] as (string | number)[], lookupKeys: [] as (string | number)[] }
  const renderer: TRenderer = {
    ...DefaultCollectionRenderer,
    CollectionRoot: (props) => {
      const nodes = collectionNodes(props.collection)
      current.keys = nodes.map((node) => node.key)
      current.lookupKeys = Array.from(props.collection.getKeys())
      if (visibleLimit === undefined) return <DefaultCollectionRenderer.CollectionRoot {...props} />
      return <>{nodes.slice(0, visibleLimit).map((node) => node.render(node))}</>
    },
  }
  return { current, renderer }
}
const fixture = (children: ReactNode, renderer: TRenderer = DefaultCollectionRenderer) => (
  <I18nProvider locale="en-US">
    <CollectionRendererContext.Provider value={renderer}>
      <TagGroup aria-label="Tags">{children}</TagGroup>
    </CollectionRendererContext.Provider>
  </I18nProvider>
)
const Opaque = ({ order }: { order: string[] }) => (
  <>
    {order.map((id) => (
      <Tag key={id} id={id} textValue={id}>
        {id}
      </Tag>
    ))}
  </>
)

it("commits opaque keyed reorder as logical and visible order", async () => {
  const { current, renderer } = observer()
  const view = render(fixture(<Opaque order={["a", "b", "c"]} />, renderer))
  expect(current.keys).toEqual(["a", "b", "c"])
  await act(() => view.rerender(fixture(<Opaque order={["b", "c", "a"]} />, renderer)))
  expect(current.keys).toEqual(["b", "c", "a"])
  expect(rows()).toEqual(["b", "c", "a"])
  records.push({
    case: "opaque parent reorder",
    logical: current.keys,
    lookupOrder: current.lookupKeys,
    visible: rows(),
  })
})

it("commits child-local reorder without remounting its opaque owner", async () => {
  const { current, renderer } = observer(),
    mounted = vi.fn(),
    retired = vi.fn()
  let update!: (next: string[]) => void
  const Stateful = () => {
    const [order, setOrder] = useState(["a", "b", "c"])
    update = setOrder
    useEffect(() => {
      mounted()
      return retired
    }, [])
    return <Opaque order={order} />
  }
  render(fixture(<Stateful />, renderer))
  await act(() => update(["c", "a", "b"]))
  expect(current.keys).toEqual(["c", "a", "b"])
  expect(rows()).toEqual(["c", "a", "b"])
  expect(mounted).toHaveBeenCalledTimes(1)
  expect(retired).not.toHaveBeenCalled()
  records.push({ case: "child-local reorder", logical: current.keys, mounts: 1, retirements: 0 })
})

it("preserves a generated ID's identity and authored order among explicit IDs", async () => {
  const { current, renderer } = observer()
  const generated = (
      <Tag key="generated" textValue="generated">
        generated
      </Tag>
    ),
    explicit = (
      <Tag key="b" id="b" textValue="b">
        b
      </Tag>
    )
  const view = render(fixture([generated, explicit], renderer))
  const id = current.keys[0]
  expect(typeof id).toBe("string")
  expect(current.keys).toEqual([id, "b"])
  await act(() => view.rerender(fixture([explicit, generated], renderer)))
  expect(current.keys).toEqual(["b", id])
  expect(rows()).toEqual(["b", "generated"])
  records.push({ case: "generated and explicit", generated: id, reordered: current.keys })
})

it("removes Activity-hidden membership then restores it without rewriting selected owner keys", async () => {
  const { current, renderer } = observer(),
    owner = new Set(["a", "missing"]),
    change = vi.fn()
  const node = (hidden: boolean) => (
    <CollectionRendererContext.Provider value={renderer}>
      <TagGroup aria-label="Tags" selectionMode="multiple" selectedKeys={owner} onSelectionChange={change}>
        <Activity mode={hidden ? "hidden" : "visible"}>
          <Tag id="a" textValue="a">
            a
          </Tag>
        </Activity>
        <Tag id="b" textValue="b">
          b
        </Tag>
      </TagGroup>
    </CollectionRendererContext.Provider>
  )
  const view = render(node(false))
  expect(current.keys).toEqual(["a", "b"])
  await act(() => view.rerender(node(true)))
  expect(current.keys).toEqual(["b"])
  await act(() => view.rerender(node(false)))
  expect(current.keys).toEqual(["a", "b"])
  expect([...owner]).toEqual(["a", "missing"])
  expect(change).not.toHaveBeenCalled()
  records.push({
    case: "Activity hidden",
    hidden: ["b"],
    restored: current.keys,
    heldSelection: [...owner],
    requests: 0,
  })
})

it("keeps full logical membership when the renderer materializes one or no rows", async () => {
  const one = observer(1),
    zero = observer(0)
  const content = <Opaque order={["a", "b", "c"]} />
  const view = render(fixture(content, one.renderer))
  expect(one.current.keys).toEqual(["a", "b", "c"])
  expect(rows()).toEqual(["a"])
  await act(() => view.rerender(fixture(content, zero.renderer)))
  expect(zero.current.keys).toEqual(["a", "b", "c"])
  expect(rows()).toEqual([])
  expect(screen.getByTestId("tag-list")).not.toHaveAttribute("data-empty")
  records.push({ case: "renderer subset", logical: zero.current.keys, visible: [], logicallyEmpty: false })
})

it("updates opaque collection props through the original ancestor context", async () => {
  const Context = createContext(["a", "b", "c"])
  const ContextItems = () => <Opaque order={useContext(Context)} />
  const { current, renderer } = observer()
  const node = (order: string[]) => (
    <Context.Provider value={order}>{fixture(<ContextItems />, renderer)}</Context.Provider>
  )
  const view = render(node(["a", "b", "c"]))
  await act(() => view.rerender(node(["b", "c", "a"])))
  expect(current.keys).toEqual(["b", "c", "a"])
  records.push({ case: "ancestor context", logical: current.keys })
})
