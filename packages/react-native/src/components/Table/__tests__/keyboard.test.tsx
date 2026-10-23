import "../../../collection/__tests__/nativeReceipts"

import { act as rawAct, cleanup } from "@testing-library/react-native"
import { createRef } from "react"
import type * as RN from "react-native"

import {
  actWithNativeCollections as act,
  renderWithNativeCollections as render,
  screen,
} from "../../../collection/__tests__/nativeReceipts"
import { Commands } from "../../../input/specs/CUIFocusViewNativeComponent"
import { NativeFloatingWindowContext } from "../../../overlays/floating/scope"
import { NativeThemeProvider } from "../../../theme"
import { encodeCollectionKey } from "../../collection"
import { Table } from "../Table"
import { TableBody } from "../TableBody"
import { TableHeader } from "../TableHeader"
import type { TNativeTableProps } from "../types"

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
  jest.clearAllMocks()
  const native = jest.requireActual<typeof RN>("react-native")
  const base = jest.mocked(native.findNodeHandle).getMockImplementation()!
  const tags = new WeakMap<object, number>()
  let next = 400
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
const items = [
  { id: 0, name: "Zero", age: 20 },
  { id: "beta", name: "Beta", age: 30 },
  { id: "last", name: "Last", age: 40 },
]
const columns = [
  { id: "name", name: "Name", isRowHeader: true },
  { id: "age", name: "Age" },
]
const node = (props: TNativeTableProps = {}, window = () => true) => (
  <NativeThemeProvider>
    <NativeFloatingWindowContext.Provider value={window}>
      <Table accessibilityLabel="Rows" {...props}>
        <TableHeader columns={columns} />
        <TableBody items={items} columns={columns} />
      </Table>
    </NativeFloatingWindowContext.Provider>
  </NativeThemeProvider>
)
type THost = ReturnType<typeof screen.getByTestId>
const row = (key: string | number) => screen.getByTestId(`table-row-${encodeCollectionKey(key)}`)
const cell = (rowIndex: number, columnIndex: number) =>
  screen.container.queryAll((host) => {
    const semantics = JSON.parse(host.props.nativeCollectionSemantics || "null")
    return semantics?.kind === "cell" && semantics.rowIndex === rowIndex && semantics.columnIndex === columnIndex
  })[0]
const tag = (host: THost) =>
  jest.requireActual<typeof RN>("react-native").findNodeHandle(mockViews.get(host.props.ownerId)!)!
const focused = async (host: THost) =>
  act(() =>
    host.props.onNativeFocusChange({
      nativeEvent: { ownerId: host.props.ownerId, target: tag(host), isFocused: true, isFocusVisible: true },
    }),
  )
