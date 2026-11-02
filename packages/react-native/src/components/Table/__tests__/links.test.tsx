import "../../../collection/__tests__/nativeReceipts"

import { act as nativeAct, cleanup, userEvent } from "@testing-library/react-native"
import { createRef, useContext, type ReactNode, type RefAttributes } from "react"
import { findNodeHandle, Linking, TextInput, View } from "react-native"

import {
  actWithNativeCollections as act,
  fireEventWithNativeCollections as fireEvent,
  renderWithNativeCollections as render,
  screen,
} from "../../../collection/__tests__/nativeReceipts"
import { createNativeCollectionBranch } from "../../../collection/CollectionBuilder"
import { NativeCollectionRendererContext } from "../../../collection/renderer"
import { NativeFloatingWindowContext } from "../../../overlays/floating/scope"
import { NativeThemeProvider } from "../../../theme"
import { useNativeTable } from "../context"
import { Table } from "../Table"
import { TableHeader } from "../TableHeader"
import { TableRow } from "../TableRow"
import type { TNativeTableProps, TNativeTableRowProps } from "../types"

jest.unmock("react-native/Libraries/Components/TextInput/TextInput")
const Body = createNativeCollectionBranch<object, { children?: ReactNode }, View>(
  "body",
  (_props, ref, parent) => {
    const table = useNativeTable(),
      renderer = useContext(NativeCollectionRendererContext)
    return (
      <View ref={ref}>
        <renderer.CollectionBranch collection={table.collection} parent={parent} />
      </View>
    )
  },
  (props) => props.children,
)
const item = { id: 0, name: "Zero" }
const columns = [{ id: "name", name: "Name", isRowHeader: true }]
const tree = (
  props: Partial<TNativeTableRowProps<typeof item>> & RefAttributes<View> = {},
  table: TNativeTableProps = {},
) => (
  <NativeThemeProvider>
    <Table {...table}>
      <TableHeader columns={columns} />
      <Body>
        <TableRow id={0} testID="linked-row" item={item} columns={columns} href="/people/0" {...props} />
      </Body>
    </Table>
  </NativeThemeProvider>
)
const press = async (pointerType = "touch", settle = true) => {
  await fireEvent(screen.getByTestId("linked-row"), "pointerDown", {
    nativeEvent: { pointerType, shiftKey: false, metaKey: false, ctrlKey: false, altKey: false },
  })
  await userEvent.setup().press(screen.getByTestId("linked-row"))
  if (settle) await act(() => {})
}
beforeEach(() => {
  jest.useFakeTimers()
  jest.clearAllMocks()
  jest.spyOn(Linking, "openURL").mockResolvedValue(undefined)
})
afterEach(async () => {
  await cleanup()
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})
it.each(["toggle", "replace"] as const)(
  "preserves %s link selection and row/root/navigation ordering",
  async (behavior) => {
    const requests: string[] = []
    jest.mocked(Linking.openURL).mockImplementation(async (href) => {
      requests.push(`navigate:${href}`)
    })
    await render(
      tree(
        { onAction: () => requests.push("row") },
        {
          selectionMode: "multiple",
          selectionBehavior: behavior,
          selectedKeys: new Set(),
          onSelectionChange: (keys) => requests.push(`selection:${keys === "all" ? keys : [...keys].join(",")}`),
          clickableRows: true,
          onRowAction: (key) => requests.push(`root:${key}`),
        },
      ),
    )
    await press("mouse")
    expect(requests).toEqual(behavior === "toggle" ? ["row", "root:0", "navigate:/people/0"] : ["selection:0"])
    expect(screen.getByTestId("linked-row").props.href).toBeUndefined()
    if (behavior === "replace") {
      requests.length = 0
      await press("mouse")
      expect(requests.slice(-3)).toEqual(["row", "root:0", "navigate:/people/0"])
    }
  },
)
it("keeps nonempty toggle links selectable and selection-only disabled links actionable", async () => {
  const changed = jest.fn()
  const options: TNativeTableProps = {
    selectionMode: "multiple",
    selectedKeys: new Set([0]),
    onSelectionChange: changed,
  }
  const view = await render(tree({}, options))
  await press("mouse")
  expect([...changed.mock.calls[0][0]]).toEqual([])
  expect(Linking.openURL).not.toHaveBeenCalled()
  await view.rerender(tree({}, { ...options, disabledKeys: [0], disabledBehavior: "selection" }))
  await press("mouse")
  expect(changed).toHaveBeenCalledTimes(1)
  expect(Linking.openURL).toHaveBeenCalledWith("/people/0")
  await view.rerender(tree({}, { ...options, disabledKeys: [0] }))
  await press()
  expect(Linking.openURL).toHaveBeenCalledTimes(1)
})
it("performs secondary link actions on touch without selecting the row", async () => {
  const changed = jest.fn()
  await render(tree({}, { selectionMode: "multiple", selectionBehavior: "replace", onSelectionChange: changed }))
  await press()
  expect(Linking.openURL).toHaveBeenCalledWith("/people/0")
  expect(changed).not.toHaveBeenCalled()
})
it("retires pending admission and stops navigation after an action deactivates its window", async () => {
  let active = true
  const action = jest.fn(() => {
    active = false
  })
  const content = (
    <NativeFloatingWindowContext.Provider value={() => active}>
      {tree({ onAction: action })}
    </NativeFloatingWindowContext.Provider>
  )
  await render(content)
  await press("touch", false)
  active = false
  await act(() => {})
  expect(action).not.toHaveBeenCalled()
  expect(Linking.openURL).not.toHaveBeenCalled()
  active = true
  await press()
  expect(action).toHaveBeenCalledTimes(1)
  expect(Linking.openURL).not.toHaveBeenCalled()
})
it("reports current navigation failures and retires stale failures without changing original row/editor refs", async () => {
  let reject!: (error: unknown) => void
  jest.mocked(Linking.openURL).mockImplementation(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail
      }),
  )
  const report = jest.fn(),
    row = createRef<View>(),
    editor = createRef<TextInput>()
  const localColumns = [{ ...columns[0], cellRenderer: () => <TextInput ref={editor} testID="held" value="held" /> }]
  const content = (href: string) => (
    <NativeThemeProvider>
      <Table>
        <TableHeader columns={localColumns} />
        <Body>
          <TableRow
            ref={row}
            id={0}
            item={item}
            columns={localColumns}
            testID="linked-row"
            href={href}
            onNavigationError={report}
          />
        </Body>
      </Table>
    </NativeThemeProvider>
  )
  const view = await render(content("first"))
  const originalRow = row.current,
    originalEditor = editor.current!,
    write = jest.spyOn(originalEditor, "setNativeProps")
  await press()
  await view.rerender(content("second"))
  await act(() => reject("stale"))
  expect(report).not.toHaveBeenCalled()
  jest.mocked(Linking.openURL).mockImplementation(() => {
    throw "current"
  })
  await press()
  expect(report).toHaveBeenCalledWith("current", "second")
  expect(row.current).toBe(originalRow)
  expect(editor.current).toBe(originalEditor)
  expect(write).not.toHaveBeenCalled()
  expect(screen.getByTestId("held").props.value).toBe("held")
  jest.mocked(Linking.openURL).mockImplementation(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail
      }),
  )
  await press()
  await view.unmount()
  await reject("unmounted")
  expect(report).toHaveBeenCalledTimes(1)
})
it("leaves an empty href inert when the row has no action or selection", async () => {
  await render(tree({ href: "" }))
  await press()
  expect(Linking.openURL).not.toHaveBeenCalled()
})

