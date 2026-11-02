import { act, render, screen } from "@testing-library/react-native"
import { createRef, useContext } from "react"
import * as RN from "react-native"
import type { View } from "react-native"

import {
  NativeCollectionActionsContext,
  NativeCollectionActionAdmissionContext,
  type TNativeCollectionActionAdmission,
} from "../../../collection/actions"
import {
  NativeCollectionRendererContext,
  DefaultNativeCollectionRenderer,
  renderNativeCollectionNode,
  type TNativeCollectionRootProps,
} from "../../../collection/renderer"
import type { TNativeCollectionItem, TNativeCollectionSnapshot } from "../../../collection/snapshot"
import { NativeFocusView } from "../../../input/NativeFocusView"
import { NativeThemeProvider } from "../../../theme"
import { Tag } from "../Tag"
import { TagGroup } from "../TagGroup"
import type { TNativeTagGroupProps } from "../types"

const item = (key: string | number, label: string): TNativeCollectionItem<object> => ({
  key,
  type: "item",
  value: { key },
  props: {},
  rendered: label,
  textValue: label,
  render: () => <Tag testID={`tag:${typeof key}:${key}`}>{label}</Tag>,
})
const fixture = (props: TNativeTagGroupProps) => (
  <NativeThemeProvider>
    <TagGroup {...props} />
  </NativeThemeProvider>
)
const row = (key: string | number) => screen.getByTestId(`tag:${typeof key}:${key}`)

it("renders explicit numeric and string keys, controlled selection and disabled state", async () => {
  const items = [item(0, "Number"), item("0", "String")]
  const view = await render(fixture({ items, selectionMode: "multiple", selectedKeys: [0], disabledKeys: ["0"] }))
  expect(row(0).props.accessibilityState).toMatchObject({ selected: true, disabled: false })
  expect(row("0").props.accessibilityState).toMatchObject({ selected: false, disabled: true })
  await view.rerender(fixture({ items: [items[1], items[0]], selectionMode: "multiple", selectedKeys: ["0"] }))
  expect(screen.getAllByRole("row").map((node) => node.props.testID)).toEqual(["tag:string:0", "tag:number:0"])
  expect(row("0").props.accessibilityState.selected).toBe(true)
  expect(
    view.container.queryAll((host) => host.props.descriptorId !== undefined || host.props.rootRevision !== undefined),
  ).toHaveLength(0)
})

it("preserves a custom original receiver ref and its render state through explicit reorder", async () => {
  const ref = createRef<View>(),
    states: boolean[] = []
  const a: TNativeCollectionItem<object> = {
    ...item("a", "Alpha"),
    render: () => (
      <Tag
        ref={ref}
        render={(props, state) => {
          states.push(state.isSelected)
          return <NativeFocusView {...props} testID="custom" />
        }}
      >
        Alpha
      </Tag>
    ),
  }
  const b = item("b", "Beta")
  const view = await render(fixture({ items: [a, b], selectionMode: "multiple", selectedKeys: [] }))
  const original = ref.current
  expect(original).not.toBeNull()
  await view.rerender(fixture({ items: [b, a], selectionMode: "multiple", selectedKeys: ["a"] }))
  expect(ref.current).toBe(original)
  expect(states.at(-1)).toBe(true)
  await view.unmount()
  expect(ref.current).toBeNull()
})

it("keeps complete virtualized membership while rendering only requested explicit receivers", async () => {
  const a = item("a", "Alpha"),
    b = item("b", "Beta")
  const renderA = jest.fn(a.render!),
    renderB = jest.fn(b.render!)
  let logical: TNativeCollectionSnapshot<unknown> | undefined
  const VirtualRoot = ({ collection, persistedKeys, scrollRef }: TNativeCollectionRootProps) => {
    logical = collection
    expect(scrollRef).toBeDefined()
    expect(persistedKeys).toBeNull()
    return renderNativeCollectionNode(collection.getItem("b")!)
  }
  await render(
    <NativeThemeProvider>
      <NativeCollectionRendererContext.Provider
        value={{ ...DefaultNativeCollectionRenderer, isVirtualized: true, CollectionRoot: VirtualRoot }}
      >
        <TagGroup
          items={[
            { ...a, render: renderA },
            { ...b, render: renderB },
          ]}
        />
      </NativeCollectionRendererContext.Provider>
    </NativeThemeProvider>,
  )
  expect(logical!.size).toBe(2)
  expect([...logical!.getKeys()]).toEqual(["a", "b"])
  expect(renderA).not.toHaveBeenCalled()
  expect(renderB).toHaveBeenCalled()
  expect(screen.queryByText("Alpha")).toBeNull()
  expect(screen.getByText("Beta")).toBeTruthy()
})

