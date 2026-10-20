import { createRef, useContext } from "react"
import * as RN from "react-native"

import { NativeThemeProvider } from "../../.."
import {
  actWithNativeCollections as act,
  renderWithNativeCollections as render,
  screen,
} from "../../../collection/__tests__/nativeReceipts"
import { NativeCollectionBuilder, createNativeCollectionBranch } from "../../../collection/CollectionBuilder"
import {
  NATIVE_DEFAULT_SLOT,
  NativeSelectableCollectionContext,
  NativeSelectionIndicatorContext,
} from "../../../collection/context"
import {
  DefaultNativeCollectionRenderer,
  NativeCollectionRendererContext,
  type TNativeCollectionRootProps,
} from "../../../collection/renderer"
import type { TNativeCollectionSnapshot } from "../../../collection/snapshot"
import { NativeListStateContext, useListState, type TNativeListState } from "../../../collection/state"
import { NativeFocusView } from "../../../input/NativeFocusView"
import { NativeTagGroupContext, NativeTagListContext } from "../context"
import { Tag } from "../Tag"
import { TagGroup, NativeTagList } from "../TagGroup"
import type { TNativeTagGroupEmptyState } from "../types"

beforeEach(() => jest.spyOn(RN.AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true))
afterEach(() => jest.restoreAllMocks())
const hidden = { includeHiddenElements: true }

it("uses TagList's authoring phase for original dynamic values without mounting a second visible list", async () => {
  const values = [
    { id: 0, label: "Zero" },
    { id: "0", label: "String zero" },
  ]
  let state!: TNativeListState<object>
  const Root = (props: TNativeCollectionRootProps) => {
    state = useContext(NativeListStateContext)!
    return <DefaultNativeCollectionRenderer.CollectionRoot {...props} />
  }
  await render(
    <NativeThemeProvider>
      <NativeCollectionRendererContext.Provider value={{ ...DefaultNativeCollectionRenderer, CollectionRoot: Root }}>
        <TagGroup>
          <NativeTagList
            items={(function* () {
              yield* values
            })()}
          >
            {(value) => (
              <Tag id={value.id} testID={typeof value.id === "number" ? "number" : "string"}>
                {value.label}
              </Tag>
            )}
          </NativeTagList>
        </TagGroup>
      </NativeCollectionRendererContext.Provider>
    </NativeThemeProvider>,
  )
  expect(state.collection.getItem(0)?.value).toBe(values[0])
  expect(state.collection.getItem("0")?.value).toBe(values[1])
  expect(screen.getAllByTestId("tag-list", hidden)).toHaveLength(1)
  expect(screen.getByTestId("number", hidden)).toBeDefined()
  expect(screen.getByTestId("string", hidden)).toBeDefined()
})

it("retains original list ref/events and observes empty render focus independently from logical state", async () => {
  const target = createRef<RN.View>(),
    focus = jest.fn(),
    empty = jest.fn((_state: TNativeTagGroupEmptyState) => "No tags")
  let logicalFocus!: () => void
  let state!: TNativeListState<object>
  const Receiver = ({ collection }: { collection: TNativeCollectionSnapshot<object> }) => {
    state = useListState({ collection })
    logicalFocus = () => state.selectionManager.setFocused(true)
    return (
      <NativeListStateContext.Provider value={state}>
        <NativeTagListContext.Provider value={{ ref: target, role: "group", onFocus: focus, style: { fontSize: 19 } }}>
          <NativeTagList
            testID="list"
            renderEmptyState={empty}
            style={(values) => ({ ...values.defaultStyle, opacity: values.isFocused ? 1 : 0.5 })}
          />
        </NativeTagListContext.Provider>
      </NativeListStateContext.Provider>
    )
  }
  await render(
    <NativeThemeProvider>
      <NativeCollectionBuilder<object> content={null}>
        {(collection) => <Receiver collection={collection} />}
      </NativeCollectionBuilder>
    </NativeThemeProvider>,
  )
  expect(target.current).not.toBeNull()
  expect(empty.mock.calls.at(-1)?.[0]).toMatchObject({ isEmpty: true, isFocused: false, isFocusVisible: false, state })
  await act(logicalFocus)
  expect(state.selectionManager.isFocused).toBe(true)
  expect(empty.mock.calls.at(-1)?.[0].isFocused).toBe(false)
  const props = screen.getByTestId("list", hidden).props
  const event = {
    nativeEvent: {
      ownerId: props.ownerId,
      target: RN.findNodeHandle(target.current),
      isFocused: true,
      isFocusVisible: true,
    },
  }
  await act(() => props.onNativeFocusChange(event))
  expect(focus.mock.calls[0][0]).toBe(event)
  expect(empty.mock.calls.at(-1)?.[0]).toMatchObject({ isFocused: true, isFocusVisible: true })
  expect(RN.StyleSheet.flatten(screen.getByText("No tags", hidden).props.style).fontSize).toBe(19)
})