const installOriginalRowTags = () => {
  const native = jest.requireActual<typeof import("react-native")>("react-native")
  const installed = native.findNodeHandle as jest.MockedFunction<typeof native.findNodeHandle>
  const original = jest.isMockFunction(installed) ? installed.getMockImplementation()! : native.findNodeHandle
  const tags = new WeakMap<object, number>()
  let next = 80000
  jest.spyOn(native, "findNodeHandle").mockImplementation((view) => {
    const reserved = original(view)
    if (reserved != null && reserved >= 1000000) return reserved
    if (!view || typeof view !== "object") return null
    if (!tags.has(view)) tags.set(view, ++next)
    return tags.get(view)!
  })
}
const rowActivation = (id: number, prevented = false) => {
  const host = screen.getByTestId("linked-row")
  const event = {
    defaultPrevented: prevented,
    persist: jest.fn(),
    isDefaultPrevented: () => event.defaultPrevented,
    preventDefault: () => {
      event.defaultPrevented = true
    },
    nativeEvent: {
      kind: "activation",
      ownerId: host.props.ownerId,
      target: 17,
      source: "android-click",
      activationId: id,
      observedAt: 0,
      scopeOwnerId: "",
      windowId: "window-1",
      epoch: 0,
    },
  }
  return event
}
const activateRow = async (id: number, prevented = false) => {
  const event = rowActivation(id, prevented)
  await act(() => screen.getByTestId("linked-row").props.onNativeActivation(event))
  return event
}

