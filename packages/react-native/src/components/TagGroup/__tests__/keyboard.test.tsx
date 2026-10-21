import { fireEvent, screen } from "@testing-library/react-native"
import { createRef, Fragment, useContext, useState, type ReactNode, type RefObject } from "react"
import * as RN from "react-native"

import { Button, NativeFloatingLayerHost, NativeOverlayProvider, NativeThemeProvider } from "../../.."
import {
  actWithNativeCollections as act,
  renderWithNativeCollections as render,
} from "../../../collection/__tests__/nativeReceipts"
import { NativeSelectableCollectionContext } from "../../../collection/context"
import {
  DefaultNativeCollectionRenderer,
  NativeCollectionRendererContext,
  type TNativeCollectionRenderer,
  type TNativeCollectionRootProps,
} from "../../../collection/renderer"
import { NativeListStateContext, type TNativeListState } from "../../../collection/state"
import { nativeKeyToken } from "../../../input/keyScope"
import { Commands } from "../../../input/specs/CUIFocusViewNativeComponent"
import { encodeCollectionKey } from "../../collection"
import { Tag } from "../Tag"
import { TagGroup } from "../TagGroup"
import type { TNativeTagGroupProps } from "../types"

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: jest.requireActual("react-native").View,
  SafeAreaView: jest.requireActual("react-native").View,
}))
const row = (id: string) => screen.getByTestId(id, { includeHiddenElements: true })
beforeEach(() => {
  jest.replaceProperty(RN.Platform, "OS", "android")
  jest.spyOn(RN.AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  jest.spyOn(Commands, "requestKeyboardFocus").mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())
const fixture = async (
  props: TNativeTagGroupProps,
  children: ReactNode,
  renderer = DefaultNativeCollectionRenderer,
  virtualFocusContext = false,
  collectionRef?: RefObject<RN.View | null>,
  beforeReady?: () => void,
) => {
  const view = await render(
    <NativeThemeProvider>
      <NativeCollectionRendererContext.Provider value={renderer}>
        <NativeOverlayProvider>
          <NativeFloatingLayerHost testID="host">
            <NativeSelectableCollectionContext.Provider
              value={
                virtualFocusContext || collectionRef
                  ? { shouldUseVirtualFocus: virtualFocusContext, ref: collectionRef }
                  : null
              }
            >
              <TagGroup {...props}>{children}</TagGroup>
            </NativeSelectableCollectionContext.Provider>
          </NativeFloatingLayerHost>
        </NativeOverlayProvider>
      </NativeCollectionRendererContext.Provider>
    </NativeThemeProvider>,
  )
  await fireEvent(row("tag-list"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 80 } } })
  for (const ready of [false, true]) {
    const host = row("host").props
    await act(() =>
      host.onNativeScopeStatus({
        nativeEvent: {
          ownerId: host.ownerId,
          windowId: "tags-window",
          epoch: 1,
          policyRevision: host.policyRevision,
          ready,
          windowActive: true,
        },
      }),
    )
    if (!ready && beforeReady) await act(beforeReady)
  }
  return view
}

it.each(["enabled", "disabled", "all-disabled"] as const)(
  "requests the source autofocus target for %s items once",
  async (mode) => {
    const first = createRef<RN.View>(),
      second = createRef<RN.View>(),
      list = createRef<RN.View>()
    await fixture(
      { disabledKeys: mode === "enabled" ? [] : mode === "disabled" ? ["a"] : ["a", "b"] },
      <>
        <Tag id="a" textValue="Alpha" ref={first} autoFocus>
          Alpha
        </Tag>
        <Tag id="b" textValue="Beta" ref={second}>
          Beta
        </Tag>
      </>,
      DefaultNativeCollectionRenderer,
      false,
      list,
    )
    expect(Commands.requestKeyboardFocus).toHaveBeenCalledTimes(1)
    expect(Commands.requestKeyboardFocus).toHaveBeenCalledWith(
      mode === "disabled" ? second.current : first.current,
      expect.any(String),
    )
  },
)

it("samples item autofocus on its original lifetime rather than later prop updates", async () => {
  let enable!: () => void
  const Authored = () => {
    const [autoFocus, setAutoFocus] = useState(false)
    enable = () => setAutoFocus(true)
    return (
      <Tag id="a" autoFocus={autoFocus}>
        Alpha
      </Tag>
    )
  }
  await fixture({}, <Authored />)
  await act(enable)
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
})

