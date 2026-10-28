import "./nativeReceipts"

import { cleanup, render } from "@testing-library/react-native"
import type { ReactNode } from "react"
import { View, type NativeSyntheticEvent } from "react-native"

import MetadataNode from "../../input/specs/CUICollectionNodeNativeComponent"
import MetadataRoot, { type NativeCollectionCommitData } from "../../input/specs/CUICollectionRootNativeComponent"

import { confirmNativeCollections } from "./nativeReceipts"

afterEach(async () => {
  await cleanup()
  jest.restoreAllMocks()
})
const observer = () => jest.fn<void, [NativeSyntheticEvent<NativeCollectionCommitData>]>()

it("publishes a new root ID or revision even when its original target and descriptor hierarchy are unchanged", async () => {
  const observed = observer(),
    owner = "receipt-header-owner"
  const tree = (rootId: string, rootRevision: string) => (
    <MetadataRoot ownerId={owner} rootId={rootId} rootRevision={rootRevision} onNativeCollectionCommit={observed}>
      <MetadataNode ownerId={owner} rootId={rootId} descriptorId={`${owner}:item`} descriptorRevision="item:1" />
    </MetadataRoot>
  )
  const view = await render(tree("root-a", "revision-a"))
  expect(await confirmNativeCollections(view)).toBe(1)
  const first = observed.mock.calls[0][0].nativeEvent
  expect(await confirmNativeCollections(view)).toBe(0)
  await view.rerender(tree("root-a", "revision-b"))
  expect(await confirmNativeCollections(view)).toBe(1)
  const second = observed.mock.calls[1][0].nativeEvent
  expect(second).toMatchObject({
    rootId: "root-a",
    rootRevision: "revision-b",
    target: first.target,
    sequence: first.sequence + 1,
  })
  expect(second.hierarchy).toBe(first.hierarchy)
  await view.rerender(tree("root-b", "revision-b"))
  expect(await confirmNativeCollections(view)).toBe(1)
  const third = observed.mock.calls[2][0].nativeEvent
  expect(third).toMatchObject({
    rootId: "root-b",
    rootRevision: "revision-b",
    target: first.target,
    sequence: second.sequence + 1,
  })
  expect(third.hierarchy).toBe(first.hierarchy)
  expect(await confirmNativeCollections(view)).toBe(0)
})

it("serializes exact existing nested relationships, visibility, sibling positions and stable descriptor targets", async () => {
  const observed = observer(),
    owner = "receipt-tree-owner"
  const node = (id: string, children?: ReactNode) => (
    <MetadataNode key={id} ownerId={owner} rootId="tree" descriptorId={id} descriptorRevision={`${id}:1`}>
      {children}
    </MetadataNode>
  )
  const tree = (reverse: boolean) => {
    const group = node(
      "group",
      <View>
        {node("alpha")}
        <View style={{ display: "none" }}>{node("hidden")}</View>
        {node("branch", <View>{node("leaf")}</View>)}
      </View>,
    )
    const tail = node("tail")
    return (
      <MetadataRoot ownerId={owner} rootId="tree" rootRevision="tree:1" onNativeCollectionCommit={observed}>
        {reverse ? [tail, group] : [group, tail]}
      </MetadataRoot>
    )
  }
  const view = await render(tree(false))
  expect(await confirmNativeCollections(view)).toBe(1)
  const first = observed.mock.calls[0][0].nativeEvent
  type TNode = { descriptorId: string; target: number }
  const original = JSON.parse(first.hierarchy) as TNode[]
  const targets = new Map(original.map((node) => [node.descriptorId, node.target]))
  const expected = (descriptorId: string, parentDescriptorId: string, index: number, hasRetainedChildren: boolean) => ({
    descriptorId,
    descriptorRevision: `${descriptorId}:1`,
    parentDescriptorId,
    target: targets.get(descriptorId),
    index,
    retainedIndex: index,
    hasRetainedChildren,
  })
  expect(first).toMatchObject({
    ownerId: owner,
    rootId: "tree",
    rootRevision: "tree:1",
    complete: true,
    attached: true,
    metadataOnly: true,
    error: "",
  })
  expect(first.hierarchy).toBe(
    JSON.stringify([
      expected("group", "", 0, true),
      expected("alpha", "group", 0, false),
      expected("branch", "group", 1, true),
      expected("leaf", "branch", 0, false),
      expected("tail", "", 1, false),
    ]),
  )
  expect(new Set(targets.values()).size).toBe(5)
  expect(
    original.every((node, index) => node.target > 1000000 && (!index || node.target > original[index - 1].target)),
  ).toBe(true)
  await view.rerender(tree(true))
  expect(await confirmNativeCollections(view)).toBe(1)
  expect(observed.mock.calls[1][0].nativeEvent.hierarchy).toBe(
    JSON.stringify([
      expected("tail", "", 0, false),
      expected("group", "", 1, true),
      expected("alpha", "group", 0, false),
      expected("branch", "group", 1, true),
      expected("leaf", "branch", 0, false),
    ]),
  )
})

it("bounds parent traversal linearly for flat metadata behind opaque wrappers", async () => {
  const observed = observer(),
    owner = "receipt-cost-owner",
    count = 80
  const view = await render(
    <MetadataRoot ownerId={owner} rootId="cost" rootRevision="cost:1" onNativeCollectionCommit={observed}>
      <MetadataNode ownerId={owner} rootId="cost" descriptorId="cost-group" descriptorRevision="group:1">
        {Array.from({ length: count }, (_, index) => (
          <View key={index}>
            <MetadataNode ownerId={owner} rootId="cost" descriptorId={`cost:${index}`} descriptorRevision="item:1" />
          </View>
        ))}
      </MetadataNode>
    </MetadataRoot>,
  )
  const root = view.container.queryAll((host) => host.props.rootRevision === "cost:1")[0]
  const parent = jest.spyOn(Object.getPrototypeOf(root), "parent", "get")
  let reads = 0
  try {
    expect(await confirmNativeCollections(view)).toBe(1)
    reads = parent.mock.calls.length
  } finally {
    parent.mockRestore()
  }
  expect(JSON.parse(observed.mock.calls[0][0].nativeEvent.hierarchy)).toHaveLength(count + 1)
  expect(reads).toBeLessThan(20 * (count + 1))
})