it.each([
  "mouse-selection",
  "Enter",
  "Space",
  "native-activation",
  "root-gated",
  "root-only-on",
  "root-only-off",
] as const)("approved TableRow navigation keeps action-only routing and native selection for %s", async (mode) => {
  installOriginalRowTags()
  const order: string[] = [],
    selections: Array<Array<string | number>> = [],
    originalPresses: unknown[] = []
  const row = createRef<View>(),
    editor = createRef<TextInput>()
  const localColumns = [
    { ...columns[0], cellRenderer: () => <TextInput ref={editor} testID="approved-editor" value="held" /> },
  ]
  const selectable = !mode.startsWith("root-only")
  await render(
    <NativeThemeProvider>
      <Table
        selectionMode={selectable ? "multiple" : "none"}
        selectionBehavior="replace"
        selectedKeys={new Set([0, 1])}
        onSelectionChange={(keys) => {
          const values = keys === "all" ? ["all"] : [...keys]
          selections.push(values)
          order.push(`select:${values.join(",")}`)
        }}
        clickableRows={mode !== "root-gated" && mode !== "root-only-off"}
        onRowAction={(key) => order.push(`root:${key}`)}
      >
        <TableHeader columns={localColumns} />
        <Body>
          <TableRow
            ref={row}
            id={0}
            testID="linked-row"
            item={item}
            columns={localColumns}
            onAction={mode.startsWith("root-only") ? undefined : () => order.push("row")}
            onPress={(event) => {
              order.push("press")
              originalPresses.push(event)
            }}
          />
          <TableRow id={1} testID="approved-other" item={{ id: 1, name: "One" }} columns={columns} />
        </Body>
      </Table>
    </NativeThemeProvider>,
  )
  const originalRow = row.current,
    originalEditor = editor.current!,
    write = jest.spyOn(originalEditor, "setNativeProps")
  let released: unknown
  if (mode === "Enter" || mode === "Space") {
    const key = mode === "Enter" ? "Enter" : " "
    const event = (phase: "down" | "up", timestamp: number) => ({
      persist: jest.fn(),
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
      isDefaultPrevented: () => false,
      nativeEvent: {
        kind: "keyboard",
        ownerId: screen.getByTestId("linked-row").props.ownerId,
        target: 17,
        key,
        nativeCode: key === "Enter" ? 40 : 44,
        phase,
        timestamp,
        repeat: false,
        cancelled: false,
        shiftKey: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        nativeDefaultHandled: true,
      },
    })
    await act(() => screen.getByTestId("linked-row").props.onNativeKey(event("down", 0)))
    await act(() => jest.advanceTimersByTime(200))
    released = event("up", 200)
    await act(() => screen.getByTestId("linked-row").props.onNativeKey(released))
  } else if (mode === "mouse-selection") {
    await fireEvent(screen.getByTestId("linked-row"), "pointerDown", { nativeEvent: { pointerType: "mouse" } })
    const event = (timestamp: number) => ({
      persist: jest.fn(),
      target: findNodeHandle(row.current),
      currentTarget: findNodeHandle(row.current),
      nativeEvent: { target: 17, timestamp, identifier: 0, locationX: 0, locationY: 0, pageX: 0, pageY: 0 },
    })
    await act(() => screen.getByTestId("linked-row").props.onResponderGrant(event(0)))
    await act(() => jest.advanceTimersByTime(200))
    released = event(200)
    await act(() => screen.getByTestId("linked-row").props.onResponderRelease(released))
  } else released = await activateRow(1)
  await act(() => jest.runOnlyPendingTimers())
  const selectionOnly = mode === "Space" || mode === "mouse-selection"
  expect(order).toEqual(
    selectionOnly
      ? ["select:0", "press"]
      : mode === "root-only-off"
        ? []
        : mode === "root-only-on"
          ? ["root:0", "press"]
          : mode === "root-gated"
            ? ["row", "press"]
            : ["row", "root:0", "press"],
  )
  expect(selections).toEqual(selectionOnly ? [[0]] : [])
  if (mode !== "root-only-off") expect(originalPresses).toEqual([released])
  else expect(originalPresses).toEqual([])
  expect(Linking.openURL).not.toHaveBeenCalled()
  if (selectable) {
    expect(screen.getByTestId("linked-row").props.accessibilityState.selected).toBe(true)
    expect(screen.getByTestId("approved-other").props.accessibilityState.selected).toBe(true)
  }
  expect(row.current).toBe(originalRow)
  expect(editor.current).toBe(originalEditor)
  expect(write).not.toHaveBeenCalled()
  expect(screen.getByTestId("approved-editor").props.value).toBe("held")
})

