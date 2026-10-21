import "../../../collection/__tests__/nativeReceipts"

import { act as rendererAct, fireEvent, screen } from "@testing-library/react-native"
import { createRef, Fragment, useContext, useState, type ReactNode } from "react"
import * as RN from "react-native"

import {
  actWithNativeCollections as act,
  renderWithNativeCollections as render,
} from "../../../collection/__tests__/nativeReceipts"
import { NATIVE_DEFAULT_SLOT, NativeSelectableCollectionContext } from "../../../collection/context"
import {
  DefaultNativeCollectionRenderer,
  NativeCollectionRendererContext,
  type TNativeCollectionRootProps,
} from "../../../collection/renderer"
import { NativeFocusHost } from "../../../input/NativeFocusView"
import { Commands } from "../../../input/specs/CUIFocusViewNativeComponent"
import { NativeFloatingLayerHost } from "../../../overlays/floating/NativeFloatingLayerHost"
import { NativeOverlayProvider } from "../../../overlays/NativeOverlayProvider"
import { NativeThemeProvider } from "../../../theme"
import { resolveNativeTheme } from "../../../theme/defaults"
import { Button } from "../../Button/Button"
import { encodeCollectionKey } from "../../collection"
import { Text } from "../../Text/Text"
import { MenuText, MenuKeyboardShortcut, NativeMenuSelectionIndicatorContext } from "../content"
import {
  NativeMenuContext,
  NativeMenuListContext,
  NativeMenuPointerObservationContext,
  NativeMenuStateContext,
} from "../context"
import { Menu, NativeMenuTrigger } from "../Menu"
import { MenuHeader } from "../MenuHeader"
import { MenuItem } from "../MenuItem"
import { MenuSection } from "../MenuSection"
import { MenuSeparator } from "../MenuSeparator"
import { SubmenuTrigger } from "../SubmenuTrigger"
import type { TNativeMenuProps } from "../types"

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: jest.requireActual("react-native").View,
  SafeAreaView: jest.requireActual("react-native").View,
}))
const rerender = (...args: Parameters<typeof screen.rerender>) => act(() => screen.rerender(...args))
const hidden = { includeHiddenElements: true }
const frames = new Map<number, Parameters<typeof requestAnimationFrame>[0]>()
let frameId = 0
beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers()
  frames.clear()
  jest.spyOn(RN.AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
    const id = ++frameId
    frames.set(id, callback)
    return id
  })
  jest.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => {
    if (id != null) frames.delete(id)
  })
  jest.spyOn(Commands, "requestKeyboardFocus").mockImplementation(() => {})
  jest.spyOn(RN.Linking, "openURL").mockResolvedValue(undefined)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})
const tick = async () =>
  act(() => {
    const pending = [...frames.values()]
    frames.clear()
    pending.forEach((callback) => callback(0))
  })
const event = () => {
  let prevented = false
  return {
    target: 17,
    currentTarget: 17,
    nativeEvent: { target: 17, timestamp: 0 },
    persist: jest.fn(),
    preventDefault: () => {
      prevented = true
    },
    isDefaultPrevented: () => prevented,
  }
}
const row = (id: string) => screen.getByTestId(id, hidden)
const sample = () => (
  <>
    <MenuItem id="profile" testID="profile">
      Profile
    </MenuItem>
    <MenuItem id="gallery" testID="gallery">
      Gallery
    </MenuItem>
    <MenuSeparator />
    <MenuItem id="remove" testID="remove" variant="destructive">
      Remove
    </MenuItem>
  </>
)
const fixture = (
  initial: Partial<TNativeMenuProps> = {},
  children: ReactNode = sample(),
  renderer = DefaultNativeCollectionRenderer,
  inheritedChildren = false,
) => {
  const root = createRef<RN.View>(),
    host = createRef<RN.View>(),
    anchor = createRef<RN.View>()
  const action = jest.fn(),
    close = jest.fn()
  const node = (props: Partial<TNativeMenuProps> = initial, content = children, mode: "light" | "dark" = "light") => (
    <NativeThemeProvider mode={mode}>
      <NativeCollectionRendererContext.Provider value={renderer}>
        <NativeOverlayProvider>
          <NativeFloatingLayerHost ref={host} testID="host">
            <RN.View ref={anchor} />
            <Menu
              ref={root}
              triggerRef={anchor}
              isOpen
              onAction={action}
              onOpenChange={close}
              {...props}
              children={inheritedChildren ? undefined : content}
            />
          </NativeFloatingLayerHost>
        </NativeOverlayProvider>
      </NativeCollectionRendererContext.Provider>
    </NativeThemeProvider>
  )
  const ready = async (flushBeforeAcknowledgment = false, windowId = "menu-window") => {
    const measure = (view: RN.View, value: [number, number, number, number]) =>
      Object.defineProperty(view, "measureInWindow", {
        configurable: true,
        value: jest.fn((callback: (x: number, y: number, width: number, height: number) => void) => callback(...value)),
      })
    measure(host.current!, [0, 0, 360, 600])
    measure(anchor.current!, [100, 100, 40, 40])
    measure(root.current!, [0, 0, 200, 180])
    await fireEvent(row("host"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 600 } } })
    await fireEvent(row("menu"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 200, height: 180 } } })
    await fireEvent(row("menu-list"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 200, height: 180 } } })
    for (const ready of [false, true]) {
      const native = row("host").props
      await act(() =>
        native.onNativeScopeStatus({
          nativeEvent: {
            ownerId: native.ownerId,
            windowId,
            epoch: 1,
            policyRevision: native.policyRevision,
            ready,
            windowActive: true,
          },
        }),
      )
      if (!ready && flushBeforeAcknowledgment) {
        for (let i = 0; i < 3; i++) await tick()
        jest.mocked(Commands.requestKeyboardFocus).mockClear()
      }
    }
    for (let i = 0; i < 3; i++) await tick()
  }
  return { node, ready, root, action, close }
}
const press = async (id: string) => {
  const native = row(id)
  const e = {
    ...event(),
    nativeEvent: { target: 17, timestamp: 0, identifier: 0, pageX: 0, pageY: 0, locationX: 0, locationY: 0 },
  }
  await act(() => native.props.onResponderGrant(e))
  await act(() => native.props.onResponderRelease(e))
}

it("applies full list context to dynamic authoring, original values and default owner selection", async () => {
  const values = [
    { id: 0, label: "Zero" },
    { id: "0", label: "String zero" },
  ]
  const items = (function* () {
    yield* values
  })()
  const change = jest.fn(),
    listRef = createRef<RN.View>()
  let state!: NonNullable<React.ContextType<typeof NativeMenuStateContext>>
  const Root = (props: TNativeCollectionRootProps) => {
    state = useContext(NativeMenuStateContext)!
    return <DefaultNativeCollectionRenderer.CollectionRoot {...props} />
  }
  const f = fixture({}, null, { ...DefaultNativeCollectionRenderer, CollectionRoot: Root }, true)
  await render(
    <NativeMenuListContext.Provider
      value={{
        ref: listRef,
        items,
        children: (value) => {
          const item = value as (typeof values)[number]
          return (
            <MenuItem id={item.id} testID={typeof item.id === "number" ? "numeric" : "string"}>
              {item.label}
            </MenuItem>
          )
        },
        selectionMode: "multiple",
        defaultSelectedKeys: [0],
        onSelectionChange: change,
        shouldCloseOnSelect: false,
      }}
    >
      {f.node()}
    </NativeMenuListContext.Provider>,
  )
  await f.ready()
  expect(state.collection.getItem(0)?.value).toBe(values[0])
  expect(state.collection.getItem("0")?.value).toBe(values[1])
  expect(listRef.current).not.toBe(f.root.current)
  expect(row("numeric").props.accessibilityState.checked).toBe(true)
  await press("string")
  expect([...change.mock.calls[0][0]]).toEqual([0, "0"])
  expect(row("string").props.accessibilityState.checked).toBe(true)
  expect(state.collection.size).toBe(2)
  expect(f.close).not.toHaveBeenCalled()
})

it("separates named/null list slots and actual inner styles/refs from the outer surface", async () => {
  const list = createRef<RN.View>(),
    renderHost = jest.fn((props: React.ComponentProps<typeof NativeFocusHost>, _state: { isEmpty: boolean }) => (
      <NativeFocusHost {...props} />
    ))
  const f = fixture({ customMenuStyles: { padding: 7, fontSize: 21 } })
  const node = (slot?: string | null) => (
    <NativeMenuListContext.Provider
      value={{
        slots: {
          [NATIVE_DEFAULT_SLOT]: { ref: list, accessibilityLabel: "Default menu", style: { padding: 3, fontSize: 17 } },
          named: {
            ref: list,
            accessibilityLabel: "Named menu",
            render: renderHost,
            style: { padding: 5, fontSize: 19 },
          },
        },
      }}
    >
      {f.node({ menuListSlot: slot, customMenuStyles: { padding: 7, fontSize: 21 } })}
    </NativeMenuListContext.Provider>
  )
  await render(node())
  expect(row("menu-list").props.accessibilityLabel).toBe("Default menu")
  expect(RN.StyleSheet.flatten(row("menu-list").props.style).padding).toBe(7)
  expect(row("menu-scroll").props.contentContainerStyle.padding).toBeUndefined()
  expect(list.current).not.toBe(f.root.current)
  await rerender(node("named"))
  expect(renderHost).toHaveBeenCalled()
  expect(row("menu-list").props.accessibilityLabel).toBe("Named menu")
  expect(renderHost.mock.calls.at(-1)?.[1]).toEqual({ isEmpty: false })
  await rerender(node(null))
  expect(row("menu-list").props.accessibilityLabel).toBeUndefined()
  expect(list.current).toBeNull()
})