const key = async (host: THost, value: string, overrides: Record<string, unknown> = {}, settle = true) => {
  const event = {
    nativeEvent: {
      kind: "keyboard",
      ownerId: host.props.ownerId,
      target: tag(host),
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
  await (settle ? act : rawAct)(() => host.props.onNativeKey(event))
  return event
}
const expectFocus = (host: THost) =>
  expect(Commands.requestKeyboardFocus).toHaveBeenLastCalledWith(mockViews.get(host.props.ownerId), host.props.ownerId)

it("enters the first row through the original root and supports row navigation without selection", async () => {
  await render(node())
  await focused(screen.getByTestId("table"))
  expectFocus(row(0))
  await focused(row(0))
  await key(row(0), "ArrowDown")
  expectFocus(row("beta"))
  await focused(row("beta"))
  await key(row("beta"), "ArrowUp")
  expectFocus(row(0))
})
it("enters cells from both directions and preserves the column vertically", async () => {
  await render(node())
  await focused(row(0))
  await key(row(0), "ArrowRight")
  expectFocus(cell(1, 0))
  await focused(cell(1, 0))
  await key(cell(1, 0), "ArrowRight")
  expectFocus(cell(1, 1))
  await focused(cell(1, 1))
  await key(cell(1, 1), "ArrowDown")
  expectFocus(cell(2, 1))
  await focused(cell(2, 1))
  await key(cell(2, 1), "ArrowRight")
  expectFocus(row("beta"))
  await focused(row("beta"))
  await key(row("beta"), "ArrowLeft")
  expectFocus(cell(2, 1))
})
it("reaches the corresponding header, wraps columns and returns to the first row cell", async () => {
  await render(node())
  await focused(cell(1, 1))
  await key(cell(1, 1), "ArrowUp")
  expectFocus(cell(0, 1))
  await focused(cell(0, 1))
  await key(cell(0, 1), "ArrowRight")
  expectFocus(cell(0, 0))
  await focused(cell(0, 0))
  await key(cell(0, 0), "ArrowDown")
  expectFocus(cell(1, 0))
})
it("uses local cell Home/End and global platform-modified boundaries", async () => {
  await render(node())
  await focused(cell(2, 1))
  await key(cell(2, 1), "Home")
  expectFocus(cell(2, 0))
  await focused(cell(2, 0))
  await key(cell(2, 0), "End")
  expectFocus(cell(2, 1))
  await focused(cell(2, 1))
  await key(cell(2, 1), "Home", { ctrlKey: true, metaKey: true })
  expectFocus(cell(1, 0))
  await focused(cell(1, 0))
  await key(cell(1, 0), "End", { ctrlKey: true, metaKey: true })
  expectFocus(cell(3, 1))
})
it("skips disabled rows but keeps selection-only disabled rows focusable", async () => {
  const view = await render(node({ disabledKeys: ["beta"] }))
  await focused(row(0))
  await key(row(0), "ArrowDown")
  expectFocus(row("last"))
  await view.rerender(node({ disabledKeys: ["beta"], disabledBehavior: "selection" }))
  await focused(row(0))
  await key(row(0), "ArrowDown")
  expectFocus(row("beta"))
})
it("extends held row selection through cell navigation and preserves the owner set", async () => {
  const changed = jest.fn(),
    held = new Set<string | number>([0])
  await render(
    node({ selectionMode: "multiple", selectionBehavior: "replace", selectedKeys: held, onSelectionChange: changed }),
  )
  await focused(cell(1, 1))
  await key(cell(1, 1), "ArrowDown", { shiftKey: true })
  expect([...changed.mock.calls.at(-1)![0]]).toEqual([0, "beta"])
  expect([...held]).toEqual([0])
  expectFocus(cell(2, 1))
})
it("supports select-all/escape and honors their explicit owner policies", async () => {
  const changed = jest.fn()
  const view = await render(node({ selectionMode: "multiple", defaultSelectedKeys: [0], onSelectionChange: changed }))
  await focused(row(0))
  await key(row(0), "a", { ctrlKey: true, metaKey: true })
  expect(changed).toHaveBeenLastCalledWith("all")
  const escape = await key(row(0), "Escape")
  expect([...changed.mock.calls.at(-1)![0]]).toEqual([])
  expect(escape.stopPropagation).toHaveBeenCalled()
  await view.unmount()
  await render(
    node({
      selectionMode: "multiple",
      selectedKeys: new Set([0]),
      disallowSelectAll: true,
      escapeKeyBehavior: "none",
      onSelectionChange: changed,
    }),
  )
  changed.mockClear()
  await key(row(0), "a", { ctrlKey: true, metaKey: true })
  await key(row(0), "Escape")
  expect(changed).not.toHaveBeenCalled()
})
it("ignores cancelled, foreign, key-up and inactive-window receipts", async () => {
  let active = true
  const changed = jest.fn()
  await render(
    node({ selectionMode: "multiple", selectionBehavior: "replace", onSelectionChange: changed }, () => active),
  )
  await focused(row(0))
  jest.mocked(Commands.requestKeyboardFocus).mockClear()
  for (const overrides of [{ cancelled: true }, { target: 99999 }, { phase: "up" }, { nativeDefaultHandled: false }])
    await key(row(0), "ArrowDown", overrides)
  active = false
  await key(row(0), "ArrowDown")
  expect(changed).not.toHaveBeenCalled()
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
})

it("does not establish grid focus from another host's focus receipt", async () => {
  await render(node())
  const root = screen.getByTestId("table"),
    first = cell(1, 0)
  for (const host of [root, first])
    await act(() =>
      host.props.onNativeFocusChange({
        nativeEvent: { ownerId: host.props.ownerId, target: 99999, isFocused: true, isFocusVisible: true },
      }),
    )
  expect(screen.getByTestId("table").props.nativeTabStop).toBe(true)
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
})

it("leaves unavailable boundaries and disabled selection shortcuts outside native capture", async () => {
  await render(
    node({ selectionMode: "multiple", selectedKeys: new Set([0]), disallowSelectAll: true, escapeKeyBehavior: "none" }),
  )
  const captures = (host: THost, key: string) =>
    host.props.capturedKeys.some((token: string) => token.endsWith(`:${key}`))
  expect(captures(row("last"), "ArrowDown")).toBe(false)
  expect(captures(row(0), "ArrowDown")).toBe(true)
  expect(captures(cell(0, 0), "ArrowUp")).toBe(false)
  expect(captures(row(0), "Escape")).toBe(false)
  expect(captures(row(0), "a")).toBe(false)
})

it("reverses horizontal navigation in RTL while retaining header wrapping", async () => {
  const native = jest.requireActual<typeof RN>("react-native")
  jest.replaceProperty(native.I18nManager, "isRTL", true)
  await render(node())
  await focused(row(0))
  await key(row(0), "ArrowRight")
  expectFocus(cell(1, 1))
  await focused(cell(1, 1))
  await key(cell(1, 1), "ArrowRight")
  expectFocus(cell(1, 0))
  await focused(cell(0, 0))
  await key(cell(0, 0), "ArrowRight")
  expectFocus(cell(0, 1))
})
it("preserves the delegate's row and local-cell wrap boundaries", async () => {
  await render(node({ shouldFocusWrap: true }))
  await focused(row("last"))
  await key(row("last"), "ArrowDown")
  expectFocus(row(0))
  await focused(cell(3, 1))
  await key(cell(3, 1), "ArrowDown")
  expectFocus(cell(3, 0))
  await focused(cell(0, 0))
  await key(cell(0, 0), "ArrowUp")
  expectFocus(cell(0, 1))
})
it("rejects queued key work after window loss and ignores an unmounted host", async () => {
  let active = true
  const changed = jest.fn()
  const view = await render(
    node({ selectionMode: "multiple", selectionBehavior: "replace", onSelectionChange: changed }, () => active),
  )
  await focused(row(0))
  const original = row(0)
  await key(original, "ArrowDown", {}, false)
  active = false
  await act(() => {})
  expect(changed).not.toHaveBeenCalled()
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
  const callback = original.props.onNativeKey
  const packet = {
    nativeEvent: {
      ownerId: original.props.ownerId,
      kind: "keyboard",
      key: "ArrowDown",
      phase: "down",
      target: tag(original),
      nativeDefaultHandled: true,
    },
  }
  await view.unmount()
  await rawAct(() => callback(packet))
  expect(changed).not.toHaveBeenCalled()
})
it("retains the maintained scene's original held editor through grid navigation", async () => {
  const editor = createRef<RN.TextInput>()
  await render(<TableFixture editorRef={editor} />)
  const original = editor.current!
  const writes = jest.spyOn(original, "setNativeProps")
  await focused(row("a"))
  await key(row("a"), "ArrowDown")
  await focused(row("b"))
  await key(row("b"), "ArrowUp")
  expect(editor.current).toBe(original)
  expect(screen.getByTestId("table-editor").props.text).toBe("held")
  expect(writes).not.toHaveBeenCalled()
})
