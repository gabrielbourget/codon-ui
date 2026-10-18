import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { createRef, type ReactNode } from "react"
import * as RN from "react-native"

import { Button, NativeFloatingLayerHost, NativeOverlayProvider, NativeThemeProvider, Text } from "../../.."
import { Commands } from "../../../input/specs/CUIFocusViewNativeComponent"
import { resolveNativeTheme } from "../../../theme/defaults"
import { Menu, NativeMenuTrigger } from "../Menu"
import { MenuItem } from "../MenuItem"
import { MenuSeparator } from "../MenuSeparator"
import type { TNativeMenuProps } from "../types"

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: jest.requireActual("react-native").View,
  SafeAreaView: jest.requireActual("react-native").View,
}))
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
const fixture = (initial: Partial<TNativeMenuProps> = {}, children: ReactNode = sample()) => {
  const root = createRef<RN.View>(),
    host = createRef<RN.View>(),
    anchor = createRef<RN.View>()
  const action = jest.fn(),
    close = jest.fn()
  const node = (props: Partial<TNativeMenuProps> = initial, content = children, mode: "light" | "dark" = "light") => (
    <NativeThemeProvider mode={mode}>
      <NativeOverlayProvider>
        <NativeFloatingLayerHost ref={host} testID="host">
          <RN.View ref={anchor} />
          <Menu ref={root} triggerRef={anchor} isOpen onAction={action} onOpenChange={close} {...props}>
            {content}
          </Menu>
        </NativeFloatingLayerHost>
      </NativeOverlayProvider>
    </NativeThemeProvider>
  )
  const ready = async () => {
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
            windowId: "menu-window",
            epoch: 1,
            policyRevision: native.policyRevision,
            ready,
            windowActive: true,
          },
        }),
      )
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

it("CAP.menu.001/.002 renders the actual menu/list/item/separator structure with the native root ref", async () => {
  const f = fixture()
  await render(f.node())
  expect(f.root.current).not.toBeNull()
  expect(row("menu-list").props.role).toBe("menu")
  expect(screen.getAllByRole("menuitem", hidden)).toHaveLength(3)
  expect(row("menu-separator").props.role).toBe("separator")
  expect(row("menu").props.role).toBeUndefined()
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
    await screen.rerender(f.node({ order }))
    expect(row("menu")).toHaveStyle({ backgroundColor: resolveNativeTheme("light").actions[order].background })
    await screen.rerender(f.node({ order, color: "teal" }))
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
  await screen.rerender(f.node({ geometry: "orthogonal", raised: false }))
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
  await screen.rerender(
    f.node({ selectionMode: "single", selectedKeys: new Set([""]), shouldCloseOnSelect: false }, content),
  )
  expect(row("empty").props.accessibilityState.checked).toBe(true)
  expect(row("zero").props.accessibilityState.checked).toBe(false)
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
  await screen.rerender(f.node({}, null))
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
  const e = {
    preventDefault: jest.fn(),
    isDefaultPrevented: () => false,
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
  await screen.rerender(
    f.node(
      { selectionMode: "multiple", selectedKeys: "all", shouldCloseOnSelect: false },
      <MenuItem id="new" testID="new">
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
  await screen.rerender(
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
  await screen.rerender(f.node({ shouldCloseOnSelect: false }, null))
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
  await screen.rerender(f.node({ order: "secondary" }, undefined, next))
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
