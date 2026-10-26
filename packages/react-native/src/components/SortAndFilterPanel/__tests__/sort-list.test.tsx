import "../../../collection/__tests__/nativeReceipts"

import { act as rawAct, cleanup, within } from "@testing-library/react-native"
import { AccessibilityInfo, Animated, Easing, PlatformColor, processColor, StyleSheet } from "react-native"
import type * as RN from "react-native"

import {
  actWithNativeCollections as act,
  renderWithNativeCollections as render,
  screen,
} from "../../../collection/__tests__/nativeReceipts"
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
const key = async (host: THost, value: string, target = tag(host), settle = true) => {
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
      phase: "down",
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
