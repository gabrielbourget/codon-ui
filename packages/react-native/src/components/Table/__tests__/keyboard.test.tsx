import "../../../collection/__tests__/nativeReceipts"

import { act as rawAct, cleanup } from "@testing-library/react-native"
import { createRef } from "react"
import type * as RN from "react-native"

import {
  actWithNativeCollections as act,
  flushNativeCollectionActions,
  renderWithNativeCollections as render,
  screen,
} from "../../../collection/__tests__/nativeReceipts"
import { DefaultNativeCollectionRenderer, NativeCollectionRendererContext } from "../../../collection/renderer"
import { nativeKeyToken } from "../../../input/keyScope"
import { Commands } from "../../../input/specs/CUIFocusViewNativeComponent"
import { NativeFloatingLayerHost } from "../../../overlays/floating/NativeFloatingLayerHost"
import { NativeFloatingWindowContext } from "../../../overlays/floating/scope"
import { NativeOverlayProvider } from "../../../overlays/NativeOverlayProvider"
import { NativeThemeProvider } from "../../../theme"
import { NativeButton } from "../../Button/Button"
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

const controlsFixture = async (scoped = false) => {
  const first = createRef<RN.View>(),
    second = createRef<RN.View>(),
    disabled = createRef<RN.View>(),
    scope = createRef<RN.View>()
  const controlColumns = [
    columns[0],
    {
      id: "controls",
      name: "Controls",
      cellRenderer: ({ row }: { row: { id: string | number } }) =>
        row.id === 0 ? (
          <>
            <NativeButton ref={first} accessibilityLabel="First">
              First
            </NativeButton>
            <NativeButton ref={disabled} isDisabled accessibilityLabel="Disabled">
              Disabled
            </NativeButton>
            <NativeButton ref={second} accessibilityLabel="Second">
              Second
            </NativeButton>
          </>
        ) : (
          "Other"
        ),
    },
  ]
  const table = (
    <Table accessibilityLabel="Controls">
      <TableHeader columns={controlColumns} />
      <TableBody columns={controlColumns} items={items} />
    </Table>
  )
  await render(
    <NativeThemeProvider>
      {scoped ? (
        <NativeOverlayProvider>
          <NativeFloatingLayerHost ref={scope} testID="keys-host">
            {table}
          </NativeFloatingLayerHost>
        </NativeOverlayProvider>
      ) : (
        table
      )}
    </NativeThemeProvider>,
  )
  Object.defineProperty(mockViews.get(cell(1, 1).props.ownerId)!, "childNodes", {
    configurable: true,
    get: () => [{ childNodes: [first.current, disabled.current, second.current] }],
  })
  if (scoped) await ready()
  return { first, second, disabled, scope }
}
const ready = async () => {
  for (const isReady of [false, true]) {
    const host = screen.getByTestId("keys-host").props
    await act(() =>
      host.onNativeScopeStatus({
        nativeEvent: {
          ownerId: host.ownerId,
          windowId: "table-window",
          epoch: 1,
          policyRevision: host.policyRevision,
          ready: isReady,
          windowActive: true,
        },
      }),
    )
  }
}
const scopedKey = async (
  value: string,
  focused: THost,
  parent: THost,
  scope: RN.View | null,
  overrides: Record<string, unknown> = {},
  settle = true,
) => {
  const host = screen.getByTestId("keys-host").props
  const policy = host.policies.find(
    (entry: { targetTag: number; tokens: string[] }) =>
      entry.targetTag === tag(parent) &&
      entry.tokens.includes(
        nativeKeyToken({
          key: value,
          shiftKey: !!overrides.shiftKey,
          altKey: !!overrides.altKey,
          ctrlKey: !!overrides.ctrlKey,
          metaKey: !!overrides.metaKey,
        }),
      ),
  )
  expect(policy).toBeDefined()
  const event = {
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
    persist: jest.fn(),
    isDefaultPrevented: () => false,
    nativeEvent: {
      kind: "keyboard",
      ownerId: host.ownerId,
      policyId: policy.id,
      target: jest.requireActual<typeof RN>("react-native").findNodeHandle(scope),
      focusedTarget: tag(focused),
      windowId: "table-window",
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
      nativeModifierData: "",
      ...overrides,
    },
  }
  await (settle ? act : rawAct)(() => host.onNativeScopedKey(event))
  return event
}
it("focuses the first or last eligible original child when entering a cell", async () => {
  const { first, second } = await controlsFixture()
  await focused(row(0))
  await key(row(0), "ArrowLeft")
  expectFocus(screen.getByRole("button", { name: "Second" }))
  expect(Commands.requestKeyboardFocus).toHaveBeenLastCalledWith(second.current, expect.any(String))
  await focused(cell(1, 0))
  await key(cell(1, 0), "ArrowRight")
  expect(Commands.requestKeyboardFocus).toHaveBeenLastCalledWith(first.current, expect.any(String))
})
it("routes original scoped child arrows through eligible siblings before leaving the cell", async () => {
  const { first, second, scope } = await controlsFixture(true)
  const firstHost = screen.getByRole("button", { name: "First" })
  const secondHost = screen.getByRole("button", { name: "Second" })
  await focused(firstHost)
  await scopedKey("ArrowRight", firstHost, cell(1, 1), scope.current)
  expect(Commands.requestKeyboardFocus).toHaveBeenLastCalledWith(second.current, expect.any(String))
  await focused(secondHost)
  await scopedKey("ArrowLeft", secondHost, cell(1, 1), scope.current)
  expect(Commands.requestKeyboardFocus).toHaveBeenLastCalledWith(first.current, expect.any(String))
  await focused(firstHost)
  await scopedKey("ArrowLeft", firstHost, cell(1, 1), scope.current)
  expectFocus(cell(1, 0))
  await focused(secondHost)
  await scopedKey("ArrowDown", secondHost, cell(1, 1), scope.current, { altKey: true })
  expectFocus(cell(2, 1))
})
it("does not focus a child removed while native admission is pending", async () => {
  const { second } = await controlsFixture()
  await focused(row(0))
  await key(row(0), "ArrowLeft", {}, false)
  await flushNativeCollectionActions()
  Object.defineProperty(mockViews.get(cell(1, 1).props.ownerId)!, "childNodes", { configurable: true, get: () => [] })
  await act(() => {})
  expect(Commands.requestKeyboardFocus).not.toHaveBeenCalled()
  expect(second.current).not.toBeNull()
})
it("enters the resize handle from its row and preserves its scoped policy priority", async () => {
  const resized = jest.fn(),
    scope = createRef<RN.View>()
  const sized = [
    { ...columns[0], width: 120 },
    { ...columns[1], width: 80 },
  ]
  await render(
    <NativeThemeProvider>
      <NativeOverlayProvider>
        <NativeFloatingLayerHost ref={scope} testID="keys-host">
          <Table columns={sized} columnResizing={{ enabled: true, onColumnResize: resized }}>
            <TableHeader columns={sized} />
            <TableBody columns={sized} items={items} />
          </Table>
        </NativeFloatingLayerHost>
      </NativeOverlayProvider>
    </NativeThemeProvider>,
  )
  const handle = screen.getByRole("button", { name: "Resize Name column" })
  Object.defineProperty(mockViews.get(cell(0, 0).props.ownerId)!, "childNodes", {
    configurable: true,
    get: () => [mockViews.get(handle.props.ownerId)!],
  })
  await ready()
  const policies = screen
    .getByTestId("keys-host")
    .props.policies.filter(
      (policy: { targetTag: number; tokens: string[] }) =>
        [tag(handle), tag(cell(0, 0))].includes(policy.targetTag) && policy.tokens.includes("0000:ArrowRight"),
    )
  expect(policies.map((policy: { targetTag: number }) => policy.targetTag)).toEqual([tag(handle), tag(cell(0, 0))])
  await focused(row(0))
  await key(row(0), "ArrowUp")
  expectFocus(handle)
  expect(handle.props.capturedKeys.some((token: string) => token.endsWith(":ArrowRight"))).toBe(false)
  await focused(handle)
  await scopedKey("ArrowRight", handle, handle, scope.current)
  expect(resized).toHaveBeenCalledTimes(1)
  expect(resized).toHaveBeenLastCalledWith({ columnID: "name", width: 136 })
})
it("uses actual renderer rectangles for PageUp/PageDown and omits unmeasured paging", async () => {
  const layout = {
    getItemRect: (key: string | number) => {
      const id = String(key)
      return {
        x: 0,
        y: id.includes("last") ? 90 : id.includes("beta") ? 45 : id.includes("header") ? 0 : 20,
        width: 100,
        height: 20,
      }
    },
    getVisibleRect: () => ({ x: 0, y: 0, width: 100, height: 80 }),
    getContentSize: () => ({ width: 100, height: 120 }),
  }
  const view = await render(
    <NativeCollectionRendererContext.Provider value={{ ...DefaultNativeCollectionRenderer, layoutDelegate: layout }}>
      {node()}
    </NativeCollectionRendererContext.Provider>,
  )
  await focused(row(0))
  await key(row(0), "PageDown")
  expectFocus(row("last"))
  await focused(row("last"))
  await key(row("last"), "PageUp")
  expectFocus(row(0))
  await view.rerender(node())
  expect(row(0).props.capturedKeys.some((token: string) => token.endsWith(":PageDown"))).toBe(false)
})
