import { act, render, screen } from "@testing-library/react-native"
import {
  Activity,
  Fragment,
  StrictMode,
  Suspense,
  createContext,
  createRef,
  startTransition,
  useContext,
  useLayoutEffect,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react"
import { StyleSheet, Text, View, type NativeSyntheticEvent } from "react-native"
import type { TestInstance } from "test-renderer"

import type { NativeCollectionCommitData } from "../../input/specs/CUICollectionRootNativeComponent"
import {
  NativeCollection,
  NativeCollectionBuilder,
  createNativeCollectionBranch,
  createNativeCollectionLeaf,
} from "../CollectionBuilder"
import type { NativeCollectionMetadataRoot } from "../NativeCollectionMetadata"
import type { TNativeCollectionSessionSnapshot } from "../session"
import type { TNativeCollectionKey, TNativeCollectionSnapshot } from "../snapshot"

jest.mock("../../input/specs/CUICollectionRootNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
}))
jest.mock("../../input/specs/CUICollectionNodeNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
}))
const ReactNative = jest.requireActual<typeof import("react-native")>("react-native")
beforeEach(() => jest.spyOn(ReactNative, "findNodeHandle").mockReturnValue(7001))
afterEach(() => jest.restoreAllMocks())
type TValue = { title: string }
type TItemProps = {
  id?: TNativeCollectionKey
  value?: TValue
  textValue?: string
  children?: ReactNode
  onAction?: () => void
}
type TReceipt = TNativeCollectionSessionSnapshot<unknown>["receipt"]
const itemMount = jest.fn(),
  itemRetire = jest.fn()
const setters = new Map<TNativeCollectionKey, (next: number) => void>()
const Item = createNativeCollectionLeaf<TValue, TItemProps, View>("item", (props, ref, node) => {
  const [count, setCount] = useState(0)
  useLayoutEffect(() => {
    setters.set(node.key, setCount)
    itemMount(node.key)
    return () => {
      setters.delete(node.key)
      itemRetire(node.key)
    }
  }, [node.key])
  return (
    <View ref={ref} testID={`row:${node.key}`}>
      <Text>
        {props.children}:{count}
      </Text>
    </View>
  )
})
const Branch = createNativeCollectionBranch<TValue, { id: string; children?: ReactNode }, View>(
  "section",
  (_props, ref, node) => <View ref={ref} testID={`section:${node.key}`} />,
)
const current: { collection: TNativeCollectionSnapshot<TValue> | null; receipt: TReceipt | null } = {
  collection: null,
  receipt: null,
}
const observe = jest.fn()
const Receiver = ({
  collection,
  receipt,
  limit,
}: {
  collection: TNativeCollectionSnapshot<TValue>
  receipt: TReceipt
  limit?: number
}) => {
  useLayoutEffect(() => {
    current.collection = collection
    current.receipt = receipt
    observe(collection, receipt)
  }, [collection, receipt])
  return (
    <>
      {[...collection].slice(0, limit).map((node) => (
        <Fragment key={node.key}>{node.render?.(node)}</Fragment>
      ))}
    </>
  )
}
const tree = (
  content: ReactNode,
  limit?: number,
  event?: ComponentProps<typeof NativeCollectionMetadataRoot>["onNativeCollectionCommit"],
) => (
  <NativeCollectionBuilder<TValue> content={content} onNativeCollectionCommit={event}>
    {(collection, receipt) => <Receiver collection={collection} receipt={receipt} limit={limit} />}
  </NativeCollectionBuilder>
)
type TView = Awaited<ReturnType<typeof render>>
const rootHost = (view: TView) => {
  const roots = view.container.queryAll((host) => typeof host.props.rootRevision === "string")
  expect(roots).toHaveLength(1)
  return roots[0]
}
const nodeHosts = (view: TView) =>
  view.container
    .queryAll((host) => typeof host.props.descriptorId === "string")
    .filter((host) => {
      let current: TestInstance | null = host
      while (current) {
        if (StyleSheet.flatten(current.props.style)?.display === "none") return false
        current = current.parent
      }
      return true
    })
let sequence = 0
beforeEach(() => {
  sequence = 0
  current.collection = null
  current.receipt = null
  itemMount.mockClear()
  itemRetire.mockClear()
  observe.mockClear()
  setters.clear()
})

