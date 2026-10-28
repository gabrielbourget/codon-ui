import "../../../collection/__tests__/nativeReceipts"

import { act as rawAct, cleanup, within } from "@testing-library/react-native"
import { Fragment, useState, type ComponentProps } from "react"
import { AccessibilityInfo, Animated, Easing, PlatformColor, processColor, StyleSheet } from "react-native"
import type * as RN from "react-native"

import {
  actWithNativeCollections as collectionAct,
  renderWithNativeCollections as collectionRender,
  screen,
} from "../../../collection/__tests__/nativeReceipts"
import { nativeVirtualDrag } from "../../../collection/dragAndDrop/virtualDrag"
import {
  DefaultNativeCollectionRenderer,
  NativeCollectionRendererContext,
  type TNativeCollectionRenderer,
  type TNativeCollectionRootProps,
  type TNativeCollectionDropTarget,
} from "../../../collection/renderer"
import { NativeDragActionsContext } from "../../../input/nativeDragActions"
import { Commands } from "../../../input/specs/CUIFocusViewNativeComponent"
import { NativeFloatingWindowContext } from "../../../overlays/floating/scope"
import { NativeThemeProvider as ThemeProvider } from "../../../theme"
import type { TTableSortInstruction } from "../../Table/queryTypes"
import { DEFAULT_QUERY_CONTROL_LABELS } from "../controlLabels"
import { QuerySortParameterList, type TQuerySortParameterListProps } from "../SortParameterList"

import { createSortDragFixture } from "./fixtures/SortDragFixture"

let mockDragFixture: ReturnType<typeof createSortDragFixture>
const mockViews = new Map<string, RN.View>()
const mockAttachments: { ownerId: string; attached: boolean }[] = []
jest.mock("../../../input/specs/CUIFocusViewNativeComponent", () => {
  const React = jest.requireActual<typeof import("react")>("react"),
    Native = jest.requireActual<typeof RN>("react-native")
  return {
    __esModule: true,
    default: React.forwardRef<RN.View, RN.ViewProps & { ownerId: string }>((props, ref) => {
      const latest = React.useRef(props)
      latest.current = props
      const bind = React.useCallback(
        (view: RN.View | null) => {
          mockAttachments.push({ ownerId: props.ownerId, attached: view !== null })
          if (view) {
            mockViews.set(props.ownerId, view)
            mockDragFixture.bind(view, () => latest.current)
          } else mockViews.delete(props.ownerId)
          if (typeof ref === "function") ref(view)
          else if (ref) ref.current = view
        },
        [ref, props.ownerId],
      )
      return <Native.View {...props} ref={bind} />
    }),
    Commands: {
      requestKeyboardFocus: jest.fn(),
      requestContainerFocus: jest.fn(),
      requestKeyboardBlur: jest.fn(),
      inspectAccessibility: jest.fn(),
    },
  }
})
jest.mock("../../../input/specs/NativeCUIDragAndDrop", () => ({
  __esModule: true,
  default: {
    getLease: jest.fn(() => "sort-native-module"),
    acceptsAction: jest.fn(),
    settleAction: jest.fn(),
    readGeometry: jest.fn(),
    readItems: jest.fn(),
    adoptItems: jest.fn(),
    releaseData: jest.fn(),
    readText: jest.fn(),
  },
}))
const NativeThemeProvider = (props: ComponentProps<typeof ThemeProvider>) => (
  <ThemeProvider {...props}>
    <NativeDragActionsContext.Provider value={mockDragFixture.actions}>
      {props.children}
    </NativeDragActionsContext.Provider>
  </ThemeProvider>
)
const act = async <T,>(callback: () => T | Promise<T>): Promise<T> => {
  mockDragFixture.ready()
  const value = await collectionAct(callback)
  mockDragFixture.ready()
  return value
}
const render: typeof collectionRender = async (element, options) => {
  const view = await collectionRender(element, options)
  mockDragFixture.ready()
  const rerender = view.rerender
  view.rerender = async (element) => {
    await rerender(element)
    mockDragFixture.expireFrames()
    mockDragFixture.ready()
  }
  return view
}

