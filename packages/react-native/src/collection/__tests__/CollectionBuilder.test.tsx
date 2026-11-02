import { act, render, screen } from "@testing-library/react-native"
import {
  Activity,
  StrictMode,
  Suspense,
  createContext,
  createRef,
  startTransition,
  useContext,
  useLayoutEffect,
  useState,
} from "react"
import { Text, View } from "react-native"

import {
  NativeCollectionActionAdmissionContext,
  NativeCollectionActionsContext,
  type NativeCollectionActions,
  type TNativeCollectionActionAdmission,
} from "../actions"
import { NativeCollectionBuilder, createNativeCollectionLeaf, useNativeCollectionOwnerRef } from "../CollectionBuilder"
import type { TNativeCollectionModelSnapshot } from "../model"
import { renderNativeCollectionNode } from "../renderer"
import type { TNativeCollectionItem } from "../snapshot"

const inherited = createContext("missing")
const mounts = jest.fn(),
  retires = jest.fn()
const setters = new Map<string | number, (next: number) => void>()
const Item = createNativeCollectionLeaf<object, { title: string }, View>("item", (props, ref, node) => {
  const [count, setCount] = useState(0)
  const context = useContext(inherited)
  useLayoutEffect(() => {
    mounts(node.key)
    setters.set(node.key, setCount)
    return () => {
      retires(node.key)
      setters.delete(node.key)
    }
  }, [node.key])
  return (
    <View ref={ref} testID={`row:${node.key}`}>
      <Text>{`${props.title}:${count}:${context}`}</Text>
    </View>
  )
})
const item = (key: string): TNativeCollectionItem<object> => ({
  key,
  type: "item",
  value: {},
  props: {},
  rendered: key,
  textValue: key,
  render: () => <Item title={key} />,
})
let current: TNativeCollectionModelSnapshot<object>
const tree = (items: readonly TNativeCollectionItem<object>[], limit = Infinity) => (
  <inherited.Provider value="context">
    <NativeCollectionBuilder items={items}>
      {(collection, model) => {
        current = model
        return (
          <>
            {[...collection].slice(0, limit).map((node) => (
              <View key={node.key}>{renderNativeCollectionNode(node)}</View>
            ))}
          </>
        )
      }}
    </NativeCollectionBuilder>
  </inherited.Provider>
)
beforeEach(() => {
  mounts.mockClear()
  retires.mockClear()
  setters.clear()
})

it("renders only explicit visible receivers and never creates hidden metadata hosts", async () => {
  const ref = createRef<View>(),
    renderItem = jest.fn(() => <Item title="a" ref={ref} />)
  const view = await render(tree([{ ...item("a"), render: renderItem }]))
  expect(screen.getByText("a:0:context")).toBeTruthy()
  expect(renderItem).toHaveBeenCalledTimes(1)
  expect(
    view.container.queryAll((host) => host.props.descriptorId !== undefined || host.props.rootRevision !== undefined),
  ).toHaveLength(0)
  expect([...current.collection.getKeys()]).toEqual(["a"])
})

it("preserves visible hook state and typed logical identities across explicit reorder", async () => {
  const a = item("a"),
    b = item("b")
  const view = await render(tree([a, b]))
  await act(() => setters.get("a")!(5))
  await view.rerender(tree([b, a]))
  expect(screen.getByText("a:5:context")).toBeTruthy()
  expect([...current.collection].map((node) => node.key)).toEqual(["b", "a"])
  expect([...current.collection.getKeys()]).toEqual(["a", "b"])
  expect(retires).not.toHaveBeenCalled()
})

it("keeps complete membership with no materialized rows and mounts requested rows without authoring evaluation", async () => {
  const a = item("a"),
    b = item("b"),
    renderA = jest.fn(a.render!),
    renderB = jest.fn(b.render!)
  const items = [
    { ...a, render: renderA },
    { ...b, render: renderB },
  ]
  const view = await render(tree(items, 0))
  expect(current.collection.size).toBe(2)
  expect(renderA).not.toHaveBeenCalled()
  expect(renderB).not.toHaveBeenCalled()
  await view.rerender(tree(items, 1))
  expect(screen.getByText("a:0:context")).toBeTruthy()
  expect(renderA).toHaveBeenCalledTimes(1)
  expect(renderB).not.toHaveBeenCalled()
})

it("keeps full explicit section membership independently of rendered descendants", async () => {
  const section = {
    ...item("section"),
    type: "section",
    render: () => <Text>Section</Text>,
    children: [item("a"), item("b")],
  }
  await render(tree([section]))
  expect(screen.getByText("Section")).toBeTruthy()
  expect([...current.collection.getChildren("section")].map((node) => node.key)).toEqual(["a", "b"])
  expect(current.collection.size).toBe(2)
  expect(mounts).not.toHaveBeenCalled()
})

