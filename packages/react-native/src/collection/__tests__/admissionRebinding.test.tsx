import { act, render, screen } from "@testing-library/react-native"
import { createRef, useContext } from "react"
import type { View } from "react-native"

import { NativeFocusView } from "../../input/NativeFocusView"
import {
  NativeCollectionActionAdmissionContext,
  NativeCollectionActionsContext,
  type NativeCollectionActions,
  type TNativeCollectionActionAdmission,
} from "../actions"
import { NativeCollectionItemBindingContext } from "../binding"
import { NativeCollectionBuilder, createNativeCollectionLeaf, useNativeCollectionOwnerRef } from "../CollectionBuilder"
import type { TNativeCollectionModelSnapshot } from "../model"
import { DefaultNativeCollectionRenderer, renderNativeCollectionNode } from "../renderer"
import type { TNativeCollectionItem, TNativeCollectionSnapshot } from "../snapshot"

// Source-only adapter: native acknowledgement is controlled explicitly, never inferred from a JS registration.
const fixture = async (cachedCustomRenderer = false) => {
  const listeners = new Set<() => void>()
  let version = 0,
    lease = "",
    registered = false,
    receive: ((accepted: boolean) => void) | undefined
  const notify = () => {
    version++
    for (const listener of listeners) listener()
  }
  const cancel = jest.fn()
  const admission: TNativeCollectionActionAdmission = {
    registerOwner: () => {
      registered = true
      return () => {
        registered = false
      }
    },
    ownerLifetimeFor: () => (registered ? lease : ""),
    bindingFor: (scope) => (registered && lease ? JSON.stringify({ ...scope, lease }) : ""),
    request: (_scope, _binding, _target, callback) => {
      receive = callback
      return cancel
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getSnapshot: () => version,
  }
  const ref = createRef<View>()
  let actions: NativeCollectionActions | undefined, model: TNativeCollectionModelSnapshot<object> | undefined
  const Item = createNativeCollectionLeaf<object, object, View>("item", (_props, forwardedRef, node) => {
    actions = useContext(NativeCollectionActionsContext)!
    return (
      <NativeCollectionItemBindingContext.Provider value={actions.bindingFor(node)}>
        <NativeFocusView ref={forwardedRef} testID="receiver" />
      </NativeCollectionItemBindingContext.Provider>
    )
  })
  const renderItem = jest.fn(() => <Item ref={ref} />)
  const items: readonly TNativeCollectionItem<object>[] = [
    { key: "a", type: "item", value: {}, props: {}, rendered: null, textValue: "Alpha", render: renderItem },
  ]
  let customElement: ReturnType<typeof renderNativeCollectionNode> | undefined
  const Root = ({
    snapshot,
    collection,
  }: {
    snapshot: TNativeCollectionModelSnapshot<object>
    collection: TNativeCollectionSnapshot<object>
  }) => {
    const ownerRef = useNativeCollectionOwnerRef(snapshot)
    if (cachedCustomRenderer && !customElement) customElement = renderNativeCollectionNode(collection.getItem("a")!)
    return (
      <NativeFocusView ref={ownerRef}>
        {cachedCustomRenderer ? (
          customElement
        ) : (
          <DefaultNativeCollectionRenderer.CollectionRoot collection={collection} />
        )}
      </NativeFocusView>
    )
  }
  const result = await render(
    <NativeCollectionActionAdmissionContext.Provider value={admission}>
      <NativeCollectionBuilder items={items}>
        {(collection, snapshot) => {
          model = snapshot
          return <Root snapshot={snapshot} collection={collection} />
        }}
      </NativeCollectionBuilder>
    </NativeCollectionActionAdmissionContext.Provider>,
  )
  return {
    result,
    ref,
    renderItem,
    cancel,
    actions: () => actions!,
    model: () => model!,
    binding: () => screen.getByTestId("receiver").props.nativeCollectionBinding,
    acknowledge: (nextLease: string) => {
      lease = nextLease
      notify()
    },
    notify,
    receive: (accepted: boolean) => receive!(accepted),
  }
}

it.each([false, true])(
  "rebinds cached visible receivers on acknowledgement, replacement and revocation (custom: %s)",
  async (custom) => {
    const state = await fixture(custom)
    const original = state.ref.current,
      model = state.model(),
      actions = state.actions()
    expect(original).not.toBeNull()
    expect(state.binding()).toBe("")
    await act(() => state.acknowledge("native-lease:1"))
    expect(JSON.parse(state.binding()).lease).toBe("native-lease:1")
    await act(() => state.acknowledge("native-lease:2"))
    expect(JSON.parse(state.binding()).lease).toBe("native-lease:2")
    await act(() => state.acknowledge(""))
    expect(state.binding()).toBe("")
    expect(state.ref.current).toBe(original)
    expect(state.model()).toBe(model)
    expect(state.actions()).toBe(actions)
    expect(state.renderItem).toHaveBeenCalledTimes(1)
  },
)

it("does not replace logical actions or cancel a still-current queued operation on unrelated adapter notifications", async () => {
  const state = await fixture(),
    action = jest.fn(),
    settled = jest.fn()
  await act(() => state.acknowledge("native-lease:1"))
  const originalActions = state.actions(),
    node = state.model().collection.getItem("a")!
  expect(originalActions.request(node, 17, action, settled)).toBe(true)
  await act(state.notify)
  expect(state.actions()).toBe(originalActions)
  expect(state.cancel).not.toHaveBeenCalled()
  expect(action).not.toHaveBeenCalled()
  await act(() => state.receive(true))
  expect(action).toHaveBeenCalledTimes(1)
  expect(settled.mock.calls).toEqual([["accepted"]])
})

it("clears a revoked visible binding and rejects its late previously accepted native response", async () => {
  const state = await fixture(),
    action = jest.fn(),
    settled = jest.fn()
  await act(() => state.acknowledge("native-lease:1"))
  expect(state.actions().request(state.model().collection.getItem("a"), 17, action, settled)).toBe(true)
  await act(() => state.acknowledge(""))
  expect(state.binding()).toBe("")
  await act(() => state.receive(true))
  expect(action).not.toHaveBeenCalled()
  expect(settled.mock.calls).toEqual([["rejected"]])
})
