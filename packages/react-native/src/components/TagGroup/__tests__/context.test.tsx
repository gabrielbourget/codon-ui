import { createRef, useContext } from "react"
import * as RN from "react-native"

import { NativeThemeProvider } from "../../.."
import {
  actWithNativeCollections as act,
  renderWithNativeCollections as render,
  screen,
} from "../../../collection/__tests__/nativeReceipts"
import { NATIVE_DEFAULT_SLOT, NativeSelectableCollectionContext } from "../../../collection/context"
import {
  DefaultNativeCollectionRenderer,
  NativeCollectionRendererContext,
  type TNativeCollectionRootProps,
} from "../../../collection/renderer"
import { NativeListStateContext, type TNativeListState } from "../../../collection/state"
import { NativeFocusView } from "../../../input/NativeFocusView"
import { NativeTagGroupContext, NativeTagListContext } from "../context"
import { Tag } from "../Tag"
import { TagGroup } from "../TagGroup"

beforeEach(() => jest.spyOn(RN.AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true))
afterEach(() => jest.restoreAllMocks())
const hidden = { includeHiddenElements: true }

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