const rows: TTableSortInstruction[] = [
  { id: "", criteriaID: "city", criteriaName: "City", sortDirection: "Ascending" },
  { id: "name", criteriaID: "name", criteriaName: "Name", sortDirection: "Descending" },
]
const props = (): TQuerySortParameterListProps => ({
  sortParameterList: rows,
  availableSortCriteria: [],
  labels: DEFAULT_QUERY_CONTROL_LABELS.sortEntry,
  listLabels: DEFAULT_QUERY_CONTROL_LABELS.sortParameterList,
  onModifySortParameter: jest.fn(),
  onSortAscending: jest.fn(),
  onSortDescending: jest.fn(),
  onDeleteSortParameter: jest.fn(),
})
const tree = (value: TQuerySortParameterListProps = props()) => (
  <NativeThemeProvider>
    <QuerySortParameterList {...value} />
  </NativeThemeProvider>
)
type THost = ReturnType<typeof screen.getByTestId>
const option = (id = "") => screen.getByTestId(`query-sort-option-${id}`)
const tag = (host: THost) =>
  jest.requireActual<typeof RN>("react-native").findNodeHandle(mockViews.get(host.props.ownerId)!)!
const observe = async (host: THost) =>
  act(() =>
    host.props.onNativeFocusChange({
      nativeEvent: { ownerId: host.props.ownerId, target: tag(host), isFocused: true, isFocusVisible: true },
    }),
  )
const key = async (host: THost, value: string, target = tag(host), settle = true, phase: "down" | "up" = "down") => {
  let prevented = false
  const event = {
    get defaultPrevented() {
      return prevented
    },
    preventDefault: jest.fn(() => {
      prevented = true
    }),
    isDefaultPrevented: () => prevented,
    stopPropagation: jest.fn(),
    persist: jest.fn(),
    nativeEvent: {
      kind: "keyboard",
      ownerId: host.props.ownerId,
      target,
      key: value,
      nativeCode: 1,
      characters: "",
      phase,
      repeat: false,
      cancelled: false,
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      capsLock: false,
      nativeModifierData: "",
      nativeDefaultHandled: true,
      timestamp: 100,
    },
  }
  await (settle ? act : rawAct)(() => host.props.onNativeKey(event))
  if (settle && value === "Enter" && phase === "up") await act(() => jest.advanceTimersByTime(16))
  return event
}
const expectFocus = (host: THost) =>
  expect(Commands.requestKeyboardFocus).toHaveBeenLastCalledWith(mockViews.get(host.props.ownerId), host.props.ownerId)
beforeEach(() => {
  jest.useFakeTimers()
  jest.clearAllMocks()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
  mockViews.clear()
  mockAttachments.length = 0
  mockDragFixture = createSortDragFixture(mockViews)
  const native = jest.requireActual<typeof RN>("react-native"),
    base = jest.mocked(native.findNodeHandle).getMockImplementation()!,
    tags = new WeakMap<object, number>()
  let next = 700
  jest.mocked(native.findNodeHandle).mockImplementation((view) => {
    if (!view || typeof view !== "object") return base(view)
    if (!tags.has(view)) {
      const original = base(view)
      tags.set(view, original && original >= 1000000 ? original : ++next)
    }
    return tags.get(view)!
  })
})
afterEach(async () => {
  await nativeVirtualDrag.cancel()
  await cleanup()
  mockDragFixture.dispose()
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})