it("retires initial autofocus if original input arrives before native readiness", async () => {
  await fixture(
    {},
    <Tag id="a" autoFocus>
      Alpha
    </Tag>,
    DefaultNativeCollectionRenderer,
    false,
    undefined,
    () => {
      const host = row("host").props
      host.onNativeInputModality({
        nativeEvent: { ownerId: host.ownerId, windowId: "tags-window", epoch: 1, origin: "pointer", timestamp: 101 },
      })
    },
  )
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
})

it("does not revive initial autofocus in a replacement native window epoch", async () => {
  await fixture(
    {},
    <Tag id="a" autoFocus>
      Alpha
    </Tag>,
    DefaultNativeCollectionRenderer,
    false,
    undefined,
    () => {
      const host = row("host").props
      host.onNativeScopeStatus({
        nativeEvent: {
          ownerId: host.ownerId,
          windowId: "tags-window",
          epoch: 2,
          policyRevision: host.policyRevision,
          ready: true,
          windowActive: true,
        },
      })
    },
  )
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
})

it("matches the source TagGroup's physical-focus policy when the collection context requests virtual focus", async () => {
  let state!: TNativeListState<object>
  const Root = (props: TNativeCollectionRootProps) => {
    state = useContext(NativeListStateContext)!
    return <DefaultNativeCollectionRenderer.CollectionRoot {...props} />
  }
  const target = createRef<RN.View>()
  await fixture(
    {},
    <Tag id="a" ref={target}>
      Alpha
    </Tag>,
    { ...DefaultNativeCollectionRenderer, CollectionRoot: Root },
    true,
  )
  await act(() => {
    state.selectionManager.setFocused(true)
    state.selectionManager.setFocusedKey("a")
  })
  expect(Commands.requestKeyboardFocus).toHaveBeenCalledTimes(1)
  expect(Commands.requestKeyboardFocus).toHaveBeenCalledWith(target.current, expect.any(String))
})

it("keeps complete state behind a partial renderer and waits for an actual offscreen focus target", async () => {
  const first = createRef<RN.View>(),
    second = createRef<RN.View>(),
    third = createRef<RN.View>()
  const requestRendering = jest.fn(),
    scrollToKey = jest.fn(),
    focus = jest.fn()
  let materialize!: (keys: (string | number)[]) => void
  let state!: TNativeListState<object>
  let renderedProps!: TNativeCollectionRootProps
  const Root = (props: TNativeCollectionRootProps) => {
    const [visible, setVisible] = useState<(string | number)[]>([0])
    materialize = setVisible
    state = useContext(NativeListStateContext)!
    renderedProps = props
    return [...props.collection]
      .filter((node) => visible.includes(node.key))
      .map((node) => <Fragment key={encodeCollectionKey(node.key)}>{node.render?.(node)}</Fragment>)
  }
  const renderer: TNativeCollectionRenderer = {
    ...DefaultNativeCollectionRenderer,
    isVirtualized: true,
    layoutDelegate: {
      getItemRect: (key) => ({ x: key === 0 ? 0 : key === "0" ? 100 : 200, y: 0, width: 100, height: 80 }),
      getVisibleRect: () => ({ x: 0, y: 0, width: 100, height: 80 }),
      getContentSize: () => ({ width: 300, height: 80 }),
      requestRendering,
      scrollToKey,
    },
    CollectionRoot: Root,
  }
  const change = jest.fn()
  await fixture(
    { selectionMode: "multiple", selectedKeys: [], onSelectionChange: change },
    <>
      <Tag id={0} ref={first} testID="first">
        First
      </Tag>
      <Tag id="0" ref={second} testID="second" onFocus={focus}>
        Second
      </Tag>
      <Tag id="third" ref={third}>
        Third
      </Tag>
    </>,
    renderer,
  )
  expect([...state.collection].map((node) => node.key)).toEqual([0, "0", "third"])
  expect(renderedProps.collection === state.collection).toBe(true)
  expect(renderedProps.scrollRef).toBeDefined()
  expect(second.current).toBeNull()
  await scoped("a", first.current, "0010:a", { ctrlKey: true })
  expect(change.mock.calls[0][0]).toBe("all")
  await scoped("ArrowDown", first.current)
  expect(requestRendering).toHaveBeenLastCalledWith("0")
  expect(scrollToKey).toHaveBeenLastCalledWith("0")
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
  expect(focus).not.toHaveBeenCalled()
  expect(state.selectionManager.focusedKey).toBe("0")
  expect(renderedProps.persistedKeys?.has("0")).toBe(true)
  await act(() => materialize([0, "0"]))
  expect(jest.mocked(Commands.requestKeyboardFocus).mock.calls.at(-1)?.[0] === second.current).toBe(true)
  expect(state.selectionManager.focusedKey).toBe("0")
  const host = row("second")
  const event = {
    nativeEvent: {
      ownerId: host.props.ownerId,
      target: RN.findNodeHandle(second.current),
      isFocused: true,
      isFocusVisible: true,
      origin: "keyboard",
      timestamp: 101,
    },
  }
  await act(() => host.props.onNativeFocusChange(event))
  expect(focus.mock.calls[0][0] === event).toBe(true)
  expect(state.selectionManager.focusedKey).toBe("0")
})