it("keeps item text/description/shortcut refs and selection context attached to actual visible content", async () => {
  const label = createRef<RN.Text>(),
    description = createRef<RN.Text>(),
    shortcut = createRef<RN.Text>()
  let indicator = false
  const Indicator = () => {
    indicator = useContext(NativeMenuSelectionIndicatorContext).isSelected
    return null
  }
  const f = fixture(
    { selectionMode: "multiple", selectedKeys: [0] },
    <MenuItem id={0} testID="item" textValue="Canonical label">
      <MenuText ref={label} testID="label" nativeID="owner-label">
        Original label
      </MenuText>
      <MenuText ref={description} slot="description" testID="description">
        Original description
      </MenuText>
      <MenuKeyboardShortcut ref={shortcut} testID="shortcut">
        ⌘K
      </MenuKeyboardShortcut>
      <Indicator />
    </MenuItem>,
  )
  await render(f.node())
  expect(indicator).toBe(true)
  expect(row("item").props.nativeLabelledBy).toEqual([row("label").props.nativeID])
  expect(row("item").props.nativeDescribedBy).toEqual([
    row("description").props.nativeID,
    row("shortcut").props.nativeID,
  ])
  expect(label.current).not.toBeNull()
  expect(description.current).not.toBeNull()
  expect(shortcut.current).not.toBeNull()
  expect(row("description").props.accessible).toBe(false)
})

it("updates an opaque text slot ID without replacing its original native ref or fabricating cleanup", async () => {
  const targets: (RN.Text | null)[] = [],
    cleanup = jest.fn()
  const ref = (target: RN.Text | null) => {
    targets.push(target)
    return cleanup
  }
  let changeID!: () => void
  const Opaque = () => {
    const [id, setID] = useState("label-one")
    changeID = () => setID("label-two")
    return (
      <MenuText ref={ref} nativeID={id}>
        Original
      </MenuText>
    )
  }
  const f = fixture(
    {},
    <MenuItem id="item" testID="item" textValue="Original">
      <Opaque />
    </MenuItem>,
  )
  await render(f.node())
  const original = targets[0]
  expect(original).not.toBeNull()
  expect(row("item").props.nativeLabelledBy).toEqual(["label-one"])
  await act(changeID)
  expect(row("item").props.nativeLabelledBy).toEqual(["label-two"])
  expect(targets).toEqual([original])
  expect(cleanup).not.toHaveBeenCalled()
})

it("filters the complete collection and clears inherited selectable context below the actual list", async () => {
  let inherited: React.ContextType<typeof NativeSelectableCollectionContext> = undefined
  const Probe = () => {
    inherited = useContext(NativeSelectableCollectionContext)
    return null
  }
  const f = fixture(
    {},
    <>
      <MenuItem id="a" testID="a" textValue="Alpha">
        Alpha
      </MenuItem>
      <MenuItem id="b" testID="b" textValue="Beta">
        Beta
        <Probe />
      </MenuItem>
    </>,
  )
  await render(
    <NativeSelectableCollectionContext.Provider value={{ filter: (text) => text === "Beta" }}>
      {f.node()}
    </NativeSelectableCollectionContext.Provider>,
  )
  expect(screen.queryByTestId("a", hidden)).toBeNull()
  expect(row("b")).toBeDefined()
  expect(inherited).toBeNull()
})

it("renders the owned empty state under a virtualized renderer without inventing an item", async () => {
  const Root = jest.fn((props: TNativeCollectionRootProps) => (
    <DefaultNativeCollectionRenderer.CollectionRoot {...props} />
  ))
  const f = fixture({}, null, { ...DefaultNativeCollectionRenderer, isVirtualized: true, CollectionRoot: Root })
  await render(
    <NativeMenuListContext.Provider value={{ renderEmptyState: () => <Text testID="empty-copy">No actions</Text> }}>
      {f.node()}
    </NativeMenuListContext.Provider>,
  )
  expect(row("empty-copy")).toBeDefined()
  expect(row("menu-empty-state").props.role).toBe("menuitem")
  expect(row("menu-list").props.accessible).toBe(false)
  expect(Root).not.toHaveBeenCalled()
  expect(f.action).not.toHaveBeenCalled()
})

it("keeps selection-only disabled items navigable and honors an explicit non-wrapping list", async () => {
  const a = createRef<RN.View>(),
    b = createRef<RN.View>()
  const f = fixture(
    {},
    <>
      <MenuItem ref={a} id="a">
        Alpha
      </MenuItem>
      <MenuItem ref={b} id="b" testID="b">
        Beta
      </MenuItem>
    </>,
  )
  await render(
    <NativeMenuListContext.Provider
      value={{ disabledKeys: ["b"], disabledBehavior: "selection", shouldFocusWrap: false }}
    >
      {f.node()}
    </NativeMenuListContext.Provider>,
  )
  await f.ready()
  await scopedKey("ArrowDown", a.current)
  expect(jest.mocked(Commands.requestKeyboardFocus).mock.calls.at(-1)?.[0]).toBe(b.current)
  expect(row("b").props.accessibilityState.disabled).toBe(false)
  jest.mocked(Commands.requestKeyboardFocus).mockClear()
  await scopedKey("ArrowDown", b.current)
  expect(jest.mocked(Commands.requestKeyboardFocus).mock.calls.at(-1)?.[0]).toBe(b.current)
})

it("keeps actual focus on the virtual-focus list while logical navigation advances without item callbacks", async () => {
  const list = createRef<RN.View>(),
    first = createRef<RN.View>(),
    second = createRef<RN.View>(),
    itemFocus = jest.fn()
  let state!: NonNullable<React.ContextType<typeof NativeMenuStateContext>>
  const Root = (props: TNativeCollectionRootProps) => {
    state = useContext(NativeMenuStateContext)!
    return <DefaultNativeCollectionRenderer.CollectionRoot {...props} />
  }
  const f = fixture(
    {},
    <>
      <MenuItem ref={first} id="a" testID="a" onFocus={itemFocus}>
        Alpha
      </MenuItem>
      <MenuItem ref={second} id="b" testID="b" onFocus={itemFocus}>
        Beta
      </MenuItem>
    </>,
    { ...DefaultNativeCollectionRenderer, CollectionRoot: Root },
  )
  await render(
    <NativeMenuListContext.Provider value={{ ref: list, shouldUseVirtualFocus: true }}>
      {f.node()}
    </NativeMenuListContext.Provider>,
  )
  await f.ready()
  expect(jest.mocked(Commands.requestKeyboardFocus).mock.calls.at(-1)?.[0]).toBe(list.current)
  const native = row("menu-list").props
  await act(() =>
    native.onNativeFocusChange({
      nativeEvent: {
        ownerId: native.ownerId,
        target: RN.findNodeHandle(list.current),
        isFocused: true,
        isFocusVisible: true,
      },
    }),
  )
  expect(state.selectionManager.focusedKey).toBe("a")
  jest.mocked(Commands.requestKeyboardFocus).mockClear()
  await scopedKey("ArrowDown", list.current)
  expect(state.selectionManager.focusedKey).toBe("b")
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
  expect(itemFocus).not.toHaveBeenCalled()
  expect(row("b").props.keyboardFocusable).toBe(false)
  expect(RN.StyleSheet.flatten(row("b").props.style).outlineWidth).toBe(1.5)
})

it("retains original list key vetoes before admitted navigation", async () => {
  const ref = createRef<RN.View>(),
    onKeyDown = jest.fn((event) => event.preventDefault())
  const f = fixture(
    {},
    <>
      <MenuItem id="a" ref={ref}>
        Alpha
      </MenuItem>
      <MenuItem id="b">Beta</MenuItem>
    </>,
  )
  await render(<NativeMenuListContext.Provider value={{ onKeyDown }}>{f.node()}</NativeMenuListContext.Provider>)
  await f.ready()
  jest.mocked(Commands.requestKeyboardFocus).mockClear()
  await scopedKey("ArrowDown", ref.current)
  expect(onKeyDown).toHaveBeenCalledTimes(1)
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
})