// Synthetic receipts check source lifecycles. Only the SDK fixture may establish actual native hierarchy/order.
const receiptFor = (view: TView): NativeCollectionCommitData => {
  const root = rootHost(view),
    nodes = nodeHosts(view),
    positions = new Map<string, number>()
  const parentId = (host: TestInstance): string => {
    let parent = host.parent
    while (parent && parent !== root) {
      if (typeof parent.props.descriptorId === "string") return parent.props.descriptorId
      parent = parent.parent
    }
    return ""
  }
  const hierarchy = nodes.map((host, position) => {
    expect(host.props).not.toHaveProperty("rootRevision")
    const parentDescriptorId = parentId(host),
      index = positions.get(parentDescriptorId) ?? 0
    positions.set(parentDescriptorId, index + 1)
    return {
      descriptorId: host.props.descriptorId,
      descriptorRevision: host.props.descriptorRevision,
      parentDescriptorId,
      target: 8000 + position,
      index,
      retainedIndex: index,
      hasRetainedChildren: nodes.some((child) => parentId(child) === host.props.descriptorId),
    }
  })
  expect(hierarchy.some((entry) => entry.descriptorRevision === "uncommitted")).toBe(false)
  return {
    ownerId: root.props.ownerId,
    rootId: root.props.rootId,
    rootRevision: root.props.rootRevision,
    target: 7001,
    surfaceId: 11,
    windowId: "source-model-window",
    epoch: 1,
    sequence: ++sequence,
    mountRevision: "source-model",
    complete: true,
    attached: true,
    metadataOnly: true,
    error: "",
    hierarchy: JSON.stringify(hierarchy),
  }
}
const emit = async (view: TView, packet = receiptFor(view)) => {
  const event = {
    nativeEvent: packet,
    persist: jest.fn(),
  } as unknown as NativeSyntheticEvent<NativeCollectionCommitData>
  await act(() => rootHost(view).props.onNativeCollectionCommit(event))
  return event
}
const keys = () => [...current.collection!].map((node) => node.key)

it("renders authoring once and binds caller refs only to the visible receiver after a complete matching receipt", async () => {
  const mounted = jest.fn(),
    retired = jest.fn(),
    original = jest.fn(),
    ref = createRef<View>(),
    value = { title: "Original" }
  const Opaque = () => {
    useLayoutEffect(() => {
      mounted()
      return retired
    }, [])
    return (
      <Item id={0} value={value} ref={ref} textValue="Original">
        Original
      </Item>
    )
  }
  const view = await render(tree(<Opaque />, undefined, original))
  expect(ref.current).toBeNull()
  expect(current.receipt?.status).toBe("pending")
  const event = await emit(view)
  expect(original).toHaveBeenCalledWith(event)
  expect(event.persist).toHaveBeenCalled()
  expect(current.receipt?.status).toBe("confirmed")
  expect(keys()).toEqual([0])
  expect(current.collection?.getItem(0)?.value).toBe(value)
  expect(current.collection?.getItem(0)?.props.ref).toBe(ref)
  expect(current.collection?.getItem(0)?.rendered).toBe("Original")
  expect(ref.current).not.toBeNull()
  expect(mounted).toHaveBeenCalledTimes(1)
  expect(retired).not.toHaveBeenCalled()
  expect(itemMount).toHaveBeenCalledTimes(1)
  const node = current.collection!.getItem(0)!
  expect(Object.keys(node).some((key) => ["descriptorId", "descriptorRevision", "metadataTarget"].includes(key))).toBe(
    false,
  )
  await view.unmount()
  expect(ref.current).toBeNull()
  expect(retired).toHaveBeenCalledTimes(1)
})

it("keeps visible row state/ref lifetimes while an opaque local reorder awaits native confirmation", async () => {
  let update!: (order: string[]) => void
  const ref = createRef<View>(),
    mounted = jest.fn()
  const Opaque = () => {
    const [order, setOrder] = useState(["a", "b", "c"])
    update = setOrder
    useLayoutEffect(() => {
      mounted()
    }, [])
    return (
      <>
        {order.map((id) => (
          <Item key={id} id={id} ref={id === "a" ? ref : undefined}>
            {id}
          </Item>
        ))}
      </>
    )
  }
  const view = await render(tree(<Opaque />)),
    old = receiptFor(view)
  await emit(view, old)
  const visible = ref.current
  await act(() => setters.get("a")!(7))
  await act(() => update(["c", "a", "b"]))
  expect(keys()).toEqual(["a", "b", "c"])
  expect(ref.current).toBe(visible)
  await emit(view, { ...old, sequence: ++sequence })
  expect(current.receipt?.status).toBe("pending")
  await emit(view)
  expect(keys()).toEqual(["c", "a", "b"])
  expect([...current.collection!.getKeys()]).toEqual(["a", "b", "c"])
  expect(screen.getByText("a:7")).toBeTruthy()
  expect(ref.current).toBe(visible)
  expect(mounted).toHaveBeenCalledTimes(1)
  expect(itemMount).toHaveBeenCalledTimes(3)
  expect(itemRetire).not.toHaveBeenCalled()
})

it("retains full logical membership when a renderer materializes no rows", async () => {
  const view = await render(
    tree(
      <>
        <Item id="a">a</Item>
        <Item id="b">b</Item>
        <Item id="c">c</Item>
      </>,
      0,
    ),
  )
  await emit(view)
  expect(keys()).toEqual(["a", "b", "c"])
  expect(current.collection?.size).toBe(3)
  expect(itemMount).not.toHaveBeenCalled()
  expect(screen.queryAllByTestId(/^row:/)).toHaveLength(0)
})