it("advances repeated logical navigation and keeps older focus acknowledgements from replacing the latest intent", async () => {
  const first = createRef<RN.View>(),
    last = createRef<RN.View>(),
    focus = jest.fn()
  let materialize!: () => void
  let state!: TNativeListState<object>
  const Root = ({ collection }: TNativeCollectionRootProps) => {
    const [all, setAll] = useState(false)
    materialize = () => setAll(true)
    state = useContext(NativeListStateContext)!
    return [...collection]
      .filter((node) => all || node.key === 0)
      .map((node) => <Fragment key={encodeCollectionKey(node.key)}>{node.render?.(node)}</Fragment>)
  }
  await fixture(
    {},
    <>
      <Tag id={0} ref={first} testID="first">
        First
      </Tag>
      <Tag id="middle">Middle</Tag>
      <Tag id="last" ref={last} onFocus={focus}>
        Last
      </Tag>
    </>,
    { ...DefaultNativeCollectionRenderer, isVirtualized: true, CollectionRoot: Root },
  )
  await scoped("ArrowDown", first.current)
  await scoped("ArrowDown", first.current)
  expect(state.selectionManager.focusedKey).toBe("last")
  const host = row("first")
  await act(() =>
    host.props.onNativeFocusChange({
      nativeEvent: {
        ownerId: host.props.ownerId,
        target: RN.findNodeHandle(first.current),
        isFocused: true,
        isFocusVisible: true,
        origin: "keyboard",
        timestamp: 90,
      },
    }),
  )
  expect(state.selectionManager.focusedKey).toBe("last")
  expect(focus).not.toHaveBeenCalled()
  await act(materialize)
  expect(jest.mocked(Commands.requestKeyboardFocus).mock.calls.at(-1)?.[0] === last.current).toBe(true)
  expect(focus).not.toHaveBeenCalled()
})

it("rejects a pending offscreen focus request after its native window retires", async () => {
  const first = createRef<RN.View>(),
    second = createRef<RN.View>()
  let materialize!: () => void
  const Root = ({ collection }: TNativeCollectionRootProps) => {
    const [all, setAll] = useState(false)
    materialize = () => setAll(true)
    return [...collection]
      .filter((node) => all || node.key === "first")
      .map((node) => <Fragment key={encodeCollectionKey(node.key)}>{node.render?.(node)}</Fragment>)
  }
  await fixture(
    {},
    <>
      <Tag id="first" ref={first}>
        First
      </Tag>
      <Tag id="second" ref={second}>
        Second
      </Tag>
    </>,
    { ...DefaultNativeCollectionRenderer, isVirtualized: true, CollectionRoot: Root },
  )
  await scoped("ArrowDown", first.current)
  const host = row("host").props
  await act(() =>
    host.onNativeScopeStatus({
      nativeEvent: {
        ownerId: host.ownerId,
        windowId: "tags-window",
        epoch: 1,
        policyRevision: host.policyRevision,
        ready: false,
        windowActive: false,
      },
    }),
  )
  await act(materialize)
  expect(second.current).not.toBeNull()
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
})
const scoped = async (
  value: string,
  focused: RN.View | null,
  token = `0000:${value}`,
  extra: Record<string, unknown> = {},
) => {
  const host = row("host").props,
    policy = host.policies.find((entry: { tokens: string[] }) => entry.tokens.includes(token))
  expect(!!policy).toBe(true)
  const event = {
    preventDefault: jest.fn(),
    isDefaultPrevented: () => false,
    nativeEvent: {
      kind: "keyboard",
      ownerId: host.ownerId,
      policyId: policy.id,
      target: 17,
      focusedTarget: RN.findNodeHandle(focused),
      windowId: "tags-window",
      epoch: 1,
      policyRevision: host.policyRevision,
      key: value,
      phase: "down",
      repeat: false,
      cancelled: false,
      nativeCode: 1,
      characters: "",
      nativeDefaultHandled: true,
      timestamp: 100,
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      capsLock: false,
      nativeModifierData: "0",
      ...extra,
    },
  }
  await act(() => host.onNativeScopedKey(event))
  return { host, event }
}