it("renders the complete empty/string-key collection with original list/item semantics and exact native bindings", async () => {
  await render(tree())
  const root = screen.getByTestId("query-sort-list")
  expect(root.props.role).toBe("list")
  expect(JSON.parse(root.props.nativeCollectionSemantics)).toEqual({ kind: "list-root", count: 2 })
  for (const [index, id] of ["", "name"].entries()) {
    const row = option(id)
    expect(row.props.role).toBe("option")
    expect(row.props.accessibilityState?.selected).toBeUndefined()
    expect(JSON.parse(row.props.nativeCollectionSemantics)).toEqual({
      kind: "list-item",
      parentTarget: tag(root),
      ordinal: index,
    })
    expect(JSON.parse(row.props.nativeCollectionBinding).descriptorId).not.toBe("")
  }
  expect(option().props.accessibilityLabel).toBe("Sort Parameter - City - Ascending")
  expect(option()).toHaveStyle({ minHeight: 20, width: "100%" })
  await rawAct(() =>
    root.props.onNativeFocusChange({
      nativeEvent: { ownerId: root.props.ownerId, target: tag(root), isFocused: true, isFocusVisible: true },
    }),
  )
  const request = screen.container
    .queryAll((host) => typeof host.props.rootRevision === "string")
    .flatMap((host) => JSON.parse(host.props.actionRequests ?? "[]"))
  expect(request[0].binding).toBe(root.props.nativeCollectionBinding)
  await act(() => {})
  expectFocus(option())
})
it("navigates without wrapping or selection and retains the original option focus targets", async () => {
  await render(tree())
  await observe(option())
  await key(option(), "ArrowDown")
  expectFocus(option("name"))
  await observe(option("name"))
  const count = jest.mocked(Commands.requestKeyboardFocus).mock.calls.length
  await key(option("name"), "ArrowDown")
  expect(Commands.requestKeyboardFocus).toHaveBeenCalledTimes(count)
  await key(option("name"), "Home")
  expectFocus(option())
  await observe(option())
  await key(option(), "ArrowUp")
  expectFocus(option())
  await key(option(), "End")
  expectFocus(option("name"))
})
it("admits nested button arrows against their original option and leaves the button action separate", async () => {
  const value = props()
  await render(tree(value))
  const host = option(),
    buttons = within(host).getAllByRole("button"),
    original = mockViews.get(host.props.ownerId)!
  Object.defineProperty(original, "childNodes", {
    configurable: true,
    value: buttons.map((button) => mockViews.get(button.props.ownerId)!),
  })
  await observe(host)
  await key(host, "ArrowDown", tag(buttons[1]))
  expectFocus(option("name"))
  expect(value.onSortDescending).not.toHaveBeenCalled()
  expect(value.onDeleteSortParameter).not.toHaveBeenCalled()
})
it("retires pending key admission when its original window becomes inactive", async () => {
  let active = true
  await render(
    <NativeFloatingWindowContext.Provider value={() => active}>{tree()}</NativeFloatingWindowContext.Provider>,
  )
  await observe(option())
  await key(option(), "ArrowDown", tag(option()), false)
  active = false
  await act(() => {})
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
})
it("preserves original option refs and owner order through reorder and label updates", async () => {
  const value = props(),
    view = await render(tree(value))
  const original = mockViews.get(option().props.ownerId)
  await view.rerender(tree({ ...value, sortParameterList: [rows[1], { ...rows[0], sortDirection: "Descending" }] }))
  expect(mockViews.get(option().props.ownerId)).toBe(original)
  expect(JSON.parse(option().props.nativeCollectionSemantics).ordinal).toBe(1)
  expect(option().props.accessibilityLabel).toBe("Sort Parameter - City - Descending")
  expect(rows[0].sortDirection).toBe("Ascending")
})

it("uses the current caller availability guard without an extra focus backend", async () => {
  let active = true
  await render(tree({ ...props(), canAct: () => active }))
  await observe(option())
  active = false
  await key(option(), "ArrowDown")
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
})