it("survives StrictMode and Activity restoration without discovering or changing keys", async () => {
  const items = [item("a")]
  const view = await render(
    <StrictMode>
      <Activity mode="visible">{tree(items)}</Activity>
    </StrictMode>,
  )
  await act(() => setters.get("a")!(7))
  await view.rerender(
    <StrictMode>
      <Activity mode="hidden">{tree(items)}</Activity>
    </StrictMode>,
  )
  await view.rerender(
    <StrictMode>
      <Activity mode="visible">{tree(items)}</Activity>
    </StrictMode>,
  )
  expect(screen.getByText("a:7:context")).toBeTruthy()
  expect([...current.collection.getKeys()]).toEqual(["a"])
})

it("does not commit a suspended candidate or replace the current action owner", async () => {
  const pending = new Promise<void>(() => {})
  let setItems!: (items: readonly TNativeCollectionItem<object>[]) => void
  let committedActions: NativeCollectionActions | null
  const Observe = ({ suspend }: { suspend: boolean }) => {
    const actions = useContext(NativeCollectionActionsContext)
    useLayoutEffect(() => {
      committedActions = actions
    })
    if (suspend) throw pending
    return <Text>ready</Text>
  }
  const App = () => {
    const [items, set] = useState([item("a")] as readonly TNativeCollectionItem<object>[])
    setItems = set
    return (
      <Suspense fallback={<Text>waiting</Text>}>
        <NativeCollectionBuilder items={items}>
          {() => <Observe suspend={items[0].key === "pending"} />}
        </NativeCollectionBuilder>
      </Suspense>
    )
  }
  await render(<App />)
  const before = committedActions!.model.getSnapshot()
  await act(() => startTransition(() => setItems([item("pending")])))
  expect(committedActions!.model.getSnapshot()).toBe(before)
  expect(screen.getByText("ready")).toBeTruthy()
})

it("commits logical ownership before descendant layout actions without insertion-effect callbacks", async () => {
  const action = jest.fn()
  const admission: TNativeCollectionActionAdmission = {
    registerOwner: () => () => {},
    ownerLifetimeFor: () => "source-model-window",
    bindingFor: (scope) => JSON.stringify(scope),
    request: (_scope, _binding, _target, receive) => {
      receive(true)
      return () => {}
    },
    subscribe: () => () => {},
    getSnapshot: () => 0,
  }
  const Receiver = () => {
    const actions = useContext(NativeCollectionActionsContext)!
    useLayoutEffect(() => {
      actions.request(null, 42, action)
    }, [actions])
    return null
  }
  await render(
    <NativeCollectionActionAdmissionContext.Provider value={admission}>
      <NativeCollectionBuilder items={[]}>{() => <Receiver />}</NativeCollectionBuilder>
    </NativeCollectionActionAdmissionContext.Provider>,
  )
  expect(action).toHaveBeenCalledTimes(1)
})

it("registers and retires only the original visible root across model and ref replacement", async () => {
  const roots = new Map<string, object>(),
    retired: object[] = []
  const admission: TNativeCollectionActionAdmission = {
    registerOwner: (binding, original) => {
      roots.set(binding, original)
      return () => {
        roots.delete(binding)
        retired.push(original)
      }
    },
    ownerLifetimeFor: () => "",
    bindingFor: () => "",
    request: () => {
      throw new Error("Source ownership is not native admission")
    },
    subscribe: () => () => {},
    getSnapshot: () => 0,
  }
  const ref = createRef<View>()
  const Root = ({ snapshot, alternate }: { snapshot: TNativeCollectionModelSnapshot<object>; alternate: boolean }) => {
    const ownerRef = useNativeCollectionOwnerRef(snapshot, ref)
    return <View ref={ownerRef} key={alternate ? "replacement" : "original"} />
  }
  const fixture = (items: readonly TNativeCollectionItem<object>[], alternate = false) => (
    <NativeCollectionActionAdmissionContext.Provider value={admission}>
      <NativeCollectionBuilder items={items}>
        {(_collection, snapshot) => <Root snapshot={snapshot} alternate={alternate} />}
      </NativeCollectionBuilder>
    </NativeCollectionActionAdmissionContext.Provider>
  )
  const a = item("a"),
    b = item("b")
  const view = await render(fixture([a]))
  const original = ref.current!
  expect([...roots.values()]).toEqual([original])
  const firstBinding = [...roots.keys()][0]
  await view.rerender(fixture([a, b]))
  expect(ref.current).toBe(original)
  expect([...roots.values()]).toEqual([original])
  expect(roots.has(firstBinding)).toBe(false)
  expect(JSON.parse([...roots.keys()][0]).items).toHaveLength(2)
  await view.rerender(fixture([a, b], true))
  expect(ref.current).not.toBe(original)
  expect([...roots.values()]).toEqual([ref.current])
  expect(retired).toContain(original)
  await view.unmount()
  expect(roots.size).toBe(0)
  expect(ref.current).toBeNull()
})
