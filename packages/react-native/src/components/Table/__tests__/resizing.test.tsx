import "../../../collection/__tests__/nativeReceipts"

import { act as rawAct, cleanup, userEvent } from "@testing-library/react-native"
import { createRef } from "react"
import type * as RN from "react-native"

import {
  actWithNativeCollections as act,
  fireEventWithNativeCollections as fireEvent,
  renderWithNativeCollections as render,
  screen,
} from "../../../collection/__tests__/nativeReceipts"
import { NativeFloatingWindowContext } from "../../../overlays/floating/scope"
import { NativeThemeProvider } from "../../../theme"
import { Table } from "../Table"
import { TableBody } from "../TableBody"
import { TableHeader } from "../TableHeader"
import type { TNativeTableColumnMetadata, TNativeTableProps } from "../types"

import { TableFixture } from "./fixtures/TableFixture"

jest.unmock("react-native/Libraries/Components/TextInput/TextInput")

const mockViews = new Map<string, RN.View>()
jest.mock("../../../input/specs/CUIFocusViewNativeComponent", () => {
  const React = jest.requireActual<typeof import("react")>("react")
  const Native = jest.requireActual<typeof RN>("react-native")
  return {
    __esModule: true,
    default: React.forwardRef<RN.View, RN.ViewProps & { ownerId: string }>((props, ref) => {
      const bind = React.useCallback(
        (view: RN.View | null) => {
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
beforeEach(() => {
  jest.useFakeTimers()
  mockViews.clear()
  const native = jest.requireActual<typeof RN>("react-native")
  const base = jest.mocked(native.findNodeHandle).getMockImplementation()!
  const tags = new WeakMap<object, number>()
  let next = 300
  jest.mocked(native.findNodeHandle).mockImplementation((view) => {
    if (!view || typeof view !== "object") return base(view)
    if (!tags.has(view)) {
      const tag = base(view)
      tags.set(view, tag && tag >= 1000000 ? tag : ++next)
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
type TRow = { id: string; name: string }
const columns = [
  { id: "name", name: "Name", isRowHeader: true, width: 120, minWidth: 100, maxWidth: 150 },
] satisfies TNativeTableColumnMetadata<TRow>[]
const node = (
  props: TNativeTableProps<TRow>,
  header: TNativeTableColumnMetadata<TRow>[] = columns,
  window = () => true,
) => (
  <NativeThemeProvider>
    <NativeFloatingWindowContext.Provider value={window}>
      <Table columns={columns} {...props}>
        <TableHeader columns={header} />
        <TableBody items={[{ id: "a", name: "Alpha" }]} columns={header} />
      </Table>
    </NativeFloatingWindowContext.Provider>
  </NativeThemeProvider>
)
const handle = (name = "Name") => screen.getByRole("button", { name: `Resize ${name} column` })
const tag = (name = "Name") =>
  jest.requireActual<typeof RN>("react-native").findNodeHandle(mockViews.get(handle(name).props.ownerId)!)!
const touch = (x: number, id = 1, target = tag()) => ({
  target,
  currentTarget: tag(),
  nativeEvent: {
    target,
    pageX: x,
    pageY: 0,
    locationX: 0,
    locationY: 0,
    identifier: id,
    changedTouches: [{ target, pageX: x, pageY: 0, identifier: id }],
    timestamp: 100,
  },
  persist: jest.fn(),
  preventDefault: jest.fn(),
  stopPropagation: jest.fn(),
  isDefaultPrevented: () => false,
})
const phase = async (name: string, event = touch(10)) => {
  await act(() => handle().props[name](event))
  return event
}
const layout = (width: number) =>
  fireEvent(screen.getByRole("columnheader", { name: "Name" }), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width, height: 30 } },
  })
const key = async (value: string, overrides: Record<string, unknown> = {}, name = "Name") => {
  const host = handle(name).props
  const event = {
    nativeEvent: {
      kind: "keyboard",
      ownerId: host.ownerId,
      target: tag(name),
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
      ...overrides,
    },
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
    persist: jest.fn(),
    isDefaultPrevented: () => false,
  }
  await act(() => host.onNativeKey(event))
  return event
}
it("uses measured width, column-first bounds and held owner requests, then ends pointer tracking", async () => {
  const resized = jest.fn()
  await render(node({ columnResizing: { enabled: true, minWidth: 130, maxWidth: 140, onColumnResize: resized } }))
  await layout(140)
  const start = await phase("onResponderGrant", touch(10))
  expect(start.preventDefault).toHaveBeenCalledTimes(1)
  expect(start.stopPropagation).toHaveBeenCalledTimes(1)
  await phase("onResponderMove", touch(17))
  await phase("onResponderMove", touch(17))
  await phase("onResponderMove", touch(30))
  expect(resized.mock.calls).toEqual([
    [{ columnID: "name", width: 147 }],
    [{ columnID: "name", width: 147 }],
    [{ columnID: "name", width: 150 }],
  ])
  await phase("onResponderRelease", touch(30))
  await phase("onResponderMove", touch(90))
  expect(resized).toHaveBeenCalledTimes(3)
  expect(screen.getByRole("columnheader", { name: "Name" })).toHaveStyle({ width: 120, paddingEnd: 11 })
  expect(screen.getByTestId("table").props.columnResizing).toBeUndefined()
})
it("preserves numeric zero bounds and rounds after the measured delta", async () => {
  const resized = jest.fn()
  const header = [{ ...columns[0], minWidth: 0, maxWidth: 1000 }]
  const view = await render(
    node({ columnResizing: { enabled: true, minWidth: 300, maxWidth: 301, onColumnResize: resized } }, header),
  )
  await layout(120.4)
  await phase("onResponderGrant", touch(10.2))
  await phase("onResponderMove", touch(17.1))
  expect(resized).toHaveBeenLastCalledWith({ columnID: "name", width: 127 })
  await phase("onResponderRelease")
  await view.rerender(
    node({ columnResizing: { enabled: true, onColumnResize: resized } }, [
      { ...columns[0], width: 0, minWidth: 0, maxWidth: 0 },
    ]),
  )
  await layout(0)
  await phase("onResponderGrant", touch(10))
  await phase("onResponderMove", touch(100))
  expect(resized).toHaveBeenLastCalledWith({ columnID: "name", width: 0 })
})

it("keeps authored zero padding authoritative over the resize gutter", async () => {
  await render(
    node({ columnResizing: { enabled: true, onColumnResize: jest.fn() } }, [
      { ...columns[0], customHeaderColumnStyles: { padding: 0 } },
    ]),
  )
  const header = screen.getByRole("columnheader", { name: "Name" })
  expect(header).toHaveStyle({ padding: 0 })
  expect(
    jest.requireActual<typeof RN>("react-native").StyleSheet.flatten(header.props.style).paddingEnd,
  ).toBeUndefined()
})

it("accepts the SDK's string touch target without borrowing another native target", async () => {
  const resized = jest.fn()
  await render(node({ columnResizing: { enabled: true, onColumnResize: resized } }))
  const down = touch(10)
  await act(() =>
    handle().props.onResponderGrant({
      ...down,
      nativeEvent: {
        ...down.nativeEvent,
        changedTouches: [{ ...down.nativeEvent.changedTouches[0], target: String(tag()) }],
      },
    }),
  )
  await phase("onResponderMove", touch(20))
  expect(resized).toHaveBeenLastCalledWith({ columnID: "name", width: 130 })
})
it("captures only resize arrows, including repeats/modifiers, and leaves uncaptured/cancelled/foreign keys alone", async () => {
  const resized = jest.fn()
  await render(node({ columnResizing: { enabled: true, onColumnResize: resized } }))
  await layout(120)
  expect(handle().props.capturedKeys).toHaveLength(64)
  const right = await key("ArrowRight", { repeat: true, shiftKey: true, altKey: true, ctrlKey: true, metaKey: true })
  const left = await key("ArrowLeft")
  expect(resized.mock.calls).toEqual([[{ columnID: "name", width: 136 }], [{ columnID: "name", width: 104 }]])
  expect(right.preventDefault).toHaveBeenCalled()
  expect(left.stopPropagation).toHaveBeenCalled()
  for (const [value, override] of [
    ["ArrowRight", { nativeDefaultHandled: false }],
    ["ArrowLeft", { cancelled: true }],
    ["ArrowRight", { target: tag() + 1 }],
    ["ArrowUp", {}],
  ] as const) {
    const ignored = await key(value, override)
    expect(ignored.preventDefault).not.toHaveBeenCalled()
  }
  expect(resized).toHaveBeenCalledTimes(2)
  expect(resized).toHaveBeenCalledTimes(2)
})

it("preserves header sorting from Enter/Space activation of its resize handle", async () => {
  const sorted = jest.fn(),
    resized = jest.fn()
  const header = [{ ...columns[0], sort: { enabled: true, criteriaID: "name" } }]
  await render(
    node(
      {
        columns: header,
        columnResizing: { enabled: true, onColumnResize: resized },
        queryControls: { sorting: { activeSorts: [], onSortChange: sorted } },
      },
      header,
    ),
  )
  for (const value of ["Enter", " "]) {
    await key(value)
    await key(value, { phase: "up" })
  }
  expect(sorted).toHaveBeenCalledTimes(2)
  expect(sorted).toHaveBeenLastCalledWith([
    { id: "sort-name", criteriaID: "name", criteriaName: "Name", queryKey: undefined, sortDirection: "Ascending" },
  ])
  expect(resized).not.toHaveBeenCalled()
})
it("keeps header pointer metadata separate from current root keyboard metadata across an owner update", async () => {
  const original = jest.fn(),
    current = jest.fn()
  const view = await render(node({ columnResizing: { enabled: true, onColumnResize: original } }))
  await layout(120)
  await phase("onResponderGrant", touch(10))
  const root = [{ ...columns[0], width: 400, minWidth: 130, maxWidth: 180 }]
  await view.rerender(
    node({ columns: root, columnResizing: { enabled: true, onColumnResize: current } }, [
      { ...columns[0], width: 400, minWidth: 0, maxWidth: 500 },
    ]),
  )
  await phase("onResponderMove", touch(20))
  expect(original).toHaveBeenLastCalledWith({ columnID: "name", width: 130 })
  expect(current).not.toHaveBeenCalled()
  await phase("onResponderRelease")
  await layout(400)
  await key("ArrowRight")
  expect(current).toHaveBeenLastCalledWith({ columnID: "name", width: 180 })
})
it("keeps pointer resizing active without root columns while keyboard resizing stays inert", async () => {
  const resized = jest.fn()
  await render(node({ columns: undefined, columnResizing: { enabled: true, onColumnResize: resized } }))
  expect(
    handle().props.capturedKeys.some((token: string) => token.endsWith(":ArrowRight") || token.endsWith(":ArrowLeft")),
  ).toBe(false)
  await key("ArrowRight")
  expect(resized).not.toHaveBeenCalled()
  await phase("onResponderGrant", touch(10))
  await phase("onResponderMove", touch(20))
  expect(resized).toHaveBeenLastCalledWith({ columnID: "name", width: 130 })
})
it("retires a queued drag when its physical window is lost and does not resume it on return", async () => {
  const resized = jest.fn()
  let active = true
  await render(node({ columnResizing: { enabled: true, onColumnResize: resized } }, columns, () => active))
  await phase("onResponderGrant", touch(10))
  await rawAct(() => handle().props.onResponderMove(touch(20)))
  active = false
  await act(() => {})
  active = true
  await phase("onResponderMove", touch(30))
  expect(resized).not.toHaveBeenCalled()
})
it("retires termination/unmount and omits hidden or disabled resize controls", async () => {
  const resized = jest.fn()
  const view = await render(node({ columnResizing: { enabled: true, onColumnResize: resized } }))
  await phase("onResponderGrant")
  await phase("onResponderTerminate")
  await phase("onResponderMove", touch(30))
  expect(resized).not.toHaveBeenCalled()
  const original = handle().props
  await phase("onResponderGrant")
  const late = touch(30)
  await view.unmount()
  await rawAct(() => original.onResponderMove(late))
  expect(resized).not.toHaveBeenCalled()
  await render(
    node({ columnResizing: { enabled: true, onColumnResize: resized } }, [
      { ...columns[0], headerVisuallyHidden: true },
    ]),
  )
  expect(screen.queryByRole("button", { name: "Resize Name column" })).toBeNull()
})

it("keeps the original held editor while the maintained owner vetoes then echoes width requests", async () => {
  const editor = createRef<RN.TextInput>()
  await render(<TableFixture editorRef={editor} />)
  const original = editor.current!
  const write = jest.spyOn(original, "setNativeProps")
  const toggle = async () => {
    await userEvent.setup().press(screen.getByRole("button", { name: "Toggle query veto" }))
    await act(() => {})
  }
  await toggle()
  await key("ArrowRight", {}, "Person")
  await key("ArrowRight", {}, "Person")
  expect(screen.getByTestId("table-widths")).toHaveTextContent('{"name":110,"active":70}')
  expect(screen.getByTestId("table-resize-requests")).toHaveTextContent(
    '[{"columnID":"name","width":126},{"columnID":"name","width":126}]',
  )
  await toggle()
  await key("ArrowRight", {}, "Person")
  expect(screen.getByTestId("table-widths")).toHaveTextContent('{"name":126,"active":70}')
  expect(screen.getByRole("columnheader", { name: "Person" })).toHaveStyle({ width: 126 })
  expect(editor.current).toBe(original)
  expect(screen.getByTestId("table-editor").props.text).toBe("held")
  expect(write).not.toHaveBeenCalled()
})