it("routes a captured deletion from an authored remove-slot target through its current row", async () => {
  const custom = createRef<RN.View>(),
    remove = jest.fn()
  let retire!: () => void
  const Authored = () => {
    const [visible, setVisible] = useState(true)
    retire = () => setVisible(false)
    return visible ? (
      <Button slot="remove" ref={custom}>
        Custom removal
      </Button>
    ) : null
  }
  await fixture(
    { selectionMode: "multiple", selectedKeys: ["a", "b"], onRemove: remove },
    <>
      <Tag id="a" textValue="Alpha">
        <Authored />
      </Tag>
      <Tag id="b">Beta</Tag>
    </>,
  )
  const target = RN.findNodeHandle(custom.current)
  expect(target).not.toBeNull()
  await scoped("Backspace", custom.current)
  expect(remove.mock.calls).toEqual([[new Set(["a", "b"])]])
  await act(retire)
  expect(custom.current).toBeNull()
  await scoped("Backspace", null, "0000:Backspace", { focusedTarget: target })
  expect(remove).toHaveBeenCalledTimes(1)
})
it("Delete/Backspace requests selected owner membership, while the remove button remains item-only", async () => {
  const ref = createRef<RN.View>(),
    remove = jest.fn(),
    owner = new Set<string | number>([0, "missing"])
  await fixture(
    { selectionMode: "multiple", selectedKeys: owner, onRemove: remove },
    <Tag ref={ref} id={0} testID="zero">
      Zero
    </Tag>,
  )
  await scoped("Delete", ref.current)
  await scoped("Backspace", ref.current)
  expect(remove.mock.calls.map(([keys]) => [...keys])).toEqual([
    [0, "missing"],
    [0, "missing"],
  ])
  expect(remove.mock.calls[0][0] === owner).toBe(false)
  expect([...owner]).toEqual([0, "missing"])
  expect(row("zero")).toBeOnTheScreen()
})
it("none mode and unselected items remove only their own typed key", async () => {
  const ref = createRef<RN.View>(),
    remove = jest.fn()
  await fixture(
    { selectionMode: "none", selectedKeys: [0, "missing"], onRemove: remove },
    <Tag ref={ref} id="" testID="empty">
      Empty
    </Tag>,
  )
  await scoped("Delete", ref.current)
  expect([...remove.mock.calls[0][0]]).toEqual([""])
})
it("navigates actual item refs with wrapping and disabled skipping without changing controlled membership", async () => {
  const a = createRef<RN.View>(),
    b = createRef<RN.View>(),
    c = createRef<RN.View>(),
    change = jest.fn()
  await fixture(
    { selectionMode: "multiple", selectedKeys: [0], selectionBehavior: "replace", onSelectionChange: change },
    <>
      <Tag ref={a} id={0}>
        Zero
      </Tag>
      <Tag ref={b} id="disabled" isDisabled>
        Disabled
      </Tag>
      <Tag ref={c} id="">
        Empty
      </Tag>
    </>,
  )
  await scoped("ArrowDown", a.current)
  expect(jest.mocked(Commands.requestKeyboardFocus).mock.calls.at(-1)?.[0] === c.current).toBe(true)
  expect([...change.mock.calls[0][0]]).toEqual([""])
  await scoped("ArrowDown", c.current)
  expect(jest.mocked(Commands.requestKeyboardFocus).mock.calls.at(-1)?.[0] === a.current).toBe(true)
  await scoped("Home", c.current)
  expect(jest.mocked(Commands.requestKeyboardFocus).mock.calls.at(-1)?.[0] === a.current).toBe(true)
  await scoped("End", a.current)
  expect(jest.mocked(Commands.requestKeyboardFocus).mock.calls.at(-1)?.[0] === c.current).toBe(true)
  expect(b.current).not.toBeNull()
})
it("does not capture ordinary letters and retains typed select-all/escape owner requests", async () => {
  const ref = createRef<RN.View>(),
    change = jest.fn()
  await fixture(
    { selectionMode: "multiple", selectedKeys: [], onSelectionChange: change },
    <Tag ref={ref} id={0}>
      Zero
    </Tag>,
  )
  const tokens = row("host").props.policies.flatMap((policy: { tokens: string[] }) => policy.tokens)
  expect(tokens).not.toContain("0000:a")
  expect(tokens).toContain("0010:ArrowRight")
  await scoped("a", ref.current, "0010:a", { ctrlKey: true })
  expect(change.mock.calls[0][0]).toBe("all")
  await scoped("Escape", ref.current)
  expect(change).toHaveBeenCalledTimes(1)
})
it("rejects key-up, cancelled removal and retired window epochs while admitting valid repeats", async () => {
  const ref = createRef<RN.View>(),
    remove = jest.fn()
  await fixture(
    { onRemove: remove },
    <Tag ref={ref} id={0}>
      Zero
    </Tag>,
  )
  await scoped("Delete", ref.current, "0000:Delete", { phase: "up" })
  await scoped("Delete", ref.current, "0000:Delete", { cancelled: true })
  await scoped("Delete", ref.current, "0000:Delete", { epoch: 0 })
  expect(remove).not.toHaveBeenCalled()
  await scoped("Delete", ref.current)
  expect(remove).toHaveBeenCalledTimes(1)
  await scoped("Delete", ref.current, "0000:Delete", { repeat: true })
  expect(remove).toHaveBeenCalledTimes(2)
})
it("preserves owner keys on Escape when selection mode is omitted and defaults to none", async () => {
  const ref = createRef<RN.View>(),
    change = jest.fn(),
    owner = new Set([0])
  await fixture(
    { selectedKeys: owner, onSelectionChange: change },
    <Tag ref={ref} id={0}>
      Zero
    </Tag>,
  )
  await scoped("Escape", ref.current)
  expect(change).not.toHaveBeenCalled()
  expect([...owner]).toEqual([0])
})

