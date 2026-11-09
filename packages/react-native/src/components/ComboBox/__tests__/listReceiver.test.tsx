import "./visibleCollections"

import { createRef, useLayoutEffect, useSyncExternalStore, useState, type ReactNode, type RefObject } from "react"
import { ScrollView, TextInput, View } from "react-native"

import { NativeCollectionActions, NativeCollectionActionsContext } from "../../../collection/actions"
import { NATIVE_DEFAULT_SLOT, NativeSelectableCollectionContext } from "../../../collection/context"
import { NativeCollectionModel, nativeCollectionOwnerBinding } from "../../../collection/model"
import {
  NativeCollectionRendererContext,
  type TNativeCollectionRenderer,
  type TNativeCollectionRootProps,
  type TNativeCollectionScrollHost,
} from "../../../collection/renderer"
import { NativeFocusHost } from "../../../input/NativeFocusView"
import { createNativeVisibleCollectionAdmission } from "../../../input/nativeVisibleCollectionAdmission"
import { NativeThemeProvider } from "../../../theme"
import {
  NativeComboBoxList,
  NativeComboBoxListEnvironmentContext,
  type TNativeComboBoxListProps,
  type TNativeComboBoxListRenderState,
} from "../CollectionComboBoxList"
import { NativeComboBoxListContext, NativeComboBoxStateContext } from "../collectionContext"
import { collection, ITEMS, type TItem } from "../state/__tests__/collection"
import type { ComboBoxState } from "../state/types"
import { useComboBoxState } from "../state/useComboBoxState"

import { actWithNativeCollections as act, renderWithNativeCollections as render, screen } from "./visibleCollections"

const emptyRenderer = { CollectionRoot: () => null, CollectionBranch: () => null }
const wrap = (children: ReactNode) => (
  <NativeThemeProvider>
    <NativeCollectionRendererContext.Provider value={emptyRenderer}>
      {children}
    </NativeCollectionRendererContext.Provider>
  </NativeThemeProvider>
)
beforeEach(() => jest.useFakeTimers())
afterEach(() => {
  jest.clearAllTimers()
  jest.restoreAllMocks()
  jest.useRealTimers()
})

it("publishes the actual committed list renderer and retires only its own layout lease", async () => {
  const first = { ...emptyRenderer, isVirtualized: true },
    second = { ...emptyRenderer, isVirtualized: true },
    retireFirst = jest.fn(),
    retireSecond = jest.fn(),
    registerRenderer = jest.fn((renderer: TNativeCollectionRenderer) =>
      renderer === first ? retireFirst : retireSecond,
    ),
    scroll = createRef<TNativeCollectionScrollHost>()
  const Harness = () => {
    const state = useComboBoxState({ collection: collection(), isOpen: true })
    return (
      <NativeComboBoxStateContext.Provider value={state}>
        <NativeComboBoxList />
      </NativeComboBoxStateContext.Provider>
    )
  }
  const content = (renderer: TNativeCollectionRenderer) =>
    wrap(
      <NativeCollectionRendererContext.Provider value={renderer}>
        <NativeComboBoxListEnvironmentContext.Provider
          value={{ scrollRef: scroll, isOpen: true, isCollectionPending: false, registerRenderer }}
        >
          <Harness />
        </NativeComboBoxListEnvironmentContext.Provider>
      </NativeCollectionRendererContext.Provider>,
    )
  const view = await render(content(first))
  expect(registerRenderer).toHaveBeenCalledTimes(1)
  expect(registerRenderer).toHaveBeenLastCalledWith(first)
  await view.rerender(content(first))
  expect(registerRenderer).toHaveBeenCalledTimes(1)
  expect(retireFirst).not.toHaveBeenCalled()
  await view.rerender(content(second))
  expect(retireFirst).toHaveBeenCalledTimes(1)
  expect(registerRenderer).toHaveBeenLastCalledWith(second)
  await view.unmount()
  expect(retireSecond).toHaveBeenCalledTimes(1)
})