it("resets parent list defaults at a submenu boundary while retaining explicit child authoring", async () => {
  const f = fixture(
    {},
    <SubmenuTrigger>
      <MenuItem id="trigger" testID="trigger">
        More
      </MenuItem>
      <Menu>
        <MenuItem id="child" testID="child">
          Child
        </MenuItem>
      </Menu>
    </SubmenuTrigger>,
  )
  await render(
    <NativeMenuListContext.Provider value={{ selectionMode: "multiple", disabledKeys: ["child"] }}>
      {f.node()}
    </NativeMenuListContext.Provider>,
  )
  await f.ready()
  await rawKey("trigger", "Enter")
  expect(row("child").props.role).toBe("menuitem")
  expect(row("child").props.accessibilityState.disabled).toBe(false)
})

it("keeps submenu children out of the parent collection and opens without selecting or firing trigger actions", async () => {
  const selected = new Set(["other"]),
    selection = jest.fn(),
    triggerAction = jest.fn()
  const trigger = createRef<RN.View>()
  let parent!: NonNullable<React.ContextType<typeof NativeMenuStateContext>>
  const Root = (props: TNativeCollectionRootProps) => {
    const state = useContext(NativeMenuStateContext)!
    if (state.collection.getItem("trigger")) parent = state
    return <DefaultNativeCollectionRenderer.CollectionRoot {...props} />
  }
  const f = fixture(
    { selectionMode: "multiple", selectedKeys: selected, onSelectionChange: selection },
    <>
      <SubmenuTrigger ref={trigger}>
        <MenuItem id="trigger" testID="trigger" onAction={triggerAction}>
          More
        </MenuItem>
        <Menu testID="submenu" menuAriaLabel="More actions">
          <MenuItem id="child" testID="child">
            Child
          </MenuItem>
        </Menu>
      </SubmenuTrigger>
      <MenuItem id="other">Other</MenuItem>
    </>,
    { ...DefaultNativeCollectionRenderer, CollectionRoot: Root },
  )
  await render(f.node())
  await f.ready()
  expect(parent.collection.getItem("child")).toBeNull()
  expect(parent.collection.size).toBe(2)
  expect(trigger.current).not.toBeNull()
  expect(row("trigger").props.role).toBe("menuitem")
  expect(row("trigger").props.accessibilityState.expanded).toBe(false)
  await rawKey("trigger", "Enter")
  expect(row("trigger").props.accessibilityState.expanded).toBe(true)
  expect(row("child")).toBeDefined()
  expect(selection).not.toHaveBeenCalled()
  expect(triggerAction).not.toHaveBeenCalled()
  expect(f.action).not.toHaveBeenCalled()
  expect(f.close).not.toHaveBeenCalled()
  expect([...selected]).toEqual(["other"])
  const lists = screen.getAllByTestId("menu-list", hidden)
  expect(lists[1].props.nativeLabelledBy).toEqual([row("trigger").props.nativeID])
})

it("cancels delayed submenu hover on leave and closes it when actual parent focus moves", async () => {
  const trigger = createRef<RN.View>(),
    other = createRef<RN.View>()
  const f = fixture(
    {},
    <>
      <SubmenuTrigger ref={trigger} delay={200}>
        <MenuItem id="trigger" testID="trigger">
          More
        </MenuItem>
        <Menu testID="submenu">
          <MenuItem id="child" testID="child">
            Child
          </MenuItem>
        </Menu>
      </SubmenuTrigger>
      <MenuItem ref={other} id="other" testID="other">
        Other
      </MenuItem>
    </>,
  )
  await render(f.node())
  await f.ready()
  await act(() =>
    row("trigger").props.onNativeFocusChange({
      nativeEvent: {
        ownerId: row("trigger").props.ownerId,
        target: RN.findNodeHandle(trigger.current),
        isFocused: true,
        isFocusVisible: true,
      },
    }),
  )
  await rawKey("trigger", "Enter")
  await act(() =>
    row("other").props.onNativeFocusChange({
      nativeEvent: {
        ownerId: row("other").props.ownerId,
        target: RN.findNodeHandle(other.current),
        isFocused: true,
        isFocusVisible: false,
      },
    }),
  )
  expect(row("trigger").props.accessibilityState.expanded).toBe(false)
  const hoverEvent = {
    ...event(),
    nativeEvent: { target: RN.findNodeHandle(trigger.current), timestamp: 0, pointerType: "mouse" },
  }
  await act(() => row("trigger").props.onPointerEnter(hoverEvent))
  await act(() => jest.advanceTimersByTime(199))
  expect(row("trigger").props.accessibilityState.expanded).toBe(false)
  await act(() => row("trigger").props.onPointerLeave(hoverEvent))
  await act(() => jest.advanceTimersByTime(1))
  expect(row("trigger").props.accessibilityState.expanded).toBe(false)
  await act(() => row("trigger").props.onPointerEnter(hoverEvent))
  await act(() => {
    jest.advanceTimersByTime(200)
    row("trigger").props.onPointerLeave(hoverEvent)
  })
  expect(row("trigger").props.accessibilityState.expanded).toBe(false)
  await act(() => row("trigger").props.onPointerEnter(hoverEvent))
  await act(() => jest.advanceTimersByTime(200))
  expect(row("trigger").props.accessibilityState.expanded).toBe(true)
})

it("closes the complete submenu stack after a child action while a controlled root owner vetoes closing", async () => {
  const childSurface = createRef<RN.View>(),
    trigger = createRef<RN.View>(),
    childAction = jest.fn()
  const f = fixture(
    {},
    <SubmenuTrigger ref={trigger}>
      <MenuItem id="trigger" testID="trigger">
        More
      </MenuItem>
      <Menu ref={childSurface} testID="submenu" onAction={childAction} menuAriaLabel="Child actions">
        <MenuItem id="child" testID="child">
          Child
        </MenuItem>
      </Menu>
    </SubmenuTrigger>,
  )
  await render(f.node())
  await f.ready()
  Object.defineProperty(trigger.current!, "measureInWindow", {
    configurable: true,
    value: (callback: (x: number, y: number, width: number, height: number) => void) => callback(100, 100, 40, 40),
  })
  await rawKey("trigger", "Enter")
  Object.defineProperty(childSurface.current!, "measureInWindow", {
    configurable: true,
    value: (callback: (x: number, y: number, width: number, height: number) => void) => callback(130, 100, 150, 100),
  })
  await fireEvent(row("submenu"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 150, height: 100 } } })
  await fireEvent(screen.getAllByTestId("menu-list", hidden)[1], "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 150, height: 100 } },
  })
  const host = row("host").props
  await act(() =>
    host.onNativeScopeStatus({
      nativeEvent: {
        ownerId: host.ownerId,
        windowId: "menu-window",
        epoch: 1,
        policyRevision: host.policyRevision,
        ready: true,
        windowActive: true,
      },
    }),
  )
  for (let i = 0; i < 3; i++) await tick()
  await press("child")
  expect(childAction.mock.calls).toEqual([["child"]])
  expect(f.close.mock.calls).toEqual([[false]])
  expect(f.action).not.toHaveBeenCalled()
  expect(row("trigger").props.accessibilityState.expanded).toBe(false)
  expect(row("menu")).toBeDefined()
})

it.each([
  ["ltr", "ArrowRight", "ArrowLeft"],
  ["rtl", "ArrowLeft", "ArrowRight"],
] as const)(
  "opens the submenu on the actual %s forward key while retaining caller veto",
  async (direction, forward, backward) => {
    let veto = true
    const f = fixture(
      { direction },
      <SubmenuTrigger>
        <MenuItem
          id="trigger"
          testID="trigger"
          onKeyDown={(event) => {
            if (veto) event.preventDefault()
          }}
        >
          More
        </MenuItem>
        <Menu>
          <MenuItem id="child">Child</MenuItem>
        </Menu>
      </SubmenuTrigger>,
    )
    await render(f.node())
    await f.ready()
    await rawKey("trigger", forward)
    expect(row("trigger").props.accessibilityState.expanded).toBe(false)
    veto = false
    await rawKey("trigger", backward)
    expect(row("trigger").props.accessibilityState.expanded).toBe(false)
    await rawKey("trigger", forward)
    expect(row("trigger").props.accessibilityState.expanded).toBe(true)
    expect(f.action).not.toHaveBeenCalled()
  },
)

