import "../../../collection/__tests__/nativeReceipts"

import { act as nativeAct, cleanup } from "@testing-library/react-native"
import { createRef, useContext } from "react"
import { findNodeHandle, TextInput, View } from "react-native"

import { Button, NativeFocusView } from "../../.."
import {
  actWithNativeCollections as act,
  renderWithNativeCollections,
  screen,
} from "../../../collection/__tests__/nativeReceipts"
import { NativeLocaleProvider } from "../../../locale/NativeLocaleProvider"
import { NativeFloatingWindowContext } from "../../../overlays/floating/scope"
import { NativeThemeProvider } from "../../../theme"
import { NativeTableStateContext } from "../context"
import type { TNativeTableState } from "../state/useTableState"
import { Table } from "../Table"
import { TableHeader } from "../TableHeader"
import { TableRow } from "../TableRow"

import { CellFixtureBody } from "./fixtures/TableCellFixture"

const describeRenderError = (error: unknown): string => {
  if (error && typeof error === "object" && "errors" in error && Array.isArray(error.errors))
    return error.errors.map(describeRenderError).join("\n--- nested ---\n")
  return error instanceof Error ? (error.stack ?? error.message) : String(error)
}
const render = async (node: React.ReactElement) => {
  try {
    return await renderWithNativeCollections(node)
  } catch (error) {
    throw new Error(`Original chevron render error:\n${describeRenderError(error)}`)
  }
}

let state: TNativeTableState<object>
const Probe = () => {
  state = useContext(NativeTableStateContext)!
  return null
}
const row = createRef<View>(),
  button = createRef<View>(),
  editor = createRef<TextInput>()
const requested = jest.fn(),
  selected = jest.fn(),
  rowAction = jest.fn(),
  pressed = jest.fn()
const empty = new Set<string | number>()
let active = true
let buttonOverrides: {
  id?: string
  nativeID?: string
  accessibilityLabel?: string
  accessibilityLabelledBy?: string | string[]
} = {}
const columns = [
  {
    id: "name",
    name: "Name",
    isRowHeader: true,
    cellRenderer: () => (
      <>
        <Button
          ref={button}
          slot="chevron"
          testID="custom-chevron"
          onPress={pressed}
          isDisabled={false}
          {...buttonOverrides}
          render={custom ? (host) => <NativeFocusView {...host} /> : undefined}
        >
          Chevron
        </Button>
        <TextInput ref={editor} value="held" testID="chevron-editor" />
      </>
    ),
  },
]
let custom = false
const tree = (expanded = empty, disabled = false, locale = "en-US", treeColumn: string | null = "name") => (
  <NativeFloatingWindowContext.Provider value={() => active}>
    <NativeLocaleProvider locale={locale}>
      <NativeThemeProvider>
        <Table
          treeColumn={treeColumn ?? undefined}
          expandedKeys={expanded}
          onExpandedChange={requested}
          selectionMode="multiple"
          selectionBehavior="replace"
          selectedKeys={new Set(["parent"])}
          onSelectionChange={selected}
          clickableRows
          onRowAction={rowAction}
        >
          <TableHeader
            columns={columns}
            render={(host) => (
              <View {...host}>
                <Probe />
                {host.children}
              </View>
            )}
          />
          <CellFixtureBody>
            <TableRow
              ref={row}
              nativeID="caller-parent-row"
              id="parent"
              testID="chevron-row"
              item={{}}
              columns={columns}
              hasChildItems
              isDisabled={disabled}
            />
          </CellFixtureBody>
        </Table>
      </NativeThemeProvider>
    </NativeLocaleProvider>
  </NativeFloatingWindowContext.Provider>
)
const packet = (id: number) => {
  const event = {
    defaultPrevented: false,
    persist: jest.fn(),
    isDefaultPrevented: () => event.defaultPrevented,
    preventDefault: () => {
      event.defaultPrevented = true
    },
    nativeEvent: {
      kind: "activation",
      ownerId: screen.getByTestId("custom-chevron").props.ownerId,
      target: findNodeHandle(button.current),
      source: "ios-accessibility-activate",
      activationId: id,
      observedAt: 0,
      scopeOwnerId: "",
      windowId: "window",
      epoch: 0,
    },
  }
  return event
}
const activate = async (id: number) => {
  const event = packet(id)
  await act(() => screen.getByTestId("custom-chevron").props.onNativeActivation(event))
  return event
}
beforeEach(() => {
  jest.useFakeTimers()
  jest.clearAllMocks()
  active = true
  custom = false
  buttonOverrides = {}
  const native = jest.requireActual<typeof import("react-native")>("react-native")
  const installed = native.findNodeHandle as jest.MockedFunction<typeof native.findNodeHandle>
  const original = jest.isMockFunction(installed) ? installed.getMockImplementation()! : native.findNodeHandle
  const tags = new WeakMap<object, number>()
  let next = 90000
  jest.spyOn(native, "findNodeHandle").mockImplementation((view) => {
    const reserved = original(view)
    if (reserved != null && reserved >= 1000000) return reserved
    if (!view || typeof view !== "object") return null
    if (!tags.has(view)) tags.set(view, ++next)
    return tags.get(view)!
  })
})
afterEach(async () => {
  await cleanup()
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})