it.each([
  ["first", null, [], 0],
  ["last", null, [], "b"],
  [true, null, [], null],
  ["last", "", [], ""],
  ["first", null, [0], ""],
  ["first", null, [0, "", "b"], null],
] as const)(
  "consumes strategy %s with selected %s and disabled %s without focusing the original editor",
  async (autoFocus, value, disabledKeys, expected) => {
    let state!: ComboBoxState<TItem>
    const input = createRef<TextInput>(),
      values = jest.fn(),
      changed = jest.fn(),
      requested = jest.fn()
    let focus: jest.SpyInstance | undefined
    const bindInput = (target: TextInput | null) => {
      input.current = target
      if (target && !focus) focus = jest.spyOn(target, "focus")
    }
    const originalCollection = collection()
    const Harness = () => {
      state = useComboBoxState({ collection: originalCollection, value, disabledKeys, onChange: changed })
      return (
        <>
          <TextInput ref={bindInput} testID="independent-editor" value="held" />
          <NativeComboBoxStateContext.Provider value={state}>
            <NativeComboBoxListContext.Provider value={{ autoFocus, shouldUseVirtualFocus: true }}>
              <NativeComboBoxList
                render={(props, flags) => {
                  values(flags)
                  return <NativeFocusHost {...props} testID="list" />
                }}
              />
            </NativeComboBoxListContext.Provider>
          </NativeComboBoxStateContext.Provider>
        </>
      )
    }
    await render(
      wrap(
        <NativeCollectionRendererContext.Provider
          value={{
            CollectionRoot: () => null,
            CollectionBranch: () => null,
            layoutDelegate: {
              getVisibleRect: () => ({ x: 0, y: 0, width: 200, height: 100 }),
              getItemRect: () => ({ x: 0, y: 0, width: 50, height: 40 }),
              getContentSize: () => ({ width: 200, height: 200 }),
              requestRendering: requested,
              scrollToKey: requested,
            },
          }}
        >
          <Harness />
        </NativeCollectionRendererContext.Provider>,
      ),
    )
    expect(state.selectionManager.isFocused).toBe(true)
    expect(state.selectionManager.focusedKey).toBe(expected)
    expect(values.mock.calls.at(-1)?.[0]).toMatchObject({
      isEmpty: false,
      isFocused: false,
      isFocusVisible: false,
      isDropTarget: false,
      layout: "stack",
      orientation: "vertical",
    })
    expect(values.mock.calls.at(-1)?.[0].state.selectionManager.focusedKey).toBe(expected)
    expect(focus).toBeDefined()
    expect(focus).not.toHaveBeenCalled()
    expect(changed).not.toHaveBeenCalled()
    expect(screen.getByTestId("independent-editor").props.value).toBe("held")
    if (expected != null) expect(requested).toHaveBeenCalledWith(expected)
  },
)

it.each(["first", "last"] as const)(
  "applies %s on each accepted opening of a retained list without resetting later navigation",
  async (strategy) => {
    let state!: ComboBoxState<TItem>
    const originalCollection = collection(),
      ref = createRef<View>(),
      changed = jest.fn()
    const Harness = () => {
      state = useComboBoxState({ collection: originalCollection, value: null, onChange: changed })
      return (
        <NativeComboBoxStateContext.Provider value={state}>
          <NativeComboBoxList ref={ref} autoFocus={state.focusStrategy || true} />
        </NativeComboBoxStateContext.Provider>
      )
    }
    const node = wrap(<Harness />)
    const view = await render(node)
    const original = ref.current
    expect(original).not.toBeNull()
    expect(state.selectionManager.focusedKey).toBeNull()
    await act(() => state.open(strategy, "manual"))
    expect(state.isOpen).toBe(true)
    expect(state.selectionManager.focusedKey).toBe(strategy === "first" ? 0 : "b")
    await act(() => state.selectionManager.setFocusedKey(""))
    await view.rerender(node)
    expect(state.selectionManager.focusedKey).toBe("")
    await act(() => state.close())
    expect(state.isOpen).toBe(false)
    expect(state.selectionManager.focusedKey).toBeNull()
    await act(() => state.open(strategy === "first" ? "last" : "first", "manual"))
    expect(state.selectionManager.focusedKey).toBe(strategy === "first" ? "b" : 0)
    expect(ref.current).toBe(original)
    expect(changed).not.toHaveBeenCalled()
  },
)