it("keeps section owner selection independent while forwarding focus through the full parent state", async () => {
  const sectionChange = jest.fn(),
    owner = new Set<string | number>([0]),
    header = createRef<RN.View>(),
    section = createRef<RN.View>(),
    item = createRef<RN.View>()
  let state!: NonNullable<React.ContextType<typeof NativeMenuStateContext>>
  const Root = (props: TNativeCollectionRootProps) => {
    state = useContext(NativeMenuStateContext)!
    return <DefaultNativeCollectionRenderer.CollectionRoot {...props} />
  }
  const f = fixture(
    { selectionMode: "none" },
    <>
      <MenuSection
        id="section"
        testID="section"
        ref={section}
        selectionMode="multiple"
        selectedKeys={owner}
        onSelectionChange={sectionChange}
        shouldCloseOnSelect={false}
      >
        <MenuHeader ref={header} nativeID="section-name" testID="section-name">
          Section name
        </MenuHeader>
        <MenuItem id={0} testID="section-number" ref={item}>
          Zero
        </MenuItem>
        <MenuItem id="0" testID="section-string">
          String zero
        </MenuItem>
      </MenuSection>
      <MenuItem id="outside" testID="outside">
        Outside
      </MenuItem>
    </>,
    { ...DefaultNativeCollectionRenderer, CollectionRoot: Root },
  )
  await render(f.node())
  await f.ready()
  expect(header.current).not.toBeNull()
  expect(section.current).not.toBeNull()
  expect(item.current).not.toBeNull()
  expect(state.collection.getItem(0)?.parentKey).toBe("section")
  expect(state.collection.size).toBe(3)
  expect(row("section").props.nativeLabelledBy).toEqual(["section-name"])
  expect(row("section-number").props.role).toBe("checkbox")
  expect(row("section-number").props.accessibilityState.checked).toBe(true)
  expect(row("outside").props.role).toBe("menuitem")
  const initial = row("section-number").props
  await act(() =>
    initial.onNativeFocusChange({
      nativeEvent: { ownerId: initial.ownerId, target: 17, isFocused: true, isFocusVisible: true, timestamp: 0 },
    }),
  )
  await press("section-string")
  await press("section-string")
  expect(sectionChange).toHaveBeenCalledTimes(2)
  expect([...sectionChange.mock.calls[0][0]]).toEqual([0, "0"])
  expect([...owner]).toEqual([0])
  expect(row("section-string").props.accessibilityState.checked).toBe(false)
  expect(f.close).not.toHaveBeenCalled()
  const native = row("section-string").props
  await act(() =>
    native.onNativeFocusChange({
      nativeEvent: { ownerId: native.ownerId, target: 17, isFocused: true, isFocusVisible: true, timestamp: 1 },
    }),
  )
  expect(state.selectionManager.focusedKey).toBe("0")
})

it("inherits section selection and close defaults with item override and dynamic original values", async () => {
  const values = [
    { id: "one", label: "One" },
    { id: "two", label: "Two" },
  ]
  const change = jest.fn()
  let state!: NonNullable<React.ContextType<typeof NativeMenuStateContext>>
  const Root = (props: TNativeCollectionRootProps) => {
    state = useContext(NativeMenuStateContext)!
    return <DefaultNativeCollectionRenderer.CollectionRoot {...props} />
  }
  const f = fixture(
    { selectionMode: "multiple", onSelectionChange: change, shouldCloseOnSelect: false },
    <MenuSection id="dynamic" items={values} style={{ color: "red", fontSize: 19 }}>
      {(value) => (
        <MenuItem id={value.id} testID={value.id} shouldCloseOnSelect={value.id === "two" ? true : undefined}>
          {value.label}
        </MenuItem>
      )}
    </MenuSection>,
    { ...DefaultNativeCollectionRenderer, CollectionRoot: Root },
  )
  await render(f.node())
  await f.ready()
  expect(state.collection.getItem("one")?.value === values[0]).toBe(true)
  expect(screen.getByText("One", hidden)).toHaveStyle({ color: "red", fontSize: 19 })
  await press("one")
  expect([...change.mock.calls[0][0]]).toEqual(["one"])
  expect(f.close).not.toHaveBeenCalled()
  await press("two")
  expect(f.close).toHaveBeenLastCalledWith(false)
})

it("retires and restores the actual section header relationship without replacing an item ref", async () => {
  const header = createRef<RN.View>(),
    item = createRef<RN.View>()
  let setHeader!: (visible: boolean) => void
  const Opaque = () => {
    const [visible, setVisible] = useState(true)
    setHeader = setVisible
    return (
      <MenuSection id="section" testID="section">
        {visible ? (
          <MenuHeader ref={header} nativeID="header-name">
            Header
          </MenuHeader>
        ) : null}
        <MenuItem id="item" ref={item}>
          Item
        </MenuItem>
      </MenuSection>
    )
  }
  const f = fixture({}, <Opaque />)
  await render(f.node())
  const original = item.current
  expect(header.current).not.toBeNull()
  expect(row("section").props.nativeLabelledBy).toEqual(["header-name"])
  await act(() => setHeader(false))
  expect(header.current).toBeNull()
  expect(row("section").props.nativeLabelledBy).toBeUndefined()
  expect(item.current === original).toBe(true)
  await act(() => setHeader(true))
  expect(header.current).not.toBeNull()
  expect(row("section").props.nativeLabelledBy).toEqual(["header-name"])
  expect(item.current === original).toBe(true)
})

it("merges default, named and null Menu slots with actual root refs and caller precedence", async () => {
  const inherited = createRef<RN.View>()
  const f = fixture({ slot: "named", customStyles: { opacity: 0.8 } })
  const node = (slot: string | null | undefined) => (
    <NativeMenuContext.Provider
      value={{
        slots: {
          [NATIVE_DEFAULT_SLOT]: { menuAriaLabel: "Default menu" },
          named: { ref: inherited, menuAriaLabel: "Named menu", customStyles: { opacity: 0.5 } },
        },
      }}
    >
      {f.node({ slot, customStyles: { opacity: 0.8 } })}
    </NativeMenuContext.Provider>
  )
  await render(node("named"))
  expect(inherited.current === f.root.current).toBe(true)
  expect(row("menu-list").props.accessibilityLabel).toBe("Named menu")
  expect(RN.StyleSheet.flatten(row("menu").props.style).opacity).toBe(0.8)
  await rerender(node(undefined))
  expect(row("menu-list").props.accessibilityLabel).toBe("Default menu")
  await rerender(node(null))
  expect(row("menu-list").props.accessibilityLabel).toBeUndefined()
})

it("CAP.menu.001/.002 renders the actual menu/list/item/separator structure with the native root ref", async () => {
  const f = fixture()
  await render(f.node())
  expect(f.root.current).not.toBeNull()
  expect(row("menu-list").props.role).toBe("menu")
  expect(screen.getAllByRole("menuitem", hidden)).toHaveLength(3)
  expect(row("menu-separator").props.role).toBe("separator")
  expect(row("menu").props.role).toBeUndefined()
})
it("retries initial item focus after a delayed native policy acknowledgment", async () => {
  const first = createRef<RN.View>()
  const f = fixture(
    {},
    <MenuItem id={0} ref={first} testID="first">
      First
    </MenuItem>,
  )
  await render(f.node())
  await f.ready(true)
  expect(Commands.requestKeyboardFocus).toHaveBeenCalledWith(first.current, row("first").props.ownerId)
})

it("shares the actual default first-item target with the floating surface startup focus", async () => {
  const first = createRef<RN.View>()
  const f = fixture(
    {},
    <MenuItem id={0} ref={first} testID="first">
      Zero
    </MenuItem>,
  )
  await render(f.node())
  await f.ready()
  const last = jest.mocked(Commands.requestKeyboardFocus).mock.calls.at(-1)
  expect(last?.[0] === first.current).toBe(true)
})

it("preserves explicit initial-focus ownership without briefly requesting the default item", async () => {
  const first = createRef<RN.View>(),
    authored = createRef<RN.View>()
  const f = fixture(
    { initialFocusRef: authored },
    <>
      <MenuItem id={0} ref={first}>
        Zero
      </MenuItem>
      <MenuItem id="" ref={authored}>
        Authored
      </MenuItem>
    </>,
  )
  await render(f.node())
  await f.ready()
  const calls = jest.mocked(Commands.requestKeyboardFocus).mock.calls
  expect(calls.some(([target]) => target === first.current)).toBe(false)
  expect(calls.some(([target]) => target === authored.current)).toBe(true)
})

it("CAP.menu.003/.004/.015 independently applies root width/foreground/final style and list typography", async () => {
  const f = fixture({
    width: 250,
    color: "teal",
    customStyles: { color: "turquoise" },
    style: { backgroundColor: "blue" },
    customMenuStyles: { color: "gold" },
  })
  await render(f.node())
  expect(row("menu")).toHaveStyle({ width: 250, backgroundColor: "blue" })
  expect(screen.getByText("Profile", hidden)).toHaveStyle({ color: "gold" })
})
it("CAP.menu.005–.010 uses all five existing native action backgrounds and explicit color suppresses order", async () => {
  const f = fixture()
  await render(f.node())
  for (const order of ["primary", "secondary", "tertiary", "quaternary", "quintenary"] as const) {
    await rerender(f.node({ order }))
    expect(row("menu")).toHaveStyle({ backgroundColor: resolveNativeTheme("light").actions[order].background })
    await rerender(f.node({ order, color: "teal" }))
    expect(row("menu")).toHaveStyle({ backgroundColor: resolveNativeTheme("light").colors.background })
  }
})
it("CAP.menu.019/.020 delivers item then root actions and requests close once", async () => {
  const trace: string[] = []
  const pointer = jest.fn()
  const f = fixture(
    { onAction: (key) => trace.push("root:" + key), onOpenChange: (open) => trace.push("open:" + open) },
    <MenuItem id={0} testID="zero" onAction={() => trace.push("item")} onPress={pointer}>
      Zero
    </MenuItem>,
  )
  await render(f.node())
  await f.ready()
  expect(Commands.requestKeyboardFocus).toHaveBeenCalled()
  await press("zero")
  expect(pointer).toHaveBeenCalled()
  expect(trace).toEqual(["item", "root:0", "open:false"])
})
it("CAP.menu.017/.021 keeps controlled open and disabled keys authoritative", async () => {
  const f = fixture({ shouldCloseOnSelect: false, disabledKeys: ["profile"] })
  await render(f.node())
  await f.ready()
  expect(row("profile")).toBeDisabled()
  await press("profile")
  expect(f.action).not.toHaveBeenCalled()
  await press("gallery")
  expect(f.action.mock.calls).toEqual([["gallery"]])
  expect(f.close).not.toHaveBeenCalled()
})