it("propagates ancestor context and keeps a generated ID across keyed reorder", async () => {
  const Context = createContext(false),
    generated = <Item key="generated">generated</Item>,
    explicit = (
      <Item key="b" id="b">
        b
      </Item>
    )
  const Opaque = () => <>{useContext(Context) ? [explicit, generated] : [generated, explicit]}</>
  const view = await render(<Context.Provider value={false}>{tree(<Opaque />)}</Context.Provider>)
  await emit(view)
  const generatedKey = keys()[0]
  expect(generatedKey).toBe("react-aria-1")
  await view.rerender(<Context.Provider value={true}>{tree(<Opaque />)}</Context.Provider>)
  await emit(view)
  expect(keys()).toEqual(["b", generatedKey])
})

it("handles hidden membership/effect restoration without changing generated identity", async () => {
  const content = (hidden: boolean) => (
    <>
      <Activity mode={hidden ? "hidden" : "visible"}>
        <Item key="generated">generated</Item>
      </Activity>
      <Item id="b">b</Item>
    </>
  )
  const view = await render(tree(content(false)))
  await emit(view)
  const generatedKey = keys()[0]
  await view.rerender(tree(content(true)))
  await emit(view)
  expect(keys()).toEqual(["b"])
  await view.rerender(tree(content(false)))
  await emit(view)
  expect(keys()).toEqual([generatedKey, "b"])
})

it("preserves restored whole-Activity lookup history and visible hook state like the pinned source", async () => {
  let reorder!: (next: string[]) => void
  const ref = createRef<View>()
  const Content = () => {
    const [order, setOrder] = useState(["a", "b", "c"])
    reorder = setOrder
    return (
      <>
        {order.map((id) => (
          <Item key={id} id={id} ref={id === "a" ? ref : undefined}>
            {id}
          </Item>
        ))}
      </>
    )
  }
  const fixture = (hidden: boolean) => <Activity mode={hidden ? "hidden" : "visible"}>{tree(<Content />)}</Activity>
  const view = await render(fixture(false))
  await emit(view)
  await act(() => reorder(["b", "c", "a"]))
  await emit(view)
  expect([...current.collection!.getKeys()]).toEqual(["a", "b", "c"])
  await act(() => setters.get("a")!(9))
  await view.rerender(fixture(true))
  expect(ref.current).toBeNull()
  await view.rerender(fixture(false))
  await emit(view)
  expect(keys()).toEqual(["b", "c", "a"])
  expect([...current.collection!.getKeys()]).toEqual(["a", "b", "c"])
  expect(screen.getByText("a:9")).toBeTruthy()
  expect(ref.current).not.toBeNull()
})

it("runs branch child hooks through React and preserves complete section membership", async () => {
  const nested = jest.fn()
  const content = (
    <Branch id="section">
      <NativeCollection items={[{ title: "a" }, { title: "b" }]}>
        {(item) => {
          nested(item)
          return <Item id={item.title}>{item.title}</Item>
        }}
      </NativeCollection>
    </Branch>
  )
  const view = await render(tree(content, 0))
  await emit(view)
  expect(keys()).toEqual(["section"])
  expect([...current.collection!.getChildren("section")].map((node) => node.key)).toEqual(["a", "b"])
  expect([...current.collection!.getKeys()]).toEqual(["a", "b", "section"])
  expect(nested).toHaveBeenCalledTimes(2)
  expect(current.collection?.size).toBe(2)
})

it("survives StrictMode effect replay without duplicate membership or ref ownership", async () => {
  const ref = createRef<View>(),
    view = await render(<StrictMode>{tree(<Item ref={ref}>generated</Item>)}</StrictMode>)
  await emit(view)
  expect(keys()).toEqual(["react-aria-1"])
  expect(current.collection?.size).toBe(1)
  expect(ref.current).not.toBeNull()
})

it("does not allocate committed generated IDs or publish a discarded suspended transition", async () => {
  const pending = new Promise<void>(() => {})
  const onAction = jest.fn()
  let setMode!: (mode: "initial" | "aborted" | "committed") => void
  const Suspend = () => {
    throw pending
  }
  const Owner = () => {
    const [mode, update] = useState<"initial" | "aborted" | "committed">("initial")
    setMode = update
    return (
      <Suspense fallback={null}>
        {mode === "initial" ? (
          <Item key="initial" onAction={onAction}>
            initial
          </Item>
        ) : (
          <Item key={mode} onAction={onAction}>
            {mode}
          </Item>
        )}
        {mode === "aborted" && <Suspend />}
      </Suspense>
    )
  }
  const view = await render(tree(<Owner />))
  await emit(view)
  const before = current.collection,
    observations = observe.mock.calls.length
  await act(() => startTransition(() => setMode("aborted")))
  expect(current.collection).toBe(before)
  expect(observe.mock.calls.length).toBe(observations)
  await act(() => setMode("committed"))
  await emit(view)
  expect(keys()).toEqual(["react-aria-2"])
  expect(current.collection?.getItem("react-aria-2")?.rendered).toBe("committed")
  expect(current.collection?.getItem("react-aria-2")?.props.onAction).toBe(onAction)
  expect(onAction).not.toHaveBeenCalled()
})