it("does not consume a retained list opening strategy until its controlled owner accepts", async () => {
  let state!: ComboBoxState<TItem>
  const originalCollection = collection(),
    ref = createRef<View>(),
    requested = jest.fn()
  const Harness = ({ open }: { open: boolean }) => {
    state = useComboBoxState({ collection: originalCollection, isOpen: open, value: null, onOpenChange: requested })
    return (
      <NativeComboBoxStateContext.Provider value={state}>
        <NativeComboBoxList ref={ref} autoFocus={state.focusStrategy || true} />
      </NativeComboBoxStateContext.Provider>
    )
  }
  const view = await render(wrap(<Harness open={false} />))
  const original = ref.current
  await act(() => state.open("last", "manual"))
  expect(requested).toHaveBeenCalledWith(true, "manual")
  expect(state.isOpen).toBe(false)
  expect(state.selectionManager.focusedKey).toBeNull()
  await view.rerender(wrap(<Harness open={true} />))
  expect(state.selectionManager.focusedKey).toBe("b")
  expect(ref.current).toBe(original)
})

it("waits for committed collection readiness and keeps empty-collection autofocus pending until actual items arrive", async () => {
  let state!: ComboBoxState<TItem>, setReady!: (ready: boolean) => void, setItems!: (items: boolean) => void
  const empty = collection().filter(() => false),
    populated = collection(),
    scroll = createRef<TNativeCollectionScrollHost>()
  const Harness = () => {
    const [ready, readySetter] = useState(false),
      [hasItems, itemsSetter] = useState(false)
    setReady = readySetter
    setItems = itemsSetter
    state = useComboBoxState({
      collection: hasItems ? populated : empty,
      items: [],
      isOpen: true,
      allowsEmptyCollection: true,
    })
    return (
      <NativeComboBoxStateContext.Provider value={state}>
        <NativeComboBoxListEnvironmentContext.Provider
          value={{ scrollRef: scroll, isOpen: true, isCollectionPending: !ready }}
        >
          <NativeComboBoxList autoFocus="first" />
        </NativeComboBoxListEnvironmentContext.Provider>
      </NativeComboBoxStateContext.Provider>
    )
  }
  await render(wrap(<Harness />))
  expect(state.selectionManager.isFocused).toBe(false)
  await act(() => setReady(true))
  expect(state.selectionManager.isFocused).toBe(true)
  expect(state.selectionManager.focusedKey).toBeNull()
  await act(() => setItems(true))
  expect(state.selectionManager.focusedKey).toBe(0)
})

it("preserves named/null refs, scoped caller precedence, real scroll ownership and renderer persisted keys", async () => {
  const inherited = createRef<View>(),
    caller = createRef<View>(),
    scroll = createRef<TNativeCollectionScrollHost>(),
    rendered: TNativeCollectionRootProps[] = [],
    values: TNativeComboBoxListRenderState[] = []
  const original = collection()
  const Harness = () => {
    const state = useComboBoxState({ collection: original })
    return (
      <NativeComboBoxStateContext.Provider value={state}>
        <NativeComboBoxListEnvironmentContext.Provider
          value={{ scrollRef: scroll, isOpen: true, isCollectionPending: false }}
        >
          <NativeComboBoxListContext.Provider
            value={{
              slots: {
                [NATIVE_DEFAULT_SLOT]: { nativeID: "default" },
                options: { ref: inherited, autoFocus: "first", nativeID: "context", style: { padding: 9 } },
              },
            }}
          >
            <NativeComboBoxList
              slot="options"
              ref={caller}
              nativeID="caller"
              style={(flags) => {
                expect(flags.defaultStyle).toMatchObject({ padding: 9 })
                return { backgroundColor: "blue" }
              }}
              render={(props, flags) => {
                values.push(flags)
                return <NativeFocusHost {...props} testID="options" />
              }}
            />
            <NativeComboBoxList slot={null} testID="isolated" />
          </NativeComboBoxListContext.Provider>
        </NativeComboBoxListEnvironmentContext.Provider>
      </NativeComboBoxStateContext.Provider>
    )
  }
  const Root = (props: TNativeCollectionRootProps) => {
    rendered.push(props)
    return <ScrollView testID="owned-renderer-scroll" ref={props.scrollRef as RefObject<ScrollView | null>} />
  }
  const view = await render(
    wrap(
      <NativeCollectionRendererContext.Provider
        value={{ isVirtualized: true, CollectionRoot: Root, CollectionBranch: () => null }}
      >
        <Harness />
      </NativeCollectionRendererContext.Provider>,
    ),
  )
  expect(caller.current === inherited.current).toBe(true)
  expect(caller.current).not.toBeNull()
  expect(scroll.current).not.toBeNull()
  expect(screen.getByTestId("options").props.nativeID).toBe("caller")
  expect(screen.getByTestId("isolated").props.nativeID).toBeUndefined()
  expect(screen.getByTestId("options")).toHaveStyle({ padding: 9, backgroundColor: "blue" })
  expect(rendered.at(-1)?.collection).toBe(original)
  expect(rendered.at(-1)?.scrollRef).toBe(scroll)
  expect(rendered.at(-1)?.persistedKeys).toEqual(new Set([0]))
  expect(values.at(-1)?.state.collection.getItem(0)?.value).toBe(ITEMS[0])
  await view.unmount()
  expect([caller.current, inherited.current, scroll.current]).toEqual([null, null, null])
})