it("inherits root/list native typography while item styles retain final precedence", async () => {
  const final = jest.fn((values) => ({ ...values.defaultStyle, fontSize: 23 }))
  await render(
    <NativeThemeProvider>
      <TagGroup
        onRemove={jest.fn()}
        customStyles={{ fontSize: 15 }}
        style={{ fontSize: 17 }}
        customTagListStyles={{ fontSize: 19, fontWeight: "700" }}
      >
        <Tag id="a">Inherited</Tag>
        <Tag id="b" style={final} closeIcon="×">
          Final
        </Tag>
      </TagGroup>
    </NativeThemeProvider>,
  )
  expect(RN.StyleSheet.flatten(screen.getByText("Inherited", hidden).props.style)).toMatchObject({
    fontSize: 19,
    fontWeight: "700",
  })
  expect(RN.StyleSheet.flatten(screen.getByText("Final", hidden).props.style).fontSize).toBe(23)
  expect(RN.StyleSheet.flatten(screen.getByText("×", hidden).props.style).fontSize).toBe(23)
  expect(final.mock.calls.at(-1)?.[0].defaultStyle).toMatchObject({ fontSize: 19, fontWeight: "700" })
  expect(RN.StyleSheet.flatten(screen.getByTestId("tag-group", hidden).props.style).fontSize).toBeUndefined()
  expect(RN.StyleSheet.flatten(screen.getByTestId("tag-list", hidden).props.style).fontSize).toBeUndefined()
})

it("publishes the current original selection indicator state inside grouped item content", async () => {
  const observed = new Map<string, boolean>()
  const Indicator = ({ name }: { name: string }) => {
    observed.set(name, useContext(NativeSelectionIndicatorContext).isSelected)
    return null
  }
  const node = (keys: (string | number)[]) => (
    <NativeThemeProvider>
      <TagGroup selectionMode="multiple" selectedKeys={keys}>
        <Tag id={0} textValue="Zero">
          <Indicator name="number" />
        </Tag>
        <Tag id="0" textValue="String zero">
          <Indicator name="string" />
        </Tag>
      </TagGroup>
    </NativeThemeProvider>
  )
  const view = await render(node([0]))
  expect([...observed]).toEqual([
    ["number", true],
    ["string", false],
  ])
  await view.rerender(node(["0"]))
  expect([...observed]).toEqual([
    ["number", false],
    ["string", true],
  ])
})

it("retains every logical item through a committed branch and reports its real row position", async () => {
  const Branch = createNativeCollectionBranch<object, { children?: React.ReactNode }, RN.View>(
    "section",
    (_props, _ref, node) => {
      const state = useContext(NativeListStateContext)!
      const { CollectionBranch } = useContext(NativeCollectionRendererContext)
      return <CollectionBranch collection={state.collection as TNativeCollectionSnapshot<object>} parent={node} />
    },
  )
  await render(
    <NativeThemeProvider>
      <TagGroup selectionMode="multiple">
        <Branch>
          <Tag id={0} testID="number">
            Zero
          </Tag>
          <Tag id="0" testID="string">
            String zero
          </Tag>
        </Branch>
      </TagGroup>
    </NativeThemeProvider>,
  )
  expect(JSON.parse(screen.getByTestId("tag-list", hidden).props.nativeCollectionSemantics).rowCount).toBe(2)
  expect(JSON.parse(screen.getByTestId("number", hidden).props.nativeCollectionSemantics).rowIndex).toBe(0)
  expect(JSON.parse(screen.getByTestId("string", hidden).props.nativeCollectionSemantics).rowIndex).toBe(1)
})