const background = () => StyleSheet.flatten(option().props.style).backgroundColor ?? "transparent"
it("keeps unselectable sort options free of hover state and changes only the actual focused item", async () => {
  await render(tree())
  const first = option(),
    original = mockViews.get(first.props.ownerId)
  expect(first.props.onPointerEnter).toBeUndefined()
  expect(processColor(background())).toBe(processColor("transparent"))
  await observe(first)
  expect(processColor(background())).toBe(processColor("#efefef"))
  await observe(option("name"))
  expect(processColor(background())).toBe(processColor("transparent"))
  expect(first.props.accessibilityState?.selected).toBeUndefined()
  expect(mockViews.get(option().props.ownerId)).toBe(original)
})
it("uses the source 250ms ease-in-out focus transition and interrupts it at the current core Animated color", async () => {
  jest.mocked(AccessibilityInfo.isReduceMotionEnabled).mockResolvedValue(false)
  const timing = jest.spyOn(Animated, "timing")
  await render(tree())
  await observe(option())
  expect(timing).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ duration: 250, delay: 0, useNativeDriver: false, isInteraction: false }),
  )
  expect(timing.mock.calls.at(-1)![1].easing?.(0.25)).toBeCloseTo(Easing.bezier(0.42, 0, 0.58, 1)(0.25))
  await act(() => jest.advanceTimersByTime(125))
  const midpoint = processColor(background())
  expect(midpoint).not.toBe(processColor("transparent"))
  expect(midpoint).not.toBe(processColor("#efefef"))
  await observe(option("name"))
  expect(processColor(background())).toBe(midpoint)
  await act(() => jest.advanceTimersByTime(300))
  expect(processColor(background())).toBe(processColor("transparent"))
})

it("uses current theme colors and opaque native colors without replacing the sort option", async () => {
  const nativeColor = PlatformColor("systemBlueColor")
  const node = (mode: "light" | "dark", color?: RN.ColorValue) => (
    <NativeThemeProvider mode={mode} overrides={color ? { colors: { controlHoverBackground: color } } : undefined}>
      <QuerySortParameterList {...props()} />
    </NativeThemeProvider>
  )
  const view = await render(node("light"))
  await observe(option())
  const original = mockViews.get(option().props.ownerId)
  const commands = jest.mocked(Commands.requestKeyboardFocus).mock.calls.length
  await view.rerender(node("dark"))
  expect(processColor(background())).toBe(processColor("#2c2c2c"))
  await view.rerender(node("dark", nativeColor))
  expect(background()).toEqual(nativeColor)
  expect(Commands.requestKeyboardFocus).toHaveBeenCalledTimes(commands)
  expect(mockViews.get(option().props.ownerId)).toBe(original)
})

it("keeps a physical sort option attached across current metadata updates and detaches on actual removal", async () => {
  const value = props()
  const view = await render(tree(value))
  const ownerId = option().props.ownerId
  const original = mockViews.get(ownerId)
  mockAttachments.length = 0
  await view.rerender(tree({ ...value, sortParameterList: [rows[1], { ...rows[0], criteriaName: "Current City" }] }))
  expect(mockViews.get(ownerId) === original).toBe(true)
  expect(mockAttachments.filter((event) => event.ownerId === ownerId && !event.attached)).toHaveLength(0)
  await observe(option())
  await key(option(), "ArrowUp")
  expectFocus(option("name"))
  await view.rerender(tree({ ...value, sortParameterList: [rows[1]] }))
  expect(mockAttachments.filter((event) => event.ownerId === ownerId && !event.attached)).toHaveLength(1)
})

it("reorders on Enter release through the native collection admission while a held owner keeps its order", async () => {
  const onReorder = jest.fn()
  await render(tree({ ...props(), onReorder }))
  const original = mockViews.get(option().props.ownerId)
  await observe(option())
  await key(option(), "Enter")
  expect(screen.queryByTestId("query-sort-drop-indicator")).toBeNull()
  await key(option(), "Enter", tag(option()), true, "up")
  expect(screen.getByTestId("query-sort-drop-indicator")).toBeOnTheScreen()
  expect(onReorder).not.toHaveBeenCalled()
  await key(option(), "Enter", tag(option()), true, "up")
  expect(onReorder).toHaveBeenCalledTimes(1)
  expect(onReorder).toHaveBeenCalledWith("", "name", "after")
  expect(JSON.parse(option().props.nativeCollectionSemantics).ordinal).toBe(0)
  expect(mockViews.get(option().props.ownerId)).toBe(original)
  expectFocus(option())
  expect(screen.queryByTestId("query-sort-drop-indicator")).toBeNull()
})