it("CAP.menu.011–.014 preserves both geometries and raised false independently", async () => {
  const f = fixture()
  await render(f.node())
  expect(row("menu")).toHaveStyle({ borderRadius: resolveNativeTheme("light").radius.rounded })
  expect(RN.StyleSheet.flatten(row("menu").props.style).boxShadow).toBeDefined()
  await rerender(f.node({ geometry: "orthogonal", raised: false }))
  expect(row("menu")).toHaveStyle({ borderRadius: 0 })
  expect(RN.StyleSheet.flatten(row("menu").props.style).boxShadow).toBeUndefined()
})
it("CAP.menu.016/.018 consumes root fields and retains an explicit empty menu name", async () => {
  const f = fixture({
    menuAriaLabel: "",
    selectedKeys: new Set(),
    selectionMode: "multiple",
    customMenuStyles: { padding: 0 },
  })
  await render(f.node())
  expect(row("menu-list").props.accessibilityLabel).toBe("")
  for (const key of [
    "menuAriaLabel",
    "selectedKeys",
    "selectionMode",
    "disabledKeys",
    "onAction",
    "customMenuStyles",
    "shouldCloseOnSelect",
  ])
    expect(row("menu").props[key]).toBeUndefined()
})
it("CAP.menu.022/.023 preserves icon identity, omitted slots and explicit null presence", async () => {
  const icon = <Text testID="author-icon">Glyph</Text>
  const f = fixture(
    {},
    <>
      <MenuItem id="a" icon={icon}>
        A
      </MenuItem>
      <MenuItem id="b" icon={null}>
        B
      </MenuItem>
      <MenuItem id="c">C</MenuItem>
    </>,
  )
  await render(f.node())
  expect(screen.getAllByTestId("menu-item-icon", hidden)).toHaveLength(2)
  expect(row("author-icon")).toHaveTextContent("Glyph")
})
it("CAP.menu.024–.028 preserves danger, default text, state callbacks and final overrides without wrapper leakage", async () => {
  const style = jest.fn((state) => ({
    color: state.isDisabled ? "teal" : "tomato",
    opacity: state.isDisabled ? 0.4 : 1,
  }))
  const f = fixture(
    { disabledKeys: ["a"] },
    <>
      <MenuItem
        id="a"
        testID="a"
        variant="destructive"
        icon={null}
        customStyles={{ backgroundColor: "gold", fontStyle: "italic" }}
        style={style}
      >
        Styled
      </MenuItem>
      <MenuItem id="b" testID="b">
        Ordinary
      </MenuItem>
    </>,
  )
  await render(f.node())
  expect(row("a")).toHaveStyle({ backgroundColor: "gold", opacity: 0.4 })
  expect(screen.getByText("Styled", hidden)).toHaveStyle({ color: "teal", fontStyle: "italic" })
  expect(style.mock.calls.at(-1)?.[0]).toMatchObject({
    isDisabled: true,
    isSelected: false,
    selectionMode: "none",
    defaultStyle: { backgroundColor: "gold", color: resolveNativeTheme("light").colors.statusDanger },
  })
  expect(screen.getByText("Ordinary", hidden)).toHaveStyle({ color: resolveNativeTheme("light").colors.foreground })
  for (const key of ["icon", "variant", "customStyles", "onAction", "shouldCloseOnSelect", "href", "onNavigate"])
    expect(row("a").props[key]).toBeUndefined()
})
it("CAP.menu.029–.032 keeps separator computed/custom/final/native semantics independent", async () => {
  const f = fixture(
    {},
    <>
      <MenuItem id="a">A</MenuItem>
      <MenuSeparator customStyles={{ marginTop: 5, height: 0 }} style={{ marginBottom: 0 }} />
      <MenuItem id="b">B</MenuItem>
    </>,
  )
  await render(f.node())
  expect(row("menu-separator")).toHaveStyle({
    height: 0,
    marginTop: 5,
    marginBottom: 0,
    backgroundColor: resolveNativeTheme("light").colors.controlBorder,
  })
  expect(row("menu-separator").props.role).toBe("separator")
  expect(row("menu-separator").props.customStyles).toBeUndefined()
})
it("keeps selected typed zero/empty keys authoritative through repeated veto and owner echo", async () => {
  const selection = jest.fn(),
    owner = new Set<string | number>([0])
  const content = (
    <>
      <MenuItem id={0} testID="zero">
        Zero
      </MenuItem>
      <MenuItem id="" testID="empty">
        Empty
      </MenuItem>
    </>
  )
  const f = fixture(
    { selectionMode: "single", selectedKeys: owner, onSelectionChange: selection, shouldCloseOnSelect: false },
    content,
  )
  await render(f.node())
  await f.ready()
  expect(row("zero").props.accessibilityState.checked).toBe(true)
  await press("empty")
  await press("empty")
  expect(selection.mock.calls.map(([keys]) => [...keys])).toEqual([[""], [""]])
  expect(row("zero").props.accessibilityState.checked).toBe(true)
  expect([...owner]).toEqual([0])
  await rerender(f.node({ selectionMode: "single", selectedKeys: new Set([""]), shouldCloseOnSelect: false }, content))
  expect(row("empty").props.accessibilityState.checked).toBe(true)
  expect(row("zero").props.accessibilityState.checked).toBe(false)
})
it("retains one-shot controlled selection and disabled iterators across internal renders and vetoes", async () => {
  const selected = jest.fn()
  const owner = new Set([0]),
    disabled = new Set(["blocked"])
  const props = {
    selectionMode: "single" as const,
    selectedKeys: owner.values(),
    disabledKeys: disabled.values(),
    onSelectionChange: selected,
    shouldCloseOnSelect: false,
  }
  const f = fixture(
    props,
    <>
      <MenuItem id={0} testID="zero">
        Zero
      </MenuItem>
      <MenuItem id="blocked" testID="blocked">
        Blocked
      </MenuItem>
    </>,
  )
  await render(f.node())
  await f.ready()
  expect(row("zero").props.accessibilityState.checked).toBe(true)
  expect(row("blocked").props.accessibilityState.disabled).toBe(true)
  await press("blocked")
  expect(f.action).not.toHaveBeenCalled()
  await press("zero")
  expect(selected.mock.calls.map(([keys]) => [...keys])).toEqual([[]])
  expect(row("zero").props.accessibilityState.checked).toBe(true)
  await rerender(f.node())
  expect(row("zero").props.accessibilityState.checked).toBe(true)
  expect(row("blocked").props.accessibilityState.disabled).toBe(true)
  await rerender(
    f.node({ ...props, selectedKeys: new Set<number>().values(), disabledKeys: new Set<string>().values() }),
  )
  expect(row("zero").props.accessibilityState.checked).toBe(false)
  expect(row("blocked").props.accessibilityState.disabled).toBe(false)
  expect([...owner]).toEqual([0])
  expect([...disabled]).toEqual(["blocked"])
})