it("uses the scoped selectable filter and complete empty render state without copying owner item objects", async () => {
  let update!: (empty: boolean) => void
  const values = jest.fn(),
    renderCollection = jest.fn(),
    onScroll = jest.fn(),
    original = collection()
  const Harness = () => {
    const [empty, setEmpty] = useState(false)
    update = setEmpty
    const state = useComboBoxState({ collection: original })
    return (
      <NativeComboBoxStateContext.Provider value={state}>
        <NativeSelectableCollectionContext.Provider value={{ filter: (text) => !empty && text === "Alpha" }}>
          <NativeComboBoxList
            autoFocus="first"
            onScroll={onScroll}
            renderEmptyState={(flags) => {
              values(flags)
              return "No matches"
            }}
          />
        </NativeSelectableCollectionContext.Provider>
      </NativeComboBoxStateContext.Provider>
    )
  }
  await render(
    wrap(
      <NativeCollectionRendererContext.Provider
        value={{
          isVirtualized: true,
          CollectionRoot: (props) => {
            renderCollection(props)
            return (
              <ScrollView
                ref={props.scrollRef as RefObject<ScrollView | null>}
                onScroll={props.onScroll}
                testID="filtered-scroll"
              />
            )
          },
          CollectionBranch: () => null,
        }}
      >
        <Harness />
      </NativeCollectionRendererContext.Provider>,
    ),
  )
  const props = renderCollection.mock.calls.at(-1)?.[0] as TNativeCollectionRootProps
  expect([...props.collection.getKeys()]).toEqual([0])
  expect(props.collection.getItem(0)?.value).toBe(ITEMS[0])
  const originalScroll = props.scrollRef?.current
  const event = { nativeEvent: { contentOffset: { x: 3, y: 7 } } }
  await act(() => screen.getByTestId("filtered-scroll").props.onScroll(event))
  expect(onScroll.mock.calls).toEqual([[event]])
  await act(() => update(true))
  expect(screen.getByText("No matches")).toBeOnTheScreen()
  expect(values.mock.calls.at(-1)?.[0]).toMatchObject({
    isEmpty: true,
    isFocused: false,
    isFocusVisible: false,
    layout: "stack",
    orientation: "vertical",
  })
  expect(renderCollection.mock.calls.at(-1)?.[0].scrollRef.current).toBe(originalScroll)
  expect(renderCollection.mock.calls.at(-1)?.[0].collection.size).toBe(0)
})

it("keeps actual list focus events separate from logical manager focus and retires captured callbacks", async () => {
  const focused = jest.fn(),
    blurred = jest.fn(),
    states: TNativeComboBoxListRenderState[] = [],
    original = collection()
  const Harness = (props: TNativeComboBoxListProps) => {
    const state = useComboBoxState({ collection: original })
    return (
      <NativeComboBoxStateContext.Provider value={state}>
        <NativeComboBoxList
          {...props}
          onFocus={props.onFocus ?? focused}
          onBlur={blurred}
          render={(host, flags) => {
            states.push(flags)
            return <NativeFocusHost {...host} testID="observed-list" />
          }}
        />
      </NativeComboBoxStateContext.Provider>
    )
  }
  const view = await render(wrap(<Harness autoFocus shouldUseVirtualFocus />))
  const root = screen.getByTestId("observed-list"),
    oldFocus = root.props.onNativeFocusChange
  const event = {
    nativeEvent: {
      ownerId: root.props.ownerId,
      target: 17,
      isFocused: true,
      isFocusVisible: true,
      origin: "programmatic",
      timestamp: 1,
    },
  }
  expect(states.at(-1)?.isFocused).toBe(false)
  await act(() => oldFocus(event))
  expect(focused.mock.calls).toEqual([[event]])
  expect(states.at(-1)).toMatchObject({ isFocused: true, isFocusVisible: true })
  const blur = { nativeEvent: { ...event.nativeEvent, isFocused: false } }
  await act(() => screen.getByTestId("observed-list").props.onNativeFocusChange(blur))
  expect(blurred.mock.calls).toEqual([[blur]])
  expect(states.at(-1)?.isFocused).toBe(false)
  const replacement = jest.fn()
  await view.rerender(wrap(<Harness autoFocus shouldUseVirtualFocus onFocus={replacement} />))
  await act(() => oldFocus(event))
  expect(replacement.mock.calls).toEqual([[event]])
  expect(focused).toHaveBeenCalledTimes(1)
  await view.rerender(wrap(<View />))
  await act(() => oldFocus(event))
  expect(focused).toHaveBeenCalledTimes(1)
  expect(replacement).toHaveBeenCalledTimes(1)
})