it("navigates valid insertion positions, holds Tab in the single collection and cancels with Escape", async () => {
  const onReorder = jest.fn()
  const third = { ...rows[1], id: "third", criteriaID: "third", criteriaName: "Third" }
  await render(tree({ ...props(), onReorder, sortParameterList: [...rows, third] }))
  await observe(option("name"))
  await key(option("name"), "Enter", tag(option("name")), true, "up")
  await key(option("name"), "Home")
  expect(within(option()).getByTestId("query-sort-drop-indicator")).toBeOnTheScreen()
  await key(option("name"), "Tab")
  await key(option("name"), "Enter", tag(option("name")), true, "up")
  expect(onReorder).toHaveBeenCalledWith("name", "", "before")
  await key(option("name"), "Enter", tag(option("name")), true, "up")
  await key(option("name"), "ArrowDown")
  await key(option("name"), "ArrowUp")
  await key(option("name"), "Escape")
  expect(onReorder).toHaveBeenCalledTimes(1)
  expect(screen.queryByTestId("query-sort-drop-indicator")).toBeNull()
  expectFocus(option("name"))
})

it("leaves nested button Enter and an unconfigured list outside the reorder interaction", async () => {
  const onReorder = jest.fn()
  const value = props()
  const view = await render(tree({ ...value, onReorder }))
  const button = within(option()).getAllByRole("button")[1]
  await key(option(), "Enter", tag(button), true, "up")
  expect(screen.queryByTestId("query-sort-drop-indicator")).toBeNull()
  expect(onReorder).not.toHaveBeenCalled()
  await view.rerender(tree(value))
  await key(option(), "Enter", tag(option()), true, "up")
  expect(screen.queryByTestId("query-sort-drop-indicator")).toBeNull()
  expect(option().props.accessibilityActions).toBeUndefined()
})

it("drops before and after current targets through the actual native accessibility action", async () => {
  const onReorder = jest.fn()
  await render(tree({ ...props(), onReorder }))
  const begin = async (id: string) =>
    act(() => option(id).props.onAccessibilityAction({ nativeEvent: { actionName: "activate" } }))
  const drop = async () => {
    const host = screen.getByTestId("query-sort-drop-indicator")
    await act(() =>
      host.props.onNativeActivation({
        nativeEvent: {
          ownerId: host.props.ownerId,
          target: tag(host),
          activationId: 1,
          kind: "activation",
          source: "ios-accessibility-activate",
          scopeOwnerId: "sort-drag-owner",
          windowId: "sort-window",
          epoch: 1,
        },
      }),
    )
  }
  await begin("")
  await drop()
  expect(onReorder).toHaveBeenLastCalledWith("", "name", "after")
  await begin("name")
  await drop()
  expect(onReorder).toHaveBeenLastCalledWith("name", "", "before")
  await begin("")
  await begin("")
  expect(onReorder).toHaveBeenCalledTimes(2)
})

const measureView = (host: THost, implementation: RN.View["measureInWindow"]) => {
  const view = mockViews.get(host.props.ownerId)!
  const measurement = jest.fn(implementation)
  Object.defineProperty(view, "measureInWindow", { configurable: true, value: measurement })
  mockDragFixture.setRect(view, () => {
    let result = mockDragFixture.rectangleFallback(view)
    implementation((x, y, width, height) => {
      result = { x, y, width, height }
    })
    return result
  })
  return measurement
}
const rect = (
  id: string,
  value:
    | { x: number; y: number; width: number; height: number }
    | (() => { x: number; y: number; width: number; height: number }),
) => mockDragFixture.setRect(mockViews.get(screen.getByTestId(id).props.ownerId)!, value)
const measureRows = () => {
  for (const [index, id] of ["", "name"].entries())
    rect(`query-sort-option-${id}`, { x: 0, y: index * 100, width: 200, height: 80 })
}
const source = async () => act(() => mockDragFixture.lift(10, 10))
const release = async (x = 10, y = 170) => act(() => mockDragFixture.drop(x, y))

