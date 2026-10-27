import "../../../collection/__tests__/nativeReceipts"

import { act as rawAct, cleanup, within } from "@testing-library/react-native"
import { Fragment, useState } from "react"
import { AccessibilityInfo, Animated, Easing, PlatformColor, processColor, StyleSheet } from "react-native"
import type * as RN from "react-native"

import {
  actWithNativeCollections as act,
  renderWithNativeCollections as render,
  screen,
} from "../../../collection/__tests__/nativeReceipts"
import {
  DefaultNativeCollectionRenderer,
  NativeCollectionRendererContext,
  type TNativeCollectionRenderer,
  type TNativeCollectionRootProps,
  type TNativeCollectionDropTarget,
} from "../../../collection/renderer"
import { Commands } from "../../../input/specs/CUIFocusViewNativeComponent"
import { NativeFloatingWindowContext } from "../../../overlays/floating/scope"
import { NativeThemeProvider } from "../../../theme"
import type { TTableSortInstruction } from "../../Table/queryTypes"
import { DEFAULT_QUERY_CONTROL_LABELS } from "../controlLabels"
import { QuerySortParameterList, type TQuerySortParameterListProps } from "../SortParameterList"

const mockViews = new Map<string, RN.View>()
const mockAttachments: { ownerId: string; attached: boolean }[] = []
jest.mock("../../../input/specs/CUIFocusViewNativeComponent", () => {
  const React = jest.requireActual<typeof import("react")>("react"),
    Native = jest.requireActual<typeof RN>("react-native")
  return {
    __esModule: true,
    default: React.forwardRef<RN.View, RN.ViewProps & { ownerId: string }>((props, ref) => {
      const bind = React.useCallback(
        (view: RN.View | null) => {
          mockAttachments.push({ ownerId: props.ownerId, attached: view !== null })
          if (view) mockViews.set(props.ownerId, view)
          else mockViews.delete(props.ownerId)
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
  await cleanup()
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
  const action = async (id: string, actionName: string) =>
    act(() => option(id).props.onAccessibilityAction({ nativeEvent: { actionName } }))
  await action("", "activate")
  await action("name", "dropAfter")
  expect(onReorder).toHaveBeenLastCalledWith("", "name", "after")
  await action("name", "activate")
  await action("", "dropBefore")
  expect(onReorder).toHaveBeenLastCalledWith("name", "", "before")
  await action("", "activate")
  await action("", "escape")
  expect(onReorder).toHaveBeenCalledTimes(2)
})

const pointer = (x: number, y: number, timestamp = 1, touches = 1) => ({
  nativeEvent: {
    pageX: x,
    pageY: y,
    touches: Array.from({ length: touches }, (_, identifier) => ({ identifier, pageX: x, pageY: y, timestamp })),
  },
  touchHistory: {
    indexOfSingleActiveTouch: 0,
    numberActiveTouches: touches,
    mostRecentTimeStamp: timestamp,
    touchBank: [
      {
        touchActive: true,
        startPageX: 10,
        startPageY: 10,
        startTimeStamp: 0,
        previousPageX: 10,
        previousPageY: 10,
        previousTimeStamp: 0,
        currentPageX: x,
        currentPageY: y,
        currentTimeStamp: timestamp,
      },
    ],
  },
})
const measureView = (host: THost, implementation: RN.View["measureInWindow"]) => {
  const measurement = jest.fn(implementation)
  // The native preset shares these methods across View instances.
  Object.defineProperty(mockViews.get(host.props.ownerId)!, "measureInWindow", {
    configurable: true,
    value: measurement,
  })
  return measurement
}
const measureRows = () => {
  for (const [index, id] of ["", "name"].entries()) {
    measureView(option(id), (callback) => callback(0, index * 100, 200, 80))
  }
}

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
  const root = screen.getByTestId("query-sort-list")
  measureView(root, (callback) => callback(100, 200, 240, 220))
  const rowMeasures = ["", "name"].map((id) => measureView(option(id), () => {}))
  const source = option()
  await act(() => {
    source.props.onStartShouldSetResponderCapture(pointer(110, 210))
    source.props.onResponderGrant(pointer(110, 210))
  })
  await act(() => source.props.onResponderMove(pointer(110, 370, 2)))
  expect(delegate.getDropTargetFromPoint).toHaveBeenLastCalledWith(10, 170, expect.any(Function))
  for (const measured of rowMeasures) expect(measured).not.toHaveBeenCalled()
  await act(() => source.props.onResponderRelease(pointer(110, 370, 3)))
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
  const root = screen.getByTestId("query-sort-list")
  measureView(root, (callback) => callback(100, 200, 240, 220))
  const source = option(),
    original = mockViews.get(source.props.ownerId)
  expect(screen.queryByTestId("query-sort-option-name")).toBeNull()
  await act(() => {
    source.props.onStartShouldSetResponderCapture(pointer(110, 210))
    source.props.onResponderGrant(pointer(110, 210))
  })
  await act(() => source.props.onResponderRelease(pointer(110, 370, 2)))
  expect(received!.persistedKeys).toEqual(new Set(["", "name"]))
  expect(requestRendering).toHaveBeenCalledTimes(1)
  expect(requestRendering).toHaveBeenCalledWith("name")
  expect(onReorder).not.toHaveBeenCalled()
  await act(() => materialize("name"))
  expect(onReorder).toHaveBeenCalledTimes(1)
  expect(onReorder).toHaveBeenCalledWith("", "name", "after")
  expect(mockViews.get(source.props.ownerId)).toBe(original)
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
  const root = screen.getByTestId("query-sort-list")
  measureView(root, (callback) => callback(0, 0, 200, 200))
  const source = option()
  await act(() => {
    source.props.onStartShouldSetResponderCapture(pointer(10, 10))
    source.props.onResponderGrant(pointer(10, 10))
  })
  await act(() => source.props.onResponderRelease(pointer(10, 170, 2)))
  expect(onReorder).not.toHaveBeenCalled()
  expect(screen.queryByTestId("query-sort-drop-indicator")).toBeNull()
})

it("waits for the latest renderer viewport measurement before admitting a released target", async () => {
  const onReorder = jest.fn()
  const delegate = {
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
  const pending: (() => void)[] = []
  let offset = 0
  measureView(screen.getByTestId("query-sort-list"), (callback) => {
    const top = offset
    pending.push(() => callback(0, top, 200, 200))
  })
  const source = option()
  await act(() => {
    source.props.onStartShouldSetResponderCapture(pointer(10, 10))
    source.props.onResponderGrant(pointer(10, 10))
  })
  const older = pending.splice(0)
  offset = 300
  await act(() => source.props.onResponderRelease(pointer(10, 470, 2)))
  const current = pending.splice(0)
  expect(older).toHaveLength(1)
  expect(current).toHaveLength(1)
  await act(() => older[0]!())
  expect(delegate.getDropTargetFromPoint).not.toHaveBeenCalled()
  expect(onReorder).not.toHaveBeenCalled()
  await act(() => current[0]!())
  expect(delegate.getDropTargetFromPoint).toHaveBeenLastCalledWith(10, 170, expect.any(Function))
  expect(onReorder).toHaveBeenCalledTimes(1)
  expect(onReorder).toHaveBeenCalledWith("", "name", "after")
})

it("retires a pending renderer measurement when its original drop delegate is replaced", async () => {
  const onReorder = jest.fn()
  const original = jest.fn((): TNativeCollectionDropTarget => ({ type: "item", key: "name", dropPosition: "after" }))
  const next = jest.fn(original.getMockImplementation()!)
  const value = { ...props(), onReorder }
  const withDelegate = (getDropTargetFromPoint: typeof original) => (
    <NativeCollectionRendererContext.Provider
      value={{ ...DefaultNativeCollectionRenderer, dropTargetDelegate: { getDropTargetFromPoint } }}
    >
      {tree(value)}
    </NativeCollectionRendererContext.Provider>
  )
  const view = await render(withDelegate(original))
  const pending: (() => void)[] = []
  measureView(screen.getByTestId("query-sort-list"), (callback) => pending.push(() => callback(0, 0, 200, 200)))
  const source = option(),
    originalView = mockViews.get(source.props.ownerId)
  await act(() => {
    source.props.onStartShouldSetResponderCapture(pointer(10, 10))
    source.props.onResponderGrant(pointer(10, 10))
    source.props.onResponderRelease(pointer(10, 170, 2))
  })
  expect(pending).toHaveLength(1)
  await view.rerender(withDelegate(next))
  expect(mockViews.get(option().props.ownerId)).toBe(originalView)
  await act(() => pending.splice(0).forEach((measure) => measure()))
  expect(original).not.toHaveBeenCalled()
  expect(next).not.toHaveBeenCalled()
  expect(onReorder).not.toHaveBeenCalled()
  expect(screen.queryByTestId("query-sort-drop-indicator")).toBeNull()
})

it("uses the real responder and measured original targets for a pointer reorder", async () => {
  const onReorder = jest.fn()
  await render(tree({ ...props(), onReorder }))
  measureRows()
  const source = option()
  await act(() => {
    expect(source.props.onStartShouldSetResponderCapture(pointer(10, 10))).toBe(false)
    source.props.onMoveShouldSetResponderCapture(pointer(10, 20, 2))
    expect(source.props.onMoveShouldSetResponder(pointer(10, 20, 2))).toBe(true)
    source.props.onResponderGrant(pointer(10, 20, 2))
  })
  await act(() => source.props.onResponderMove(pointer(10, 170, 3)))
  expect(onReorder).not.toHaveBeenCalled()
  await act(() => source.props.onResponderRelease(pointer(10, 170, 4)))
  expect(onReorder).toHaveBeenCalledTimes(1)
  expect(onReorder).toHaveBeenCalledWith("", "name", "after")
})

it("remeasures original rows after their window positions change during a pointer drag", async () => {
  const onReorder = jest.fn()
  await render(tree({ ...props(), onReorder }))
  let offset = 0
  for (const [index, id] of ["", "name"].entries())
    measureView(option(id), (callback) => callback(0, offset + index * 100, 200, 80))
  const source = option()
  await act(() => {
    source.props.onStartShouldSetResponderCapture(pointer(10, 10))
    source.props.onResponderGrant(pointer(10, 10))
  })
  await act(() => source.props.onResponderMove(pointer(10, 170, 2)))
  offset = 200
  await act(() => source.props.onResponderRelease(pointer(10, 370, 3)))
  expect(onReorder).toHaveBeenCalledTimes(1)
  expect(onReorder).toHaveBeenCalledWith("", "name", "after")
})

it("waits for the latest complete release measurements and rejects an older pointer batch", async () => {
  const onReorder = jest.fn()
  await render(tree({ ...props(), onReorder }))
  const pending: (() => void)[] = []
  let offset = 0
  for (const [index, id] of ["", "name"].entries())
    measureView(option(id), (callback) => {
      const y = offset + index * 100
      pending.push(() => callback(0, y, 200, 80))
    })
  const source = option()
  await act(() => {
    source.props.onStartShouldSetResponderCapture(pointer(10, 10))
    source.props.onResponderGrant(pointer(10, 10))
  })
  await act(() => pending.splice(0).forEach((measure) => measure()))
  offset = 200
  await act(() => source.props.onResponderMove(pointer(10, 370, 2)))
  const older = pending.splice(0)
  offset = 400
  await act(() => source.props.onResponderRelease(pointer(10, 570, 3)))
  const current = pending.splice(0)
  expect(older).toHaveLength(2)
  expect(current).toHaveLength(2)
  await act(() => older.forEach((measure) => measure()))
  expect(onReorder).not.toHaveBeenCalled()
  await act(() => current[0]!())
  expect(onReorder).not.toHaveBeenCalled()
  await act(() => current[1]!())
  expect(onReorder).toHaveBeenCalledTimes(1)
  expect(onReorder).toHaveBeenCalledWith("", "name", "after")
})

it("cancels a release with invalid current geometry instead of using the old complete rectangles", async () => {
  const onReorder = jest.fn()
  await render(tree({ ...props(), onReorder }))
  let invalid = false
  for (const [index, id] of ["", "name"].entries())
    measureView(option(id), (callback) => callback(0, index * 100, 200, invalid ? 0 : 80))
  const source = option()
  await act(() => {
    source.props.onStartShouldSetResponderCapture(pointer(10, 10))
    source.props.onResponderGrant(pointer(10, 10))
  })
  await act(() => source.props.onResponderMove(pointer(10, 170, 2)))
  expect(screen.getByTestId("query-sort-drop-indicator")).toBeTruthy()
  invalid = true
  await act(() => source.props.onResponderRelease(pointer(10, 170, 3)))
  expect(onReorder).not.toHaveBeenCalled()
  expect(screen.queryByTestId("query-sort-drop-indicator")).toBeNull()
})

it("retains original release coordinates until admission and measurement complete", async () => {
  const onReorder = jest.fn()
  await render(tree({ ...props(), onReorder }))
  const measurements: (() => void)[] = []
  for (const [index, id] of ["", "name"].entries())
    measureView(option(id), (callback) => measurements.push(() => callback(0, index * 100, 200, 80)))
  const source = option()
  await rawAct(() => {
    source.props.onStartShouldSetResponderCapture(pointer(10, 10))
    source.props.onResponderGrant(pointer(10, 10))
    source.props.onResponderRelease(pointer(10, 170, 2))
  })
  expect(onReorder).not.toHaveBeenCalled()
  await act(() => {})
  expect(onReorder).not.toHaveBeenCalled()
  await act(() => measurements.forEach((measure) => measure()))
  expect(onReorder).toHaveBeenCalledTimes(1)
  expect(onReorder).toHaveBeenCalledWith("", "name", "after")
})

it.each(["outside", "terminate", "multitouch"])(
  "cancels a %s pointer drop without changing the query",
  async (reason) => {
    const onReorder = jest.fn()
    await render(tree({ ...props(), onReorder }))
    measureRows()
    const source = option()
    await act(() => {
      source.props.onStartShouldSetResponderCapture(pointer(10, 10))
      source.props.onResponderGrant(pointer(10, 10))
    })
    await act(() => {
      if (reason === "terminate") source.props.onResponderTerminate(pointer(10, 170, 2))
      else if (reason === "multitouch") source.props.onResponderMove(pointer(10, 170, 2, 2))
      source.props.onResponderRelease(pointer(reason === "outside" ? 250 : 10, 170, 3))
    })
    expect(onReorder).not.toHaveBeenCalled()
  },
)

it("retires a queued drop after owner close or original source removal", async () => {
  const onReorder = jest.fn()
  let open = true
  const value = { ...props(), onReorder, canAct: () => open }
  const view = await render(tree(value))
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