it.each(["app://people/0", "../people/0", "#person-0"])(
  "approved TableRow navigation sends exact URI %s after actions and before release press",
  async (href) => {
    installOriginalRowTags()
    const order: string[] = [],
      presses: unknown[] = []
    jest.mocked(Linking.openURL).mockImplementation(async (uri) => {
      order.push(`OS:${uri}`)
    })
    await render(
      tree(
        {
          href,
          onAction: () => {
            order.push("row")
            return false
          },
          onPress: (event) => {
            order.push("press")
            presses.push(event)
            event.preventDefault()
          },
        },
        { clickableRows: true, onRowAction: (key) => order.push(`root:${key}`) },
      ),
    )
    await activateRow(1, true)
    expect(order).toEqual([])
    expect(Linking.openURL).not.toHaveBeenCalled()
    const event = await activateRow(2)
    expect(order).toEqual(["row", "root:0", `OS:${href}`, "press"])
    expect(Linking.openURL).toHaveBeenCalledTimes(1)
    expect(Linking.openURL).toHaveBeenLastCalledWith(href)
    expect(presses).toEqual([event])
    expect(event.defaultPrevented).toBe(true)
  },
)

it("approved TableRow navigation reports exact URI errors and retires replaced/unmounted requests with original refs", async () => {
  installOriginalRowTags()
  const pending: Array<(error: unknown) => void> = []
  jest.mocked(Linking.openURL).mockImplementation(
    () =>
      new Promise((_resolve, reject) => {
        pending.push(reject)
      }),
  )
  const report = jest.fn(),
    row = createRef<View>(),
    editor = createRef<TextInput>()
  const localColumns = [
    { ...columns[0], cellRenderer: () => <TextInput ref={editor} testID="approved-held" value="held" /> },
  ]
  const content = (href: string) => tree({ href, ref: row, columns: localColumns, onNavigationError: report })
  const view = await render(content("../first"))
  const originalRow = row.current,
    originalEditor = editor.current!,
    write = jest.spyOn(originalEditor, "setNativeProps")
  await activateRow(1)
  await view.rerender(content("#second"))
  await act(() => pending[0]("stale"))
  expect(report).not.toHaveBeenCalled()
  jest.mocked(Linking.openURL).mockImplementation(() => {
    throw "current"
  })
  await activateRow(2)
  expect(report).toHaveBeenCalledTimes(1)
  expect(report).toHaveBeenLastCalledWith("current", "#second")
  jest.mocked(Linking.openURL).mockImplementation(
    () =>
      new Promise((_resolve, reject) => {
        pending.push(reject)
      }),
  )
  await activateRow(3)
  const retained = screen.getByTestId("linked-row").props.onNativeActivation
  const staleActivation = rowActivation(4)
  expect(row.current).toBe(originalRow)
  expect(editor.current).toBe(originalEditor)
  expect(write).not.toHaveBeenCalled()
  expect(screen.getByTestId("approved-held").props.value).toBe("held")
  await view.unmount()
  await nativeAct(() => pending[1]("unmounted"))
  await nativeAct(() => retained(staleActivation))
  expect(report).toHaveBeenCalledTimes(1)
  expect(jest.mocked(Linking.openURL).mock.calls.map(([href]) => href)).toEqual(["../first", "#second", "#second"])
})

it("approved TableRow navigation suppresses OS handoff when the action retires its window", async () => {
  installOriginalRowTags()
  let active = true
  const rowAction = jest.fn(() => {
      active = false
    }),
    rootAction = jest.fn()
  await render(
    <NativeFloatingWindowContext.Provider value={() => active}>
      {tree({ href: "#held", onAction: rowAction }, { clickableRows: true, onRowAction: rootAction })}
    </NativeFloatingWindowContext.Provider>,
  )
  await activateRow(1)
  expect(rowAction).toHaveBeenCalledTimes(1)
  expect(rootAction).toHaveBeenCalledTimes(1)
  expect(Linking.openURL).not.toHaveBeenCalled()
  await activateRow(2)
  expect(rowAction).toHaveBeenCalledTimes(1)
  expect(rootAction).toHaveBeenCalledTimes(1)
})