it("uses the renderer drop delegate in current list coordinates without measuring every row", async () => {
  const onReorder = jest.fn()
  const delegate = {
    getDropTargetFromPoint: jest.fn(
      (
        _x: number,
        _y: number,
        isValid?: (target: TNativeCollectionDropTarget) => boolean,
      ): TNativeCollectionDropTarget => {
        expect(isValid?.({ type: "item", key: "", dropPosition: "before" })).toBe(false)
        expect(isValid?.({ type: "item", key: "name", dropPosition: "after" })).toBe(true)
        return { type: "item", key: "name", dropPosition: "after" }
      },
    ),
  }
  await render(
    <NativeCollectionRendererContext.Provider
      value={{ ...DefaultNativeCollectionRenderer, dropTargetDelegate: delegate }}
    >
      {tree({ ...props(), onReorder })}
    </NativeCollectionRendererContext.Provider>,
  )
  measureView(screen.getByTestId("query-sort-list"), (callback) => callback(100, 200, 240, 220))
  const rowMeasures = ["", "name"].map((id) => measureView(option(id), () => {}))
  await act(() => mockDragFixture.lift(110, 210))
  await act(() => mockDragFixture.move(110, 370))
  expect(delegate.getDropTargetFromPoint).toHaveBeenLastCalledWith(10, 170, expect.any(Function))
  for (const measured of rowMeasures) expect(measured).not.toHaveBeenCalled()
  await release(110, 370)
  expect(onReorder).toHaveBeenCalledWith("", "name", "after")
})

it("persists dragged and logical target keys and waits for an original virtual target before admission", async () => {
  let received: TNativeCollectionRootProps
  let materialize: (key: string) => void = () => {}
  const requestRendering = jest.fn(),
    onReorder = jest.fn()
  const Root = (value: TNativeCollectionRootProps) => {
    received = value
    const [visible, setVisible] = useState(new Set([""]))
    materialize = (key) => setVisible((prior) => new Set([...prior, key]))
    return (
      <>
        {Array.from(value.collection)
          .filter((node) => visible.has(String(node.key)))
          .map((node) => (
            <Fragment key={String(node.key)}>{node.render?.(node)}</Fragment>
          ))}
      </>
    )
  }
  const renderer: TNativeCollectionRenderer = {
    ...DefaultNativeCollectionRenderer,
    isVirtualized: true,
    CollectionRoot: Root,
    layoutDelegate: {
      getContentSize: () => ({ width: 240, height: 220 }),
      getVisibleRect: () => ({ x: 0, y: 0, width: 240, height: 220 }),
      getItemRect: (key) =>
        key === "" || key === "name" ? { x: 0, y: key === "" ? 0 : 100, width: 240, height: 80 } : null,
      requestRendering,
    },
    dropTargetDelegate: {
      getDropTargetFromPoint: (): TNativeCollectionDropTarget => ({ type: "item", key: "name", dropPosition: "after" }),
    },
  }
  await render(
    <NativeCollectionRendererContext.Provider value={renderer}>
      {tree({ ...props(), onReorder })}
    </NativeCollectionRendererContext.Provider>,
  )
  rect("query-sort-list", { x: 100, y: 200, width: 240, height: 220 })
  const original = mockViews.get(option().props.ownerId)
  expect(screen.queryByTestId("query-sort-option-name")).toBeNull()
  await act(() => mockDragFixture.lift(110, 210))
  await release(110, 370)
  expect(received!.persistedKeys).toEqual(new Set(["", "name"]))
  expect(requestRendering).toHaveBeenCalledTimes(1)
  expect(requestRendering).toHaveBeenCalledWith("name")
  expect(onReorder).not.toHaveBeenCalled()
  await act(() => materialize("name"))
  expect(onReorder).toHaveBeenCalledTimes(1)
  expect(onReorder).toHaveBeenCalledWith("", "name", "after")
  expect(mockViews.get(option().props.ownerId)).toBe(original)
})

it.each(["on", "root", "foreign"])("rejects a renderer delegate's inadmissible %s target", async (kind) => {
  const onReorder = jest.fn()
  const result: TNativeCollectionDropTarget =
    kind === "root"
      ? { type: "root" }
      : {
          type: "item",
          key: kind === "foreign" ? "missing" : "name",
          dropPosition: kind === "foreign" ? "after" : "on",
        }
  await render(
    <NativeCollectionRendererContext.Provider
      value={{ ...DefaultNativeCollectionRenderer, dropTargetDelegate: { getDropTargetFromPoint: () => result } }}
    >
      {tree({ ...props(), onReorder })}
    </NativeCollectionRendererContext.Provider>,
  )
  await source()
  await release()
  expect(onReorder).not.toHaveBeenCalled()
  expect(screen.queryByTestId("query-sort-drop-indicator")).toBeNull()
})

