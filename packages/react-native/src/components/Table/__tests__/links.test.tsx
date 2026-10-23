import "../../../collection/__tests__/nativeReceipts"

import { cleanup, userEvent } from "@testing-library/react-native"
import { createRef, useContext, type ReactNode } from "react"
import { Linking, TextInput, View } from "react-native"

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
const tree = (props: Partial<TNativeTableRowProps<typeof item>> = {}, table: TNativeTableProps = {}) => (
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