it("rejects collection actions without native admission even when the explicit item is mounted", async () => {
  const action = jest.fn(),
    settled = jest.fn()
  let request: (() => boolean) | undefined
  const Root = (props: TNativeCollectionRootProps) => {
    const actions = useContext(NativeCollectionActionsContext)!
    request = () => actions.request(props.collection.getItem("a"), 17, action, settled)
    return <DefaultNativeCollectionRenderer.CollectionRoot {...props} />
  }
  await render(
    <NativeThemeProvider>
      <NativeCollectionRendererContext.Provider value={{ ...DefaultNativeCollectionRenderer, CollectionRoot: Root }}>
        <TagGroup items={[item("a", "Alpha")]} onAction={action} />
      </NativeCollectionRendererContext.Provider>
    </NativeThemeProvider>,
  )
  await act(() => expect(request!()).toBe(false))
  expect(settled).toHaveBeenCalledWith("rejected")
  expect(action).not.toHaveBeenCalled()
})

// Controlled source protocol only: tests choose replies explicitly; this does not qualify native admission.
it.each(["accept", "reject", "replace"])(
  "retains delayed original-row selection guards for a %s reply",
  async (outcome) => {
    const ref = createRef<View>(),
      select = jest.fn(),
      caller = jest.fn()
    const listeners = new Set<() => void>()
    const roots = new Map<string, object>()
    let version = 0,
      reply: ((accepted: boolean) => void) | undefined
    const notify = () => {
      version++
      for (const listener of listeners) listener()
    }
    const requests = jest.fn((_scope, _binding, _target, receive: (accepted: boolean) => void) => {
      reply = receive
      return () => {}
    })
    const admission: TNativeCollectionActionAdmission = {
      registerOwner: (binding, original) => {
        roots.set(binding, original)
        notify()
        return () => {
          roots.delete(binding)
          notify()
        }
      },
      ownerLifetimeFor: () => (roots.size ? "controlled-source-lifetime" : ""),
      bindingFor: (scope) => JSON.stringify(scope),
      request: requests,
      subscribe: (listener) => {
        listeners.add(listener)
        return () => {
          listeners.delete(listener)
        }
      },
      getSnapshot: () => version,
    }
    const entry: TNativeCollectionItem<object> = {
      ...item("a", "Alpha"),
      render: () => (
        <Tag ref={ref} testID="original" onPress={caller}>
          Alpha
        </Tag>
      ),
    }
    const fixtureWithAdmission = (items: readonly TNativeCollectionItem<object>[]) => (
      <NativeCollectionActionAdmissionContext.Provider value={admission}>
        {fixture({ items, selectionMode: "multiple", shouldSelectOnPressUp: true, onSelectionChange: select })}
      </NativeCollectionActionAdmissionContext.Provider>
    )
    const view = await render(fixtureWithAdmission([entry]))
    const original = ref.current!
    const event = {
      target: RN.findNodeHandle(original),
      currentTarget: RN.findNodeHandle(original),
      persist: jest.fn(),
      preventDefault: jest.fn(),
      isDefaultPrevented: () => false,
      nativeEvent: {
        target: RN.findNodeHandle(original),
        timestamp: 100,
        identifier: 0,
        pageX: 0,
        pageY: 0,
        locationX: 0,
        locationY: 0,
      },
    }
    await act(() => screen.getByTestId("original").props.onResponderGrant(event))
    await act(() => screen.getByTestId("original").props.onResponderRelease(event))
    expect(requests).toHaveBeenCalled()
    expect(requests.mock.calls.at(-1)![2]).toBe(RN.findNodeHandle(original))
    expect(select).not.toHaveBeenCalled()
    if (outcome === "replace") await view.rerender(fixtureWithAdmission([{ ...entry, textValue: "Revised" }]))
    await act(() => reply!(outcome !== "reject"))
    expect(select).toHaveBeenCalledTimes(outcome === "accept" ? 1 : 0)
    if (outcome === "accept") {
      expect([...select.mock.calls[0][0]]).toEqual(["a"])
      expect(caller.mock.calls[0][0]).toBe(event)
    }
    await view.unmount()
  },
)