it("waits for the latest renderer viewport measurement before admitting a released target", async () => {
  const onReorder = jest.fn(),
    delegate = {
      getDropTargetFromPoint: jest.fn(
        (): TNativeCollectionDropTarget => ({ type: "item", key: "name", dropPosition: "after" }),
      ),
    }
  await render(
    <NativeCollectionRendererContext.Provider
      value={{ ...DefaultNativeCollectionRenderer, dropTargetDelegate: delegate }}
    >
      {tree({ ...props(), onReorder })}
    </NativeCollectionRendererContext.Provider>,
  )
  await source()
  const older = mockDragFixture.frame("target", 10, 170)
  rect("query-sort-list", { x: 0, y: 300, width: 200, height: 200 })
  const current = mockDragFixture.frame("target", 10, 470)
  expect(() => mockDragFixture.dispatch(older)).toThrow("authority")
  expect(delegate.getDropTargetFromPoint).not.toHaveBeenCalled()
  expect(onReorder).not.toHaveBeenCalled()
  await act(() => mockDragFixture.dispatch(current))
  expect(delegate.getDropTargetFromPoint).toHaveBeenLastCalledWith(10, 170, expect.any(Function))
  await release(10, 470)
  expect(onReorder).toHaveBeenCalledTimes(1)
  expect(onReorder).toHaveBeenCalledWith("", "name", "after")
})

it("retires a pending renderer measurement when its original drop delegate is replaced", async () => {
  const onReorder = jest.fn(),
    original = jest.fn((): TNativeCollectionDropTarget => ({ type: "item", key: "name", dropPosition: "after" })),
    next = jest.fn(original.getMockImplementation()!)
  const value = { ...props(), onReorder }
  const withDelegate = (getDropTargetFromPoint: typeof original) => (
    <NativeCollectionRendererContext.Provider
      value={{ ...DefaultNativeCollectionRenderer, dropTargetDelegate: { getDropTargetFromPoint } }}
    >
      {tree(value)}
    </NativeCollectionRendererContext.Provider>
  )
  const view = await render(withDelegate(original))
  await source()
  const frame = mockDragFixture.frame("target", 10, 170),
    originalView = mockViews.get(option().props.ownerId)
  await view.rerender(withDelegate(next))
  expect(mockViews.get(option().props.ownerId)).toBe(originalView)
  expect(() => mockDragFixture.dispatch(frame)).toThrow("authority")
  expect(original).not.toHaveBeenCalled()
  expect(next).not.toHaveBeenCalled()
  expect(onReorder).not.toHaveBeenCalled()
  expect(screen.queryByTestId("query-sort-drop-indicator")).toBeNull()
})

it("uses original native action admission and measured targets for a pointer reorder", async () => {
  const onReorder = jest.fn()
  await render(tree({ ...props(), onReorder }))
  measureRows()
  // The approved native observer retains the original JS responder/default owner.
  expect(option().props.onStartShouldSetResponderCapture).toBeUndefined()
  expect(option().props.onMoveShouldSetResponder).toBeUndefined()
  await source()
  await act(() => mockDragFixture.move(10, 170))
  expect(onReorder).not.toHaveBeenCalled()
  await release()
  expect(onReorder).toHaveBeenCalledTimes(1)
  expect(onReorder).toHaveBeenCalledWith("", "name", "after")
})

it("remeasures original rows after their window positions change during a pointer drag", async () => {
  const onReorder = jest.fn()
  await render(tree({ ...props(), onReorder }))
  let offset = 0
  rect("query-sort-list", () => ({ x: 0, y: offset, width: 200, height: 200 }))
  for (const [index, id] of ["", "name"].entries())
    rect(`query-sort-option-${id}`, () => ({ x: 0, y: offset + index * 100, width: 200, height: 80 }))
  await source()
  await act(() => mockDragFixture.move(10, 170))
  offset = 200
  await release(10, 370)
  expect(onReorder).toHaveBeenCalledTimes(1)
  expect(onReorder).toHaveBeenCalledWith("", "name", "after")
})