const navigationFixture = async (props: TNativeTagGroupProps = {}, links = false) => {
  const first = createRef<RN.View>(),
    middle = createRef<RN.View>(),
    last = createRef<RN.View>(),
    change = jest.fn(),
    owner = new Set<string | number>([0])
  const view = await fixture(
    {
      selectionMode: "multiple",
      selectionBehavior: "replace",
      selectedKeys: owner,
      onSelectionChange: change,
      ...props,
    },
    <>
      <Tag ref={first} id={0}>
        Alpha
      </Tag>
      <Tag id="disabled" isDisabled>
        Disabled
      </Tag>
      <Tag ref={middle} id="" href={links ? "https://example.test/beta" : undefined}>
        Beta
      </Tag>
      <Tag ref={last} id="tail" href={links ? "https://example.test/charlie" : undefined}>
        Charlie
      </Tag>
    </>,
  )
  return { first, middle, last, change, owner, view }
}
it.each([
  { key: "ArrowDown", target: "middle" },
  { key: "ArrowUp", target: "last" },
  { key: "ArrowRight", target: "middle" },
  { key: "ArrowLeft", target: "last" },
  { key: "Home", target: "first" },
  { key: "End", target: "last" },
  { key: "PageUp", target: "first" },
  { key: "PageDown", target: "last" },
] as const)("matches the web $key focus target through actual native refs", async ({ key, target }) => {
  const f = await navigationFixture()
  await scoped(key, f.first.current)
  expect(jest.mocked(Commands.requestKeyboardFocus).mock.calls.at(-1)?.[0] === f[target].current).toBe(true)
  expect([...f.owner]).toEqual([0])
})
it("matches source PageDown extension without inventing an anchor on the owner's plain set", async () => {
  const f = await navigationFixture()
  await scoped("PageDown", f.first.current, "1000:PageDown", { shiftKey: true })
  expect(f.change.mock.calls.map(([keys]) => [...keys])).toEqual([[0, "tail"]])
  expect(jest.mocked(Commands.requestKeyboardFocus).mock.calls.at(-1)?.[0] === f.last.current).toBe(true)
  expect([...f.owner]).toEqual([0])
})
it.each([
  { behavior: "toggle", modifiers: { shiftKey: true }, expected: [0, ""] },
  { behavior: "replace", modifiers: { shiftKey: true }, expected: [0, ""] },
  { behavior: "replace", modifiers: { ctrlKey: true }, expected: null },
  { behavior: "replace", modifiers: { altKey: true }, expected: [""] },
  { behavior: "toggle", modifiers: {}, expected: null },
] as const)("matches web ArrowDown selection under $behavior/$modifiers", async ({ behavior, modifiers, expected }) => {
  const f = await navigationFixture({ selectionBehavior: behavior })
  const data = { key: "ArrowDown", shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, ...modifiers }
  await scoped(data.key, f.first.current, nativeKeyToken(data), data)
  expect(jest.mocked(Commands.requestKeyboardFocus).mock.calls.at(-1)?.[0] === f.middle.current).toBe(true)
  expect(f.change.mock.calls.map(([keys]) => [...keys])).toEqual(expected ? [expected] : [])
  expect([...f.owner]).toEqual([0])
})
it.each([
  { modifiers: { shiftKey: true }, expected: ["tail"] },
  { modifiers: { ctrlKey: true, shiftKey: true }, expected: [0, "tail"] },
  { modifiers: { ctrlKey: true }, expected: ["tail"] },
] as const)("matches distinct web End selection under $modifiers", async ({ modifiers, expected }) => {
  const f = await navigationFixture()
  const data = { key: "End", shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, ...modifiers }
  await scoped(data.key, f.first.current, nativeKeyToken(data), data)
  expect(f.change.mock.calls.map(([keys]) => [...keys])).toEqual([expected])
  expect(jest.mocked(Commands.requestKeyboardFocus).mock.calls.at(-1)?.[0] === f.last.current).toBe(true)
  expect([...f.owner]).toEqual([0])
})
it("preserves arrow link override while Home/End follows the selection manager", async () => {
  const f = await navigationFixture({}, true)
  await scoped("ArrowDown", f.first.current)
  expect(jest.mocked(Commands.requestKeyboardFocus).mock.calls.at(-1)?.[0] === f.middle.current).toBe(true)
  expect(f.change).not.toHaveBeenCalled()
  await scoped("End", f.middle.current)
  expect([...f.change.mock.calls[0][0]]).toEqual(["tail"])
  expect([...f.owner]).toEqual([0])
})
it("extends an echoed anchor across enabled rows without changing the owner request", async () => {
  const initial = await navigationFixture()
  await scoped("End", initial.first.current)
  const owner = initial.change.mock.calls[0][0]
  await initial.view.unmount()
  const f = await navigationFixture({ selectedKeys: owner })
  await scoped("Home", f.last.current, "1010:Home", { ctrlKey: true, shiftKey: true })
  expect([...f.change.mock.calls[0][0]]).toEqual([0, "", "tail"])
  expect(f.change.mock.calls[0][0].anchorKey).toBe("tail")
  expect(f.change.mock.calls[0][0].currentKey).toBe(0)
  expect([...owner]).toEqual(["tail"])
  expect(owner.currentKey).toBe("tail")
})

it.each([
  { key: "ArrowRight", target: "last" },
  { key: "ArrowLeft", target: "middle" },
] as const)("matches actual web RTL $key ordering", async ({ key, target }) => {
  jest.replaceProperty(RN.I18nManager, "isRTL", true)
  const f = await navigationFixture()
  await scoped(key, f.first.current)
  expect(jest.mocked(Commands.requestKeyboardFocus).mock.calls.at(-1)?.[0] === f[target].current).toBe(true)
})
it.each(["all", new Set([0, "", "tail"])] as const)(
  "Select All never clears the already-complete %s owner",
  async (selectedKeys) => {
    const f = await navigationFixture({ selectedKeys })
    await scoped("a", f.first.current, "0010:a", { ctrlKey: true })
    expect(f.change).not.toHaveBeenCalled()
  },
)
it("repeats Select All requests under owner veto without turning the request into an empty set", async () => {
  const f = await navigationFixture()
  await scoped("a", f.first.current, "0010:a", { ctrlKey: true })
  await scoped("a", f.first.current, "0010:a", { ctrlKey: true, repeat: true })
  expect(f.change.mock.calls.map(([keys]) => keys)).toEqual(["all", "all"])
  expect([...f.owner]).toEqual([0])
})