it("merges default and named slots with caller precedence, original native refs/events and custom root rendering", async () => {
  const inherited = createRef<RN.View>(),
    caller = createRef<RN.View>()
  const order: string[] = []
  const defaultLayout = jest.fn((_event: RN.LayoutChangeEvent) => order.push("context")),
    callerLayout = jest.fn((_event: RN.LayoutChangeEvent) => order.push("caller"))
  const customRoot = jest.fn((props: React.ComponentProps<typeof NativeFocusView>, _state: undefined) => (
    <NativeFocusView {...props} />
  ))
  const view = await render(
    <NativeThemeProvider>
      <NativeTagGroupContext.Provider
        value={{
          slots: {
            [NATIVE_DEFAULT_SLOT]: {
              ref: inherited,
              "aria-label": "Default",
              onLayout: defaultLayout,
              style: { opacity: 0.5 },
            },
            named: { "aria-label": "Named" },
          },
        }}
      >
        <TagGroup ref={caller} style={{ opacity: 0.8 }} onLayout={callerLayout} render={customRoot}>
          <Tag id="a">Alpha</Tag>
        </TagGroup>
        <TagGroup slot="named" testID="named" />
        <TagGroup slot={null} testID="isolated" />
      </NativeTagGroupContext.Provider>
    </NativeThemeProvider>,
  )
  expect(caller.current).not.toBeNull()
  expect(inherited.current === caller.current).toBe(true)
  expect(screen.getByTestId("tag-group", hidden).props.accessibilityLabel).toBe("Default")
  expect(RN.StyleSheet.flatten(screen.getByTestId("tag-group", hidden).props.style).opacity).toBe(0.8)
  expect(screen.getByTestId("named", hidden).props.accessibilityLabel).toBe("Named")
  expect(screen.getByTestId("isolated", hidden).props.accessibilityLabel).toBeUndefined()
  const event = { nativeEvent: { layout: { x: 1, y: 2, width: 300, height: 80 } } }
  await act(() => screen.getByTestId("tag-group", hidden).props.onLayout(event))
  expect(order).toEqual(["context", "caller"])
  expect(defaultLayout.mock.calls[0][0] === event).toBe(true)
  expect(callerLayout.mock.calls[0][0] === event).toBe(true)
  expect(customRoot.mock.calls.at(-1)?.[1]).toBeUndefined()
  await view.unmount()
  expect(caller.current).toBeNull()
  expect(inherited.current).toBeNull()
})

it("exposes the actual filtered state and native list props while preserving original item values", async () => {
  const values = [
    { id: "a", label: "Alpha" },
    { id: "b", label: "Beta" },
  ]
  const listRef = createRef<RN.View>()
  let state!: TNativeListState<object>
  let listProps!: React.ContextType<typeof NativeTagListContext>
  const Root = (props: TNativeCollectionRootProps) => {
    state = useContext(NativeListStateContext)!
    listProps = useContext(NativeTagListContext)
    return <DefaultNativeCollectionRenderer.CollectionRoot {...props} />
  }
  await render(
    <NativeThemeProvider>
      <NativeSelectableCollectionContext.Provider value={{ ref: listRef, filter: (text) => text === "Beta" }}>
        <NativeCollectionRendererContext.Provider value={{ ...DefaultNativeCollectionRenderer, CollectionRoot: Root }}>
          <TagGroup items={values}>{(item) => <Tag testID={item.id}>{item.label}</Tag>}</TagGroup>
        </NativeCollectionRendererContext.Provider>
      </NativeSelectableCollectionContext.Provider>
    </NativeThemeProvider>,
  )
  expect([...state.collection].map((node) => node.key)).toEqual(["b"])
  expect(state.collection.getItem("b")?.value === values[1]).toBe(true)
  expect(screen.queryByTestId("a", hidden)).toBeNull()
  expect(listRef.current).not.toBeNull()
  expect(listProps && "role" in listProps && listProps.role).toBe("grid")
  expect(listProps && "style" in listProps && listProps.style).toBeDefined()
})

it("keeps numeric and string keys separate through authored reorder without replacing native refs", async () => {
  const number = createRef<RN.View>(),
    string = createRef<RN.View>()
  const item = (key: string | number) => (
    <Tag key={typeof key + key} id={key} ref={typeof key === "number" ? number : string}>
      {String(key)}
    </Tag>
  )
  const view = await render(
    <NativeThemeProvider>
      <TagGroup>{[0, "0"].map(item)}</TagGroup>
    </NativeThemeProvider>,
  )
  const firstNumber = number.current,
    firstString = string.current
  expect(firstNumber !== firstString).toBe(true)
  await view.rerender(
    <NativeThemeProvider>
      <TagGroup>{["0", 0].map(item)}</TagGroup>
    </NativeThemeProvider>,
  )
  expect(number.current === firstNumber).toBe(true)
  expect(string.current === firstString).toBe(true)
})