it("waits for the latest complete release measurements and rejects an older pointer batch", async () => {
  const onReorder = jest.fn()
  await render(tree({ ...props(), onReorder }))
  measureRows()
  await source()
  const older = mockDragFixture.frame("drop", 10, 170, "", { dataHandle: "sort-native-module:old" })
  rect("query-sort-list", { x: 0, y: 400, width: 200, height: 200 })
  rect("query-sort-option-", { x: 0, y: 400, width: 200, height: 80 })
  rect("query-sort-option-name", { x: 0, y: 500, width: 200, height: 80 })
  const current = mockDragFixture.frame("target", 10, 570)
  expect(JSON.parse(older.encoded).payload.geometry.items).toHaveLength(2)
  expect(JSON.parse(current.encoded).payload.geometry.items).toHaveLength(2)
  expect(() => mockDragFixture.dispatch(older)).toThrow("authority")
  expect(onReorder).not.toHaveBeenCalled()
  await act(() => mockDragFixture.dispatch(current))
  await release(10, 570)
  expect(onReorder).toHaveBeenCalledTimes(1)
  expect(onReorder).toHaveBeenCalledWith("", "name", "after")
})

it("cancels a release with invalid current geometry instead of using the old complete rectangles", async () => {
  const onReorder = jest.fn()
  await render(tree({ ...props(), onReorder }))
  measureRows()
  await source()
  await act(() => mockDragFixture.move(10, 170))
  expect(screen.getByTestId("query-sort-drop-indicator")).toBeTruthy()
  for (const [index, id] of ["", "name"].entries())
    rect(`query-sort-option-${id}`, { x: 0, y: index * 100, width: 200, height: 0 })
  await release()
  expect(onReorder).not.toHaveBeenCalled()
  expect(screen.queryByTestId("query-sort-drop-indicator")).toBeNull()
})

it("retains original release coordinates until admission and measurement complete", async () => {
  const onReorder = jest.fn()
  await render(tree({ ...props(), onReorder }))
  measureRows()
  await source()
  const read = mockDragFixture.native.readItems.getMockImplementation()!
  let complete: (() => void) | undefined
  mockDragFixture.native.readItems.mockImplementationOnce(
    (request) =>
      new Promise<string>((resolve) => {
        complete = () => {
          Promise.resolve(read(request)).then(resolve)
        }
      }),
  )
  await release()
  expect(onReorder).not.toHaveBeenCalled()
  rect("query-sort-option-name", { x: 0, y: 500, width: 200, height: 80 })
  await act(() => {})
  expect(onReorder).not.toHaveBeenCalled()
  await act(() => complete!())
  expect(onReorder).toHaveBeenCalledTimes(1)
  expect(onReorder).toHaveBeenCalledWith("", "name", "after")
})

it.each(["outside", "terminate", "multitouch"])(
  "cancels a %s pointer drop without changing the query",
  async (reason) => {
    const onReorder = jest.fn()
    await render(tree({ ...props(), onReorder }))
    measureRows()
    await source()
    if (reason === "outside") await act(() => mockDragFixture.send("exit", 250, 170))
    await act(() => mockDragFixture.cancel())
    expect(onReorder).not.toHaveBeenCalled()
  },
)

it("retires a queued drop after owner close or original source removal", async () => {
  const onReorder = jest.fn()
  let open = true
  const value = { ...props(), onReorder, canAct: () => open },
    view = await render(tree(value))
  await key(option(), "Enter", tag(option()), true, "up")
  await key(option(), "Enter", tag(option()), false, "up")
  open = false
  await act(() => {})
  expect(onReorder).not.toHaveBeenCalled()
  open = true
  await key(option(), "Enter", tag(option()), true, "up")
  await view.rerender(tree({ ...value, sortParameterList: [rows[1]] }))
  await key(option("name"), "Enter", tag(option("name")), true, "up")
  expect(onReorder).not.toHaveBeenCalled()
})
