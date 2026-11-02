import { createRef, useContext } from "react"
import { findNodeHandle, type View } from "react-native"

import { NativeFocusView } from "../../input/NativeFocusView"
import { NativeCollectionActionsContext, type NativeCollectionActions } from "../actions"
import {
  NativeCollectionBuilder,
  createNativeCollectionLeaf,
  useNativeCollectionOwnerRef,
  useNativeCollectionReceiverRef,
} from "../CollectionBuilder"
import type { TNativeCollectionModelSnapshot } from "../model"
import { renderNativeCollectionNode } from "../renderer"
import type { TNativeCollectionItem, TNativeCollectionNode, TNativeCollectionSnapshot } from "../snapshot"

import {
  actWithNativeCollections as act,
  confirmNativeCollections,
  inspectSourceCollectionBinding,
  renderWithNativeCollections as render,
  setSourceCollectionAcknowledgements,
  setSourceCollectionActionResponses,
  sourceCollectionPublications,
} from "./nativeReceipts"

const fixture = async () => {
  const original = createRef<View>()
  let actions!: NativeCollectionActions,
    node!: TNativeCollectionNode<object>,
    model!: TNativeCollectionModelSnapshot<object>
  const Leaf = createNativeCollectionLeaf<object, { hostKey: string }, View>("item", ({ hostKey }, ref, current) => {
    actions = useContext(NativeCollectionActionsContext)!
    node = current
    const receiver = useNativeCollectionReceiverRef(current, ref)
    return <NativeFocusView key={hostKey} ref={receiver} />
  })
  const Root = ({
    snapshot,
    collection,
  }: {
    snapshot: TNativeCollectionModelSnapshot<object>
    collection: TNativeCollectionSnapshot<object>
  }) => {
    model = snapshot
    const ref = useNativeCollectionOwnerRef(snapshot)
    return <NativeFocusView ref={ref}>{renderNativeCollectionNode(collection.getItem(0)!)}</NativeFocusView>
  }
  const content = (hostKey: string) => {
    const items: readonly TNativeCollectionItem<object>[] = [
      {
        key: 0,
        type: "item",
        value: {},
        props: {},
        rendered: null,
        textValue: "Zero",
        render: () => <Leaf hostKey={hostKey} ref={original} />,
      },
      {
        key: "",
        type: "item",
        value: {},
        props: {},
        rendered: null,
        textValue: "Offscreen",
        render: () => <Leaf hostKey="offscreen" />,
      },
    ]
    return (
      <NativeCollectionBuilder items={items}>
        {(collection, snapshot) => <Root {...{ collection, snapshot }} />}
      </NativeCollectionBuilder>
    )
  }
  const view = await render(content("first"))
  return {
    view,
    original,
    actions: () => actions,
    node: () => node,
    model: () => model,
    replace: () => view.rerender(content("replacement")),
  }
}

it("requires explicit source acknowledgements and action responses while leaving unmaterialized items unavailable", async () => {
  setSourceCollectionAcknowledgements(false)
  const state = await fixture(),
    action = jest.fn()
  expect(sourceCollectionPublications()[0].receivers).toHaveLength(1)
  expect(state.actions().bindingFor(state.node())).toBe("")
  expect(state.actions().request(state.node(), findNodeHandle(state.original.current)!, action)).toBe(false)
  expect(action).not.toHaveBeenCalled()
  setSourceCollectionAcknowledgements(true)
  await confirmNativeCollections()
  const binding = state.actions().bindingFor(state.node())
  expect(inspectSourceCollectionBinding(binding)?.target).toBe(findNodeHandle(state.original.current))
  expect(state.actions().bindingFor(state.model().collection.getItem("")!)).toBe("")
  setSourceCollectionActionResponses(false)
  await act(() => state.actions().request(state.node(), findNodeHandle(state.original.current)!, action))
  expect(action).not.toHaveBeenCalled()
  setSourceCollectionActionResponses(true)
  await act(() => {})
  expect(action).toHaveBeenCalledTimes(1)
})

it("rejects an action directed to a different original target", async () => {
  const state = await fixture(),
    action = jest.fn(),
    settled = jest.fn()
  const root = sourceCollectionPublications()[0].root!
  expect(root.tag).not.toBe(findNodeHandle(state.original.current))
  await act(() => state.actions().request(state.node(), root.tag, action, settled))
  expect(action).not.toHaveBeenCalled()
  expect(settled).toHaveBeenCalledWith("rejected")
})

it("retires replaced receiver leases and queued work before issuing a new source acknowledgement", async () => {
  const state = await fixture(),
    action = jest.fn(),
    settled = jest.fn()
  const old = state.original.current,
    binding = state.actions().bindingFor(state.node())
  setSourceCollectionActionResponses(false)
  await act(() => state.actions().request(state.node(), findNodeHandle(old)!, action, settled))
  setSourceCollectionAcknowledgements(false)
  await state.replace()
  expect(state.original.current).not.toBe(old)
  expect(inspectSourceCollectionBinding(binding)).toBeNull()
  expect(state.actions().bindingFor(state.node())).toBe("")
  expect(action).not.toHaveBeenCalled()
  expect(settled).toHaveBeenCalledWith("rejected")
  setSourceCollectionAcknowledgements(true)
  setSourceCollectionActionResponses(true)
  await act(() => {})
  expect(inspectSourceCollectionBinding(state.actions().bindingFor(state.node()))?.target).toBe(
    findNodeHandle(state.original.current),
  )
  expect(action).not.toHaveBeenCalled()
})