it("toggles uncontrolled multiple selection and respects item close false over root true", async () => {
  const selection = jest.fn()
  const f = fixture(
    { selectionMode: "multiple", onSelectionChange: selection },
    <MenuItem id="a" testID="a" shouldCloseOnSelect={false}>
      A
    </MenuItem>,
  )
  await render(f.node())
  await f.ready()
  await press("a")
  expect(row("a").props.accessibilityState.checked).toBe(true)
  await press("a")
  expect(row("a").props.accessibilityState.checked).toBe(false)
  expect(selection.mock.calls.map(([keys]) => [...keys])).toEqual([["a"], []])
  expect(f.close).not.toHaveBeenCalled()
})
it("requests selection before item/root actions, with no manufactured owner echo", async () => {
  const trace: string[] = []
  const f = fixture(
    {
      selectionMode: "single",
      selectedKeys: new Set(),
      onSelectionChange: () => trace.push("selection"),
      onAction: () => trace.push("root"),
      onOpenChange: () => trace.push("close"),
    },
    <MenuItem id="a" testID="a" onAction={() => trace.push("item")}>
      A
    </MenuItem>,
  )
  await render(f.node())
  await f.ready()
  await press("a")
  expect(trace).toEqual(["selection", "item", "root", "close"])
  expect(row("a").props.accessibilityState.checked).toBe(false)
})
it("preserves links as actions, delegates one native URL and bypasses selection", async () => {
  const selected = jest.fn(),
    item = jest.fn()
  const f = fixture(
    { selectionMode: "multiple", onSelectionChange: selected, shouldCloseOnSelect: false },
    <MenuItem id="a" testID="a" href="https://example.test/path" onAction={item}>
      A
    </MenuItem>,
  )
  await render(f.node())
  await f.ready()
  await press("a")
  expect(item).toHaveBeenCalledTimes(1)
  expect(f.action).toHaveBeenCalledWith("a")
  expect(RN.Linking.openURL).toHaveBeenCalledWith("https://example.test/path")
  expect(selected).not.toHaveBeenCalled()
})
it("allows original native onPress veto before pointer action and retains the same packet", async () => {
  let observed: unknown
  const f = fixture(
    {},
    <MenuItem
      id="a"
      testID="a"
      onPress={(e) => {
        observed = e
        e.preventDefault()
      }}
    >
      A
    </MenuItem>,
  )
  await render(f.node())
  await f.ready()
  await press("a")
  expect(observed).toBeDefined()
  expect(f.action).not.toHaveBeenCalled()
  expect(f.close).not.toHaveBeenCalled()
})
it("handles caller empty collections and forwards actual item refs", async () => {
  const ref = createRef<RN.View>(),
    f = fixture(
      {},
      <MenuItem ref={ref} id="a">
        A
      </MenuItem>,
    )
  await render(f.node())
  expect(ref.current).not.toBeNull()
  await rerender(f.node({}, null))
  expect(ref.current).toBeNull()
  expect(row("menu-list").props.accessible).toBe(true)
})