it("preserves reachable custom-cell chevron controlled expansion, labels, keyboard eligibility and original refs", async () => {
  const view = await render(tree()),
    originalRow = row.current,
    originalButton = button.current,
    originalEditor = editor.current!
  const write = jest.spyOn(originalEditor, "setNativeProps"),
    host = () => screen.getByTestId("custom-chevron").props
  expect(host().accessibilityLabel).toBe("Expand")
  expect(host().nativeLabelledBy).toEqual([host().nativeID, "caller-parent-row"])
  expect(host().nativeTabStop).toBe(false)
  expect(host().focusable).toBe(true)
  const event = await activate(1)
  expect(requested.mock.calls.map(([keys]) => [...keys])).toEqual([["parent"]])
  expect(state.expandedKeys.has("parent")).toBe(false)
  expect(host().accessibilityLabel).toBe("Expand")
  expect(state.selectionManager.isFocused).toBe(true)
  expect(state.selectionManager.focusedKey).toBe("parent")
  expect(pressed.mock.calls[0][0]).toBe(event)
  custom = true
  await view.rerender(tree(new Set(["parent"]), false, "fr-FR"))
  expect(host().accessibilityLabel).toBe("Réduire")
  await activate(2)
  expect(requested.mock.calls.map(([keys]) => [...keys])).toEqual([["parent"], []])
  expect(state.expandedKeys.has("parent")).toBe(true)
  await view.rerender(tree(empty, false, "fr-FR"))
  expect(host().accessibilityLabel).toBe("Développer")
  const key = (phase: "down" | "up") => ({
    persist: jest.fn(),
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
    isDefaultPrevented: () => false,
    nativeEvent: {
      kind: "keyboard",
      ownerId: host().ownerId,
      target: findNodeHandle(button.current),
      key: "Enter",
      nativeCode: 40,
      phase,
      repeat: false,
      cancelled: false,
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      nativeDefaultHandled: true,
    },
  })
  await act(() => host().onNativeKey(key("down")))
  await act(() => host().onNativeKey(key("up")))
  expect(requested.mock.calls.map(([keys]) => [...keys])).toEqual([["parent"], [], ["parent"]])
  expect(row.current).toBe(originalRow)
  expect(button.current).toBe(originalButton)
  expect(editor.current).toBe(originalEditor)
  expect(write).not.toHaveBeenCalled()
  expect(screen.getByTestId("chevron-editor").props.value).toBe("held")
  expect(selected).not.toHaveBeenCalled()
  expect(rowAction).not.toHaveBeenCalled()
})

it("keeps chevron no-tree/disabled/current-window/unmounted guards without changing row selection", async () => {
  const view = await render(tree(empty, false, "en-US", null))
  await activate(1)
  expect(requested).not.toHaveBeenCalled()
  await view.rerender(tree(empty, true))
  const retained = screen.getByTestId("custom-chevron").props.onNativeActivation
  await activate(2)
  expect(requested).not.toHaveBeenCalled()
  await view.rerender(tree())
  pressed.mockImplementationOnce((event) => event.preventDefault())
  await activate(3)
  expect(requested).not.toHaveBeenCalled()
  await nativeAct(() => retained(packet(4)))
  await view.rerender(tree(empty, false, "en-US", null))
  await act(() => {})
  expect(requested).not.toHaveBeenCalled()
  await view.rerender(tree())
  await act(() => retained(packet(5)))
  expect(requested.mock.calls.map(([keys]) => [...keys])).toEqual([["parent"]])
  active = false
  await activate(6)
  expect(requested).toHaveBeenCalledTimes(1)
  const stale = packet(7),
    callback = screen.getByTestId("custom-chevron").props.onNativeActivation
  await view.unmount()
  await nativeAct(() => callback(stale))
  expect(requested).toHaveBeenCalledTimes(1)
  expect(selected).not.toHaveBeenCalled()
  expect(rowAction).not.toHaveBeenCalled()
})

it("requires caller-ID-only chevron overrides to rebind the canonical self-label association", async () => {
  const view = await render(tree())
  const original = button.current
  buttonOverrides = {
    nativeID: "caller-native-id",
    accessibilityLabel: "Caller label",
    accessibilityLabelledBy: ["caller-name"],
  }
  await view.rerender(tree())
  expect(screen.getByTestId("custom-chevron").props).toMatchObject({
    nativeID: "caller-native-id",
    accessibilityLabel: "Caller label",
    nativeLabelledBy: ["caller-name"],
  })
  buttonOverrides = { id: "caller-empty-id", accessibilityLabel: "", accessibilityLabelledBy: "" }
  await view.rerender(tree())
  expect(screen.getByTestId("custom-chevron").props).toMatchObject({
    nativeID: "caller-empty-id",
    accessibilityLabel: "",
  })
  expect(screen.getByTestId("custom-chevron").props.nativeLabelledBy).not.toContain("caller-parent-row")
  custom = true
  buttonOverrides = { id: "caller-id-only" }
  await view.rerender(tree())
  expect(button.current).toBe(original)
  expect(screen.getByTestId("custom-chevron").props.nativeID).toBe("caller-id-only")
  // Required RAC mergeIds behavior; remains a real regression until the shared owner supplies rebinding.
  expect(screen.getByTestId("custom-chevron").props.nativeLabelledBy).toEqual(["caller-id-only", "caller-parent-row"])
})
