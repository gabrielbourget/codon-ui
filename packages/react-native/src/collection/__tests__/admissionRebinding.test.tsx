import { act, render, screen } from "@testing-library/react-native"
import { Activity, StrictMode, createRef, useContext } from "react"
import type { View } from "react-native"

import { NativeFocusView } from "../../input/NativeFocusView"
import {
  NativeCollectionActionAdmissionContext,
  NativeCollectionActionsContext,
  type NativeCollectionActions,
  type TNativeCollectionActionAdmission,
} from "../actions"
import { NativeCollectionItemBindingContext } from "../binding"
import {
  NativeCollectionBuilder,
  createNativeCollectionLeaf,
  useNativeCollectionOwnerRef,
  useNativeCollectionReceiverRef,
} from "../CollectionBuilder"
import {
  nativeCollectionOwnerBinding,
  type TNativeCollectionActionScope,
  type TNativeCollectionModelSnapshot,
} from "../model"
import { DefaultNativeCollectionRenderer, renderNativeCollectionNode } from "../renderer"
import type { TNativeCollectionItem, TNativeCollectionSnapshot } from "../snapshot"

// Source-only adapter: native acknowledgement is controlled explicitly, never inferred from a JS registration.
const fixture = async (cachedCustomRenderer = false) => {
  const listeners = new Set<() => void>()
  let version = 0,
    lease = "",
    registered = false,
    receive: ((accepted: boolean) => void) | undefined
  let rootReceipt: string | undefined, itemReceipt: string | undefined, ownerLifetime: string | undefined
  const notify = () => {
    version++
    for (const listener of listeners) listener()
  }
  const cancel = jest.fn(),
    renderOwner = jest.fn(),
    renderRoot = jest.fn(),
    retireOwner = jest.fn(),
    renderReceiver = jest.fn()
  const bindingFor = jest.fn((scope: TNativeCollectionActionScope) =>
    registered && lease ? JSON.stringify({ ...scope, lease: (scope.itemId ? itemReceipt : rootReceipt) ?? lease }) : "",
  )
  const admission: TNativeCollectionActionAdmission = {
    registerOwner: jest.fn((_binding: string, original: object) => {
      registered = true
      return () => {
        registered = false
        retireOwner(original)
      }
    }),
    ownerLifetimeFor: () => (registered ? (ownerLifetime ?? lease) : ""),
    bindingFor,
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
  const rootRef = createRef<View>()
  let actions: NativeCollectionActions | undefined, model: TNativeCollectionModelSnapshot<object> | undefined
  const Item = createNativeCollectionLeaf<object, object, View>("item", (_props, forwardedRef, node) => {
    actions = useContext(NativeCollectionActionsContext)!
    renderReceiver({ lifetime: actions.ownerLifetime(), binding: actions.bindingFor(node) })
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
    renderRoot()
    const ownerRef = useNativeCollectionOwnerRef(snapshot, rootRef)
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
          renderOwner()
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
    renderOwner,
    renderRoot,
    rootRef,
    registerOwner: admission.registerOwner as jest.Mock,
    retireOwner,
    renderReceiver,
    bindingFor,
    cancel,
    actions: () => actions!,
    model: () => model!,
    binding: () => screen.getByTestId("receiver").props.nativeCollectionBinding,
    acknowledge: (nextLease: string) => {
      lease = nextLease
      notify()
    },
    replaceRootReceipt: (next: string) => {
      rootReceipt = next
      notify()
    },
    replaceItemReceipt: (next: string) => {
      itemReceipt = next
      notify()
    },
    replaceOwnerLifetime: (next: string) => {
      ownerLifetime = next
      notify()
    },
    notify,
    notifyWithoutChange: () => {
      for (const listener of listeners) listener()
    },
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

it.each([false, true])(
  "does not rebuild unchanged owner or receiver receipts on notifications (custom: %s)",
  async (custom) => {
    const state = await fixture(custom)
    const original = state.ref.current
    const initialOwnerRenders = state.renderOwner.mock.calls.length
    const initialReceiverRenders = state.renderReceiver.mock.calls.length
    await act(state.notify)
    expect(state.renderOwner).toHaveBeenCalledTimes(initialOwnerRenders)
    expect(state.renderReceiver).toHaveBeenCalledTimes(initialReceiverRenders)
    await act(() => state.acknowledge("native-lease:1"))
    const ownerRenders = state.renderOwner.mock.calls.length
    const receiverRenders = state.renderReceiver.mock.calls.length
    const actions = state.actions(),
      node = state.model().collection.getItem("a")!,
      action = jest.fn(),
      settled = jest.fn()
    await act(() => {
      expect(actions.request(node, 17, action, settled)).toBe(true)
      state.notify()
      state.notify()
    })
    expect(state.renderOwner).toHaveBeenCalledTimes(ownerRenders)
    expect(state.renderReceiver).toHaveBeenCalledTimes(receiverRenders)
    expect(state.cancel).not.toHaveBeenCalled()
    expect(action).not.toHaveBeenCalled()
    await act(() => state.receive(true))
    expect(action).toHaveBeenCalledTimes(1)
    expect(settled.mock.calls).toEqual([["accepted"]])
    expect(state.ref.current).toBe(original)
    expect(state.actions()).toBe(actions)
  },
)

it("refreshes the relevant cached receiver and owner independently and observes lifetime-only retirement", async () => {
  const state = await fixture(true)
  await act(() => state.acknowledge("native-lease:1"))
  const original = state.ref.current,
    actions = state.actions(),
    model = state.model(),
    ownerRenders = state.renderOwner.mock.calls.length,
    receiverRenders = state.renderReceiver.mock.calls.length
  await act(() => state.replaceRootReceipt("root-receipt:2"))
  expect(state.renderOwner).toHaveBeenCalledTimes(ownerRenders + 1)
  expect(state.renderReceiver).toHaveBeenCalledTimes(receiverRenders)
  await act(() => state.replaceItemReceipt("item-receipt:2"))
  expect(state.renderOwner).toHaveBeenCalledTimes(ownerRenders + 1)
  expect(state.renderReceiver).toHaveBeenCalledTimes(receiverRenders + 1)
  const binding = state.binding()
  expect(JSON.parse(binding).lease).toBe("item-receipt:2")
  await act(() => state.replaceOwnerLifetime(""))
  expect(state.renderOwner).toHaveBeenCalledTimes(ownerRenders + 2)
  expect(state.renderReceiver).toHaveBeenCalledTimes(receiverRenders + 2)
  expect(state.renderReceiver).toHaveBeenLastCalledWith({ lifetime: "", binding })
  await act(() => state.replaceOwnerLifetime("replacement-window"))
  expect(state.renderOwner).toHaveBeenCalledTimes(ownerRenders + 3)
  expect(state.renderReceiver).toHaveBeenCalledTimes(receiverRenders + 3)
  expect(state.renderReceiver).toHaveBeenLastCalledWith({ lifetime: "replacement-window", binding })
  expect(state.ref.current).toBe(original)
  expect(state.actions()).toBe(actions)
  expect(state.model()).toBe(model)
  expect(state.renderItem).toHaveBeenCalledTimes(1)
})

it("keeps admission version notifications for a standalone receiver without a model", async () => {
  const listeners = new Set<() => void>()
  let version = 0
  const ref = createRef<View>(),
    rendered = jest.fn()
  const admission: TNativeCollectionActionAdmission = {
    registerOwner: () => () => {},
    ownerLifetimeFor: () => "",
    bindingFor: () => "",
    request: () => () => {},
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getSnapshot: () => version,
  }
  const Standalone = createNativeCollectionLeaf<object, object, View>("standalone", (_props, target) => {
    rendered(version)
    return <NativeFocusView ref={target} testID="standalone-receiver" />
  })
  const view = await render(
    <NativeCollectionActionAdmissionContext.Provider value={admission}>
      <Standalone ref={ref} />
    </NativeCollectionActionAdmissionContext.Provider>,
  )
  const original = ref.current
  expect(original).not.toBeNull()
  await act(() => {
    version++
    for (const listener of listeners) listener()
  })
  expect(rendered).toHaveBeenLastCalledWith(1)
  expect(ref.current).toBe(original)
  await view.unmount()
  expect(ref.current).toBeNull()
  expect(listeners.size).toBe(0)
})

it("does not repeatedly resolve unchanged versions while action requests retain live binding reads", async () => {
  const state = await fixture(true)
  await act(() => state.acknowledge("native-lease:1"))
  state.bindingFor.mockClear()
  await act(() => {
    for (let turn = 0; turn < 100; turn++) state.notifyWithoutChange()
  })
  expect(state.bindingFor).not.toHaveBeenCalled()
  const action = jest.fn(),
    settled = jest.fn()
  await act(() => {
    expect(state.actions().request(state.model().collection.getItem("a"), 17, action, settled)).toBe(true)
  })
  expect(state.bindingFor).toHaveBeenCalled()
  state.bindingFor.mockClear()
  await act(() => state.receive(true))
  expect(state.bindingFor).toHaveBeenCalled()
  expect(action).toHaveBeenCalledTimes(1)
  expect(settled.mock.calls).toEqual([["accepted"]])
})

it("registers the first original receiver in its initial layout without a ref-only render and reconciles later originals", async () => {
  const originals = new Map<string, object>()
  const retired: object[] = []
  const registered = jest.fn((scope: TNativeCollectionActionScope, original: object) => {
    originals.set(scope.itemId, original)
    return () => {
      expect(originals.get(scope.itemId)).toBe(original)
      originals.delete(scope.itemId)
      retired.push(original)
    }
  })
  const admission: TNativeCollectionActionAdmission = {
    registerOwner: () => () => {},
    registerReceiver: registered,
    ownerLifetimeFor: () => "",
    bindingFor: () => "",
    request: () => () => {},
    subscribe: () => () => {},
    getSnapshot: () => 0,
  }
  const originalRef = createRef<View>()
  const replacementRef = createRef<View>()
  const renders = jest.fn()
  const Item = createNativeCollectionLeaf<object, { hostKey: string }, View>("item", (props, forwardedRef, node) => {
    renders()
    const bind = useNativeCollectionReceiverRef(node, forwardedRef)
    return <NativeFocusView key={props.hostKey} ref={bind} testID="direct-receiver" />
  })
  let hostKey = "first"
  let forwardedRef = originalRef
  let model: TNativeCollectionModelSnapshot<object> | undefined
  const item: TNativeCollectionItem<object> = {
    key: "a",
    type: "item",
    value: {},
    props: {},
    rendered: null,
    textValue: "Alpha",
    render: () => <Item hostKey={hostKey} ref={forwardedRef} />,
  }
  const items = [item]
  const tree = () => (
    <NativeCollectionActionAdmissionContext.Provider value={admission}>
      <NativeCollectionBuilder items={items}>
        {(collection, snapshot) => {
          model = snapshot
          return renderNativeCollectionNode(collection.getItem("a")!)
        }}
      </NativeCollectionBuilder>
    </NativeCollectionActionAdmissionContext.Provider>
  )
  const view = await render(tree())
  const first = originalRef.current!
  expect(first).not.toBeNull()
  expect(renders).toHaveBeenCalledTimes(1)
  expect(registered).toHaveBeenCalledTimes(1)
  expect([...originals.values()]).toEqual([first])
  const initialModel = model
  forwardedRef = replacementRef
  await view.rerender(tree())
  expect(originalRef.current).toBeNull()
  expect(replacementRef.current).toBe(first)
  expect(registered).toHaveBeenCalledTimes(1)
  expect(retired).toEqual([])
  hostKey = "replacement"
  await view.rerender(tree())
  const second = replacementRef.current!
  expect(second).not.toBe(first)
  expect(registered).toHaveBeenCalledTimes(2)
  expect([...originals.values()]).toEqual([second])
  expect(retired).toEqual([first])
  expect(model).toBe(initialModel)
  await view.unmount()
  expect(replacementRef.current).toBeNull()
  expect(originals.size).toBe(0)
  expect(retired).toEqual([first, second])
})

it("retires receiver registrations during StrictMode and Activity cleanup and restores only attached originals", async () => {
  const live = new Set<object>()
  const registerReceiver = jest.fn((_scope: TNativeCollectionActionScope, original: object) => {
    expect(live.has(original)).toBe(false)
    live.add(original)
    return () => {
      expect(live.delete(original)).toBe(true)
    }
  })
  const admission: TNativeCollectionActionAdmission = {
    registerOwner: () => () => {},
    registerReceiver,
    ownerLifetimeFor: () => "",
    bindingFor: () => "",
    request: () => () => {},
    subscribe: () => () => {},
    getSnapshot: () => 0,
  }
  const ref = createRef<View>()
  const Item = createNativeCollectionLeaf<object, object, View>("item", (_props, forwardedRef, node) => {
    const bind = useNativeCollectionReceiverRef(node, forwardedRef)
    return <NativeFocusView ref={bind} testID="restored-receiver" />
  })
  const items: readonly TNativeCollectionItem<object>[] = [
    {
      key: "a",
      type: "item",
      value: {},
      props: {},
      rendered: null,
      textValue: "Alpha",
      render: () => <Item ref={ref} />,
    },
  ]
  const tree = (mode: "visible" | "hidden") => (
    <StrictMode>
      <Activity mode={mode}>
        <NativeCollectionActionAdmissionContext.Provider value={admission}>
          <NativeCollectionBuilder items={items}>
            {(collection) => renderNativeCollectionNode(collection.getItem("a")!)}
          </NativeCollectionBuilder>
        </NativeCollectionActionAdmissionContext.Provider>
      </Activity>
    </StrictMode>
  )
  const view = await render(tree("visible"))
  expect(ref.current).not.toBeNull()
  expect([...live]).toEqual([ref.current])
  await view.rerender(tree("hidden"))
  expect(ref.current).toBeNull()
  expect(live.size).toBe(0)
  await view.rerender(tree("visible"))
  expect(ref.current).not.toBeNull()
  expect([...live]).toEqual([ref.current])
  expect(registerReceiver.mock.calls.length).toBeGreaterThan(1)
  await view.unmount()
  expect(ref.current).toBeNull()
  expect(live.size).toBe(0)
})

it("registers the first original owner in its initial layout without a ref-only render", async () => {
  const state = await fixture(true)
  const original = state.rootRef.current
  expect(original).not.toBeNull()
  expect(state.renderRoot).toHaveBeenCalledTimes(1)
  expect(state.registerOwner).toHaveBeenCalledTimes(1)
  expect(state.registerOwner.mock.calls[0][1]).toBe(original)
  expect(state.retireOwner).not.toHaveBeenCalled()
  await state.result.unmount()
  expect(state.rootRef.current).toBeNull()
  expect(state.retireOwner.mock.calls).toEqual([[original]])
})

it("reconciles owner originals, bindings and adapters and retires them through StrictMode and Activity cleanup", async () => {
  const live = new Map<object, { adapter: string; binding: string }>()
  const retired: object[] = []
  const adapter = (name: string): TNativeCollectionActionAdmission => ({
    registerOwner: (binding, original) => {
      expect(live.has(original)).toBe(false)
      const record = { adapter: name, binding }
      live.set(original, record)
      return () => {
        expect(live.get(original)).toBe(record)
        live.delete(original)
        retired.push(original)
      }
    },
    ownerLifetimeFor: () => "",
    bindingFor: () => "",
    request: () => () => {},
    subscribe: () => () => {},
    getSnapshot: () => 0,
  })
  let admission = adapter("initial")
  const firstRef = createRef<View>()
  const secondRef = createRef<View>()
  let forwardedRef = firstRef
  let hostKey = "first"
  let model: TNativeCollectionModelSnapshot<object> | undefined
  const Root = ({ snapshot }: { snapshot: TNativeCollectionModelSnapshot<object> }) => {
    const ref = useNativeCollectionOwnerRef(snapshot, forwardedRef)
    return <NativeFocusView key={hostKey} ref={ref} testID="owner-lifetime" />
  }
  const item: TNativeCollectionItem<object> = {
    key: "a",
    type: "item",
    value: {},
    props: {},
    rendered: null,
    textValue: "Alpha",
  }
  let items: readonly TNativeCollectionItem<object>[] = [item]
  const tree = (mode: "visible" | "hidden" = "visible") => (
    <StrictMode>
      <Activity mode={mode}>
        <NativeCollectionActionAdmissionContext.Provider value={admission}>
          <NativeCollectionBuilder items={items}>
            {(_collection, snapshot) => {
              model = snapshot
              return <Root snapshot={snapshot} />
            }}
          </NativeCollectionBuilder>
        </NativeCollectionActionAdmissionContext.Provider>
      </Activity>
    </StrictMode>
  )
  const view = await render(tree())
  const first = firstRef.current!
  expect(first).not.toBeNull()
  expect([...live]).toEqual([[first, { adapter: "initial", binding: nativeCollectionOwnerBinding(model!) }]])
  const retirements = retired.length
  forwardedRef = secondRef
  await view.rerender(tree())
  expect(firstRef.current).toBeNull()
  expect(secondRef.current).toBe(first)
  expect(retired).toHaveLength(retirements)
  hostKey = "second"
  await view.rerender(tree())
  const second = secondRef.current!
  expect(second).not.toBe(first)
  expect([...live.keys()]).toEqual([second])
  expect(retired).toHaveLength(retirements + 1)
  expect(retired.at(-1)).toBe(first)
  const previousModel = model
  items = [{ ...item, textValue: "Changed model" }]
  await view.rerender(tree())
  expect(model).not.toBe(previousModel)
  expect(secondRef.current).toBe(second)
  expect([...live]).toEqual([[second, { adapter: "initial", binding: nativeCollectionOwnerBinding(model!) }]])
  expect(retired).toHaveLength(retirements + 2)
  admission = adapter("replacement")
  await view.rerender(tree())
  expect(secondRef.current).toBe(second)
  expect([...live]).toEqual([[second, { adapter: "replacement", binding: nativeCollectionOwnerBinding(model!) }]])
  expect(retired).toHaveLength(retirements + 3)
  await view.rerender(tree("hidden"))
  expect(secondRef.current).toBeNull()
  expect(live.size).toBe(0)
  await view.rerender(tree())
  expect(secondRef.current).not.toBeNull()
  expect([...live]).toEqual([
    [secondRef.current, { adapter: "replacement", binding: nativeCollectionOwnerBinding(model!) }],
  ])
  await view.unmount()
  expect(secondRef.current).toBeNull()
  expect(live.size).toBe(0)
})