const rawKey = async (id: string, key: string, phase = "down", extra: Record<string, unknown> = {}) => {
  let prevented = false
  const native = row(id).props
  const e = {
    persist: jest.fn(),
    preventDefault: () => {
      prevented = true
    },
    isDefaultPrevented: () => prevented,
    nativeEvent: {
      kind: "keyboard",
      ownerId: native.ownerId,
      target: 17,
      key,
      nativeCode: 66,
      phase,
      repeat: false,
      cancelled: false,
      nativeDefaultHandled: true,
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      capsLock: false,
      nativeModifierData: "0",
      timestamp: 100,
      ...extra,
    },
  }
  await act(() => native.onNativeKey(e))
  return e
}
const scopedKey = async (
  key: string,
  focused: RN.View | null,
  token = `0000:${key}`,
  extra: Record<string, unknown> = {},
) => {
  const host = row("host").props
  const policy = host.policies.find((p: { tokens: string[] }) => p.tokens.includes(token))
  expect(policy).toBeDefined()
  let prevented = false
  const e = {
    preventDefault: jest.fn(() => {
      prevented = true
    }),
    isDefaultPrevented: () => prevented,
    nativeEvent: {
      kind: "keyboard",
      ownerId: host.ownerId,
      policyId: policy.id,
      target: 17,
      focusedTarget: RN.findNodeHandle(focused),
      windowId: "menu-window",
      epoch: 1,
      policyRevision: host.policyRevision,
      key,
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
  await act(() => host.onNativeScopedKey(e))
  await tick()
}
it.each(["Enter", " "])("activates %s on key-down and prevents a duplicate key-up action", async (key) => {
  const f = fixture({ shouldCloseOnSelect: false })
  await render(f.node())
  await f.ready()
  await rawKey("profile", key)
  expect(f.action.mock.calls).toEqual([["profile"]])
  await rawKey("profile", key, "up")
  expect(f.action).toHaveBeenCalledTimes(1)
  await rawKey("profile", key, "down", { repeat: true })
  expect(f.action).toHaveBeenCalledTimes(1)
})
it("CAP.menu.034 moves from the actual focused row, wraps/skips disabled and activates the requested target", async () => {
  const a = createRef<RN.View>(),
    b = createRef<RN.View>(),
    c = createRef<RN.View>()
  const f = fixture(
    { shouldCloseOnSelect: false },
    <>
      <MenuItem ref={a} id="a" testID="a">
        Alpha
      </MenuItem>
      <MenuItem ref={b} id="b" testID="b" isDisabled>
        Beta
      </MenuItem>
      <MenuItem ref={c} id="c" testID="c">
        Charlie
      </MenuItem>
    </>,
  )
  await render(f.node())
  await f.ready()
  await scopedKey("ArrowDown", a.current)
  expect(Commands.requestKeyboardFocus).toHaveBeenLastCalledWith(c.current, row("c").props.ownerId)
  await rawKey("c", "Enter")
  expect(f.action.mock.calls).toEqual([["c"]])
  await scopedKey("Home", c.current)
  expect(Commands.requestKeyboardFocus).toHaveBeenLastCalledWith(a.current, row("a").props.ownerId)
})
it.each([
  { removed: "b", expected: "c", order: ["a", "b", "c"] },
  { removed: "c", expected: "b", order: ["a", "b", "c"] },
  { removed: "b", expected: "a", order: ["c", "a", "b"] },
] as const)(
  "recovers from removed focused $removed to retained $expected without changing owner selection",
  async ({ removed, expected, order }) => {
    const refs = { a: createRef<RN.View>(), b: createRef<RN.View>(), c: createRef<RN.View>() }
    type TKey = keyof typeof refs
    const content = (keys: readonly TKey[]) =>
      keys.map((id) => (
        <MenuItem key={id} id={id} ref={refs[id]} testID={id}>
          {id}
        </MenuItem>
      ))
    const owner = new Set(["missing", removed]),
      changed = jest.fn()
    const props = {
      selectionMode: "multiple" as const,
      selectedKeys: owner,
      onSelectionChange: changed,
      shouldCloseOnSelect: false,
    }
    const f = fixture(props, content(["a", "b", "c"]))
    await render(f.node())
    await f.ready()
    await rerender(f.node(props, content(order)))
    await f.ready()
    const native = row(removed).props
    await act(() =>
      native.onNativeFocusChange({
        nativeEvent: {
          ownerId: native.ownerId,
          target: RN.findNodeHandle(refs[removed].current),
          isFocused: true,
          isFocusVisible: false,
          origin: "programmatic",
          timestamp: 200,
        },
      }),
    )
    jest.mocked(Commands.requestKeyboardFocus).mockClear()
    await rerender(f.node(props, content(order.filter((id) => id !== removed))))
    await f.ready()
    const lastRequest = jest.mocked(Commands.requestKeyboardFocus).mock.calls.at(-1)
    expect(lastRequest?.[0] === refs[expected].current).toBe(true)
    expect(lastRequest?.[1]).toBe(row(expected).props.ownerId)
    expect([...owner]).toEqual(["missing", removed])
    expect(changed).not.toHaveBeenCalled()
    expect(f.action).not.toHaveBeenCalled()
  },
)

it.each(["unmounted", "window-inactive"] as const)("retires pending collection focus when %s", async (reason) => {
  const f = fixture(
    {},
    <MenuItem key="a" id="a" testID="a">
      A
    </MenuItem>,
  )
  await render(f.node())
  await f.ready()
  await rerender(
    f.node(
      {},
      <MenuItem key="b" id="b" testID="b">
        B
      </MenuItem>,
    ),
  )
  const pending = [...frames.values()]
  expect(pending.length).toBeGreaterThan(0)
  if (reason === "unmounted") await screen.unmount()
  else {
    const host = row("host").props
    await act(() =>
      host.onNativeScopeStatus({
        nativeEvent: {
          ownerId: host.ownerId,
          windowId: "menu-window",
          epoch: 1,
          policyRevision: host.policyRevision,
          ready: true,
          windowActive: false,
        },
      }),
    )
  }
  jest.mocked(Commands.requestKeyboardFocus).mockClear()
  if (reason === "unmounted") await rendererAct(() => pending.forEach((callback) => callback(400)))
  else await act(() => pending.forEach((callback) => callback(400)))
  expect(jest.mocked(Commands.requestKeyboardFocus).mock.calls.length).toBe(0)
})

it("routes typeahead through current labels without executing an action", async () => {
  const a = createRef<RN.View>(),
    b = createRef<RN.View>()
  const f = fixture(
    {},
    <>
      <MenuItem ref={a} id="a" testID="a">
        Alpha
      </MenuItem>
      <MenuItem ref={b} id="b" testID="b">
        Étage
      </MenuItem>
    </>,
  )
  await render(f.node())
  await f.ready()
  await rawKey("a", "e", "down", { nativeDefaultHandled: false })
  expect(Commands.requestKeyboardFocus).toHaveBeenLastCalledWith(b.current, row("b").props.ownerId)
  jest.mocked(Commands.requestKeyboardFocus).mockClear()
  await rawKey("b", "e", "down", { nativeDefaultHandled: false, repeat: true })
  expect(Commands.requestKeyboardFocus).toHaveBeenLastCalledWith(b.current, row("b").props.ownerId)
  expect(f.action).not.toHaveBeenCalled()
})
it("requests all through the native scoped shortcut without mutating caller selection", async () => {
  const selected = jest.fn(),
    ref = createRef<RN.View>(),
    owner = new Set<string | number>()
  const f = fixture(
    { selectionMode: "multiple", selectedKeys: owner, onSelectionChange: selected },
    <MenuItem ref={ref} id="a">
      A
    </MenuItem>,
  )
  await render(f.node())
  await f.ready()
  await scopedKey("a", ref.current, "0010:a", { ctrlKey: true })
  expect(selected.mock.calls).toEqual([["all"]])
  expect(owner.size).toBe(0)
})
it("CAP.menu.033 opens from trigger Enter on key-down without closing again on key-up", async () => {
  const anchor = createRef<RN.View>()
  await render(
    <NativeThemeProvider>
      <NativeFloatingLayerHost testID="host">
        <NativeMenuTrigger
          trigger={(state) => (
            <Button {...state.triggerProps} ref={anchor} testID="trigger">
              Actions
            </Button>
          )}
        >
          <Menu triggerRef={anchor}>
            <MenuItem id="a">A</MenuItem>
          </Menu>
        </NativeMenuTrigger>
      </NativeFloatingLayerHost>
    </NativeThemeProvider>,
  )
  expect(screen.queryByTestId("menu", hidden)).toBeNull()
  await rawKey("trigger", "Enter")
  expect(row("menu")).toBeOnTheScreen()
  await rawKey("trigger", "Enter", "up")
  expect(row("menu")).toBeOnTheScreen()
})
it("CAP.menu.035 dispatches native Escape to close while respecting controlled-open veto", async () => {
  const f = fixture()
  await render(f.node())
  await f.ready()
  const host = row("host").props
  const policy = host.policies.find((p: { tokens: string[] }) => p.tokens.includes("0000:Escape"))
  expect(policy).toBeDefined()
  await act(() =>
    host.onNativeScopedKey({
      nativeEvent: {
        kind: "keyboard",
        ownerId: host.ownerId,
        policyId: policy.id,
        target: 17,
        focusedTarget: 17,
        windowId: "menu-window",
        epoch: 1,
        policyRevision: host.policyRevision,
        key: "Escape",
        phase: "down",
        repeat: false,
        cancelled: false,
        nativeCode: 1,
        nativeDefaultHandled: true,
        shiftKey: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        capsLock: false,
        nativeModifierData: "0",
        timestamp: 100,
      },
    }),
  )
  expect(f.close.mock.calls).toEqual([[false]])
  expect(row("menu")).toBeOnTheScreen()
})

it.each(["ArrowDown", "ArrowUp"])("opens from scoped %s only on a fresh key-down", async (key) => {
  const requested = jest.fn()
  await render(
    <NativeThemeProvider>
      <NativeFloatingLayerHost testID="host">
        <NativeMenuTrigger
          isOpen={false}
          onOpenChange={requested}
          trigger={(state) => <Button {...state.triggerProps}>Actions</Button>}
        >
          <Menu>
            <MenuItem id="a">A</MenuItem>
          </Menu>
        </NativeMenuTrigger>
      </NativeFloatingLayerHost>
    </NativeThemeProvider>,
  )
  for (const ready of [false, true]) {
    const host = row("host").props
    await act(() =>
      host.onNativeScopeStatus({
        nativeEvent: {
          ownerId: host.ownerId,
          windowId: "menu-window",
          epoch: 1,
          policyRevision: host.policyRevision,
          ready,
          windowActive: true,
        },
      }),
    )
  }
  await scopedKey(key, null, `0000:${key}`, { phase: "up" })
  await scopedKey(key, null, `0000:${key}`, { repeat: true })
  await scopedKey(key, null, `0000:${key}`, { cancelled: true })
  expect(requested).not.toHaveBeenCalled()
  await scopedKey(key, null)
  expect(requested.mock.calls).toEqual([[true]])
  expect(screen.queryByTestId("menu", hidden)).toBeNull()
})

it("preserves original keyboard press lifecycle alongside key-down menu actions", async () => {
  const start = jest.fn(),
    up = jest.fn(),
    end = jest.fn(),
    pressed = jest.fn(),
    change = jest.fn()
  const f = fixture(
    { shouldCloseOnSelect: false },
    <MenuItem
      id="a"
      testID="a"
      onPressStart={start}
      onPressUp={up}
      onPressEnd={end}
      onPress={pressed}
      onPressChange={change}
    >
      A
    </MenuItem>,
  )
  await render(f.node())
  await f.ready()
  const down = await rawKey("a", "Enter")
  expect(f.action.mock.calls).toEqual([["a"]])
  expect(start.mock.calls[0][0]).toBe(down)
  const release = await rawKey("a", "Enter", "up")
  expect(up.mock.calls[0][0]).toBe(release)
  expect(end.mock.calls[0][0]).toBe(release)
  expect(pressed.mock.calls[0][0]).toBe(release)
  expect(change.mock.calls).toEqual([[true], [false]])
  expect(f.action).toHaveBeenCalledTimes(1)
})
it("retains disabled controlled selection display without mutating it or admitting action", async () => {
  const owner = new Set(["a"]),
    f = fixture(
      { selectionMode: "single", selectedKeys: owner, disabledKeys: ["a"] },
      <MenuItem id="a" testID="a">
        A
      </MenuItem>,
    )
  await render(f.node())
  await f.ready()
  expect(row("a").props.accessibilityState.checked).toBe(true)
  expect(row("a")).toBeDisabled()
  await press("a")
  expect(f.action).not.toHaveBeenCalled()
  expect([...owner]).toEqual(["a"])
})
it("keeps controlled all derived from the latest collection and waits for owner echo", async () => {
  const selected = jest.fn(),
    f = fixture({
      selectionMode: "multiple",
      selectedKeys: "all",
      onSelectionChange: selected,
      shouldCloseOnSelect: false,
    })
  await render(f.node())
  await f.ready()
  await press("profile")
  expect(selected.mock.calls.map(([keys]) => [...keys])).toEqual([["gallery", "remove"]])
  expect(row("profile").props.accessibilityState.checked).toBe(true)
  await rerender(
    f.node(
      { selectionMode: "multiple", selectedKeys: "all", shouldCloseOnSelect: false },
      <MenuItem key="new" id="new" testID="new">
        New
      </MenuItem>,
    ),
  )
  expect(row("new").props.accessibilityState.checked).toBe(true)
})
it("uses current item/root callbacks after replacement, including an empty typed key", async () => {
  const first = jest.fn(),
    next = jest.fn(),
    item = jest.fn()
  const f = fixture(
    { onAction: first, shouldCloseOnSelect: false },
    <MenuItem id="" testID="a">
      A
    </MenuItem>,
  )
  await render(f.node())
  await f.ready()
  await rerender(
    f.node(
      { onAction: next, shouldCloseOnSelect: false },
      <MenuItem id="" testID="a" onAction={item}>
        A
      </MenuItem>,
    ),
  )
  await press("a")
  expect(first).not.toHaveBeenCalled()
  expect(item).toHaveBeenCalledTimes(1)
  expect(next.mock.calls).toEqual([[""]])
})
it("retires pending URL failures after the item is removed", async () => {
  let reject: (error: unknown) => void = () => {}
  jest.mocked(RN.Linking.openURL).mockImplementation(
    () =>
      new Promise((_, fail) => {
        reject = fail
      }),
  )
  const failure = jest.fn(),
    f = fixture(
      { shouldCloseOnSelect: false },
      <MenuItem id="a" testID="a" href="https://example.test" onNavigationError={failure}>
        A
      </MenuItem>,
    )
  await render(f.node())
  await f.ready()
  await press("a")
  await rerender(f.node({ shouldCloseOnSelect: false }, null))
  await act(async () => reject(new Error("retired")))
  expect(failure).not.toHaveBeenCalled()
})
it.each(["light", "dark"] as const)("keeps mounted theme updates and all style owners in %s", async (mode) => {
  const f = fixture(
    { order: "primary" },
    <MenuItem id="a" testID="a" variant="destructive">
      A
    </MenuItem>,
  )
  await render(f.node({ order: "primary" }, undefined, mode))
  expect(row("menu")).toHaveStyle({ backgroundColor: resolveNativeTheme(mode).actions.primary.background })
  expect(screen.getByText("A", hidden)).toHaveStyle({ color: resolveNativeTheme(mode).colors.statusDanger })
  const next = mode === "light" ? "dark" : "light"
  await rerender(f.node({ order: "secondary" }, undefined, next))
  expect(row("menu")).toHaveStyle({ backgroundColor: resolveNativeTheme(next).actions.secondary.background })
  expect(screen.getByText("A", hidden)).toHaveStyle({ color: resolveNativeTheme(next).colors.statusDanger })
})

it("preserves all 16 native key modifier combinations and original press records", async () => {
  const seen: unknown[] = []
  const f = fixture(
    { shouldCloseOnSelect: false },
    <MenuItem id="a" testID="a" onKeyDown={(event) => seen.push(event)}>
      A
    </MenuItem>,
  )
  await render(f.node())
  await f.ready()
  for (let bits = 0; bits < 16; bits++) {
    const down = await rawKey("a", "Enter", "down", {
      shiftKey: !!(bits & 1),
      altKey: !!(bits & 2),
      ctrlKey: !!(bits & 4),
      metaKey: !!(bits & 8),
    })
    expect(seen.at(-1)).toBe(down)
    await rawKey("a", "Enter", "up")
  }
  expect(f.action.mock.calls).toEqual(Array.from({ length: 16 }, () => ["a"]))
})

it("uses opaque child-local logical order with stable actual refs", async () => {
  const refs = { a: createRef<RN.View>(), b: createRef<RN.View>(), c: createRef<RN.View>() }
  let reorder!: () => void
  const Opaque = () => {
    const [keys, setKeys] = useState<(keyof typeof refs)[]>(["a", "b", "c"])
    reorder = () => setKeys(["c", "a", "b"])
    return keys.map((id) => (
      <MenuItem key={id} id={id} ref={refs[id]} testID={id}>
        {id}
      </MenuItem>
    ))
  }
  const f = fixture({}, <Opaque />)
  await render(f.node())
  await f.ready()
  const original = refs.c.current
  await act(reorder)
  await f.ready()
  await scopedKey("Home", refs.a.current)
  expect(jest.mocked(Commands.requestKeyboardFocus).mock.calls.at(-1)?.[0] === refs.c.current).toBe(true)
  expect(refs.c.current === original).toBe(true)
})

it("keeps offscreen members in actual tree state and defers native focus until materialization", async () => {
  const first = createRef<RN.View>(),
    second = createRef<RN.View>()
  let materialize!: () => void
  let state!: NonNullable<React.ContextType<typeof NativeMenuStateContext>>
  const Root = ({ collection, persistedKeys, scrollRef }: TNativeCollectionRootProps) => {
    const [all, setAll] = useState(false)
    materialize = () => setAll(true)
    state = useContext(NativeMenuStateContext)!
    expect(scrollRef).toBeDefined()
    if (persistedKeys?.has("0")) expect(state.collection.size).toBe(2)
    return [...collection]
      .filter((node) => all || node.key === 0)
      .map((node) => <Fragment key={encodeCollectionKey(node.key)}>{node.render?.(node)}</Fragment>)
  }
  const selected = jest.fn()
  const f = fixture(
    { selectionMode: "multiple", selectedKeys: [], onSelectionChange: selected, shouldCloseOnSelect: false },
    <>
      <MenuItem id={0} ref={first} testID="first">
        First
      </MenuItem>
      <MenuItem id="0" ref={second} testID="second">
        Second
      </MenuItem>
    </>,
    { ...DefaultNativeCollectionRenderer, isVirtualized: true, CollectionRoot: Root },
  )
  await render(f.node())
  await f.ready()
  expect(state.collection.size).toBe(2)
  expect(second.current).toBeNull()
  await scopedKey("a", first.current, "0010:a", { ctrlKey: true })
  await scopedKey("a", first.current, "0010:a", { ctrlKey: true })
  expect(selected.mock.calls.map(([keys]) => keys)).toEqual(["all", "all"])
  jest.mocked(Commands.requestKeyboardFocus).mockClear()
  await scopedKey("ArrowDown", first.current)
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
  expect(state.selectionManager.focusedKey).toBe("0")
  await act(materialize)
  expect(jest.mocked(Commands.requestKeyboardFocus).mock.calls.at(-1)?.[0] === second.current).toBe(true)
  expect(state.selectionManager.focusedKey).toBe("0")
})

it.each([false, true])(
  "hands an admitted native pointer receipt to the original parent row, retired=%s",
  async (retired) => {
    const trigger = createRef<RN.View>(),
      other = createRef<RN.View>(),
      childList = createRef<RN.View>()
    const f = fixture(
      {},
      <>
        <SubmenuTrigger ref={trigger}>
          <MenuItem id="trigger" testID="trigger">
            More
          </MenuItem>
          <NativeMenuListContext.Provider value={{ ref: childList }}>
            <Menu testID="submenu">
              <MenuItem id="child">Child</MenuItem>
            </Menu>
          </NativeMenuListContext.Provider>
        </SubmenuTrigger>
        <MenuItem ref={other} id="other" testID="other">
          Other
        </MenuItem>
      </>,
    )
    const observe = jest.fn()
    await render(
      <NativeMenuPointerObservationContext.Provider value={observe}>
        {f.node()}
      </NativeMenuPointerObservationContext.Provider>,
    )
    await f.ready(false, "source-model-window")
    expect(row("host").props.menuPointerPolicies).toEqual([])
    await act(() =>
      row("trigger").props.onNativeFocusChange({
        nativeEvent: {
          ownerId: row("trigger").props.ownerId,
          target: RN.findNodeHandle(trigger.current),
          isFocused: true,
          isFocusVisible: true,
        },
      }),
    )
    await rawKey("trigger", "Enter")
    const lists = screen.getAllByTestId("menu-list", hidden)
    await fireEvent(lists[1], "layout", { nativeEvent: { layout: { x: 200, y: 0, width: 150, height: 180 } } })
    await act(() => {
      const scope = row("host").props
      scope.onNativeScopeStatus({
        nativeEvent: {
          ownerId: scope.ownerId,
          windowId: "source-model-window",
          epoch: 1,
          policyRevision: scope.policyRevision,
          ready: true,
          windowActive: true,
        },
      })
    })
    const native = row("host").props
    expect(native.menuPointerPolicies).toHaveLength(1)
    const policy = native.menuPointerPolicies[0]
    expect(policy.triggerTarget).toBe(RN.findNodeHandle(trigger.current))
    expect(policy.submenuTarget).toBe(RN.findNodeHandle(childList.current))
    expect(JSON.parse(policy.parentBinding).descriptorId).toBe("")
    expect(JSON.parse(policy.triggerBinding).descriptorId).not.toBe("")
    const data = {
      ownerId: native.ownerId,
      windowId: "source-model-window",
      epoch: 1,
      revision: native.menuPointerRevision,
      policyId: policy.id,
      sequence: 1,
      phase: "status",
      ready: true,
      suppressed: false,
      observationId: 0,
      pointerType: "unknown",
      pageX: 10,
      pageY: 10,
      timestamp: 0,
      target: policy.parentTarget,
      hitPath: [policy.parentTarget],
      nativeButtons: "",
      nativeModifiers: "",
      geometry: "",
      error: "",
    }
    const status = { nativeEvent: data }
    await act(() => native.onNativeMenuPointer(status))
    expect(observe).toHaveBeenLastCalledWith(status)
    expect(observe.mock.calls.at(-1)![0]).toBe(status)
    if (retired)
      await act(() =>
        row("other").props.onNativeFocusChange({
          nativeEvent: {
            ownerId: row("other").props.ownerId,
            target: RN.findNodeHandle(other.current),
            isFocused: true,
            isFocusVisible: false,
          },
        }),
      )
    if (retired) {
      expect(row("trigger").props.accessibilityState.expanded).toBe(false)
      expect(row("host").props.menuPointerPolicies).toEqual([])
    }
    jest.mocked(Commands.requestKeyboardFocus).mockClear()
    await act(() =>
      row("host").props.onNativeMenuPointer({
        nativeEvent: {
          ...data,
          sequence: 2,
          phase: "handoff",
          observationId: 7,
          pointerType: "mouse",
          target: RN.findNodeHandle(other.current),
          hitPath: [RN.findNodeHandle(other.current), policy.parentTarget],
        },
      }),
    )
    if (retired) expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
    else {
      expect(Commands.requestKeyboardFocus).toHaveBeenCalledWith(other.current, row("other").props.ownerId)
      expect(row("trigger").props.accessibilityState.expanded).toBe(false)
    }
    expect(f.action).not.toHaveBeenCalled()
  },
)

it("names the original menu list through its actual trigger while retaining explicit list naming precedence", async () => {
  const scene = (override = false) => (
    <NativeThemeProvider>
      <NativeOverlayProvider>
        <NativeFloatingLayerHost>
          <NativeMenuListContext.Provider value={override ? { accessibilityLabelledBy: [] } : null}>
            <NativeMenuTrigger
              defaultOpen
              trigger={(state) => (
                <Button {...state.triggerProps} testID="naming-trigger">
                  Original trigger name
                </Button>
              )}
            >
              <Menu menuAriaLabel="Authored menu label">
                <MenuItem id="item">Item</MenuItem>
              </Menu>
            </NativeMenuTrigger>
          </NativeMenuListContext.Provider>
        </NativeFloatingLayerHost>
      </NativeOverlayProvider>
    </NativeThemeProvider>
  )
  const view = await render(scene())
  const trigger = row("naming-trigger").props.nativeID
  expect(row("menu-list").props.nativeLabelledBy).toEqual([trigger])
  expect(row("menu-list").props.accessibilityLabel).toBe("Authored menu label")
  await view.rerender(scene(true))
  expect(row("naming-trigger").props.nativeID).toBe(trigger)
  expect(row("menu-list").props.nativeLabelledBy).toEqual([])
})