it.each(["live", "unmounted", "controller-replaced"] as const)(
  "readmits nonvirtual container focus only to the current original binding: %s",
  async (mode) => {
    // Synthetic controller receipts test request ownership only; they are no installed native focus proof.
    const native = jest.requireActual<typeof import("react-native")>("react-native")
    const inherited = jest.mocked(native.findNodeHandle).getMockImplementation()!
    const targets = new WeakMap<object, number>()
    let nextTarget = 700000
    jest.mocked(native.findNodeHandle).mockImplementation((view) => {
      const original = inherited(view)
      if (original) return original
      if (!view || typeof view !== "object") return null
      if (!targets.has(view)) targets.set(view, ++nextTarget)
      return targets.get(view)!
    })
    const original = collection().filter(() => false)
    const makeActions = (ownerId: string) => {
      const model = new NativeCollectionModel<unknown>(ownerId)
      const snapshot = model.prepare(original)
      model.commit(snapshot)
      const transport = createNativeVisibleCollectionAdmission()
      const actions = new NativeCollectionActions(model, transport.adapter, snapshot)
      return { actions, transport, binding: nativeCollectionOwnerBinding(snapshot) }
    }
    const first = makeActions("model-owner")
    let replaceActions!: (next: typeof first) => void
    const focusModule = jest.requireActual<typeof import("../../../input/focus")>("../../../input/focus")
    const focus = jest.spyOn(focusModule, "focusNativeTarget")
    const ref = createRef<View>()
    const Harness = () => {
      const state = useComboBoxState({ collection: original, isOpen: true, items: [], allowsEmptyCollection: true })
      const [current, updateActions] = useState(first)
      replaceActions = updateActions
      useSyncExternalStore(current.transport.adapter.subscribe, current.transport.adapter.getSnapshot)
      useLayoutEffect(() => current.transport.adapter.registerOwner(current.binding, ref.current!), [current])
      return (
        <NativeCollectionActionsContext.Provider value={current.actions}>
          <NativeComboBoxStateContext.Provider value={state}>
            <NativeComboBoxList ref={ref} autoFocus shouldUseVirtualFocus={false} />
          </NativeComboBoxStateContext.Provider>
        </NativeCollectionActionsContext.Provider>
      )
    }
    const view = await render(wrap(<Harness />))
    expect(focus).not.toHaveBeenCalled()
    const publication = JSON.parse(first.transport.publication())
    await act(() =>
      first.transport.receiveCommit(
        JSON.stringify({
          intent: publication.intent,
          publisher: "source-list-publisher",
          instance: 1,
          sequence: 1,
          lifetime: "source-list-lifetime",
          registrations: [{ ...publication.root, binding: "source-list-lease" }],
        }),
      ),
    )
    const [request, ...extra] = JSON.parse(first.transport.requests())
    expect(request).toBeDefined()
    expect(extra).toEqual([])
    const originalHost = ref.current
    if (mode === "unmounted") await view.rerender(wrap(<View />))
    if (mode === "controller-replaced") await act(() => replaceActions(makeActions("replacement-owner")))
    await act(() =>
      first.transport.receiveAction(
        JSON.stringify({
          id: request.id,
          binding: request.binding,
          publisher: "source-list-publisher",
          accepted: true,
        }),
      ),
    )
    if (mode !== "live") expect(focus).not.toHaveBeenCalled()
    else expect(focus.mock.calls).toEqual([[originalHost]])
    focus.mockRestore()
  },
)
