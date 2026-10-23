import "../../../collection/__tests__/nativeReceipts"

import { cleanup, userEvent } from "@testing-library/react-native"
import { createRef } from "react"
import { findNodeHandle, type View } from "react-native"

import {
  actWithNativeCollections as act,
  renderWithNativeCollections as render,
  screen,
} from "../../../collection/__tests__/nativeReceipts"
import { NativeFloatingWindowContext } from "../../../overlays/floating/scope"
import { NativeThemeProvider } from "../../../theme"
import { Table } from "../Table"
import { TableBody } from "../TableBody"
import { TableHeader } from "../TableHeader"
import { TableRow } from "../TableRow"
import type { TNativeTableProps } from "../types"

beforeEach(() => jest.useFakeTimers())
afterEach(async () => {
  await cleanup()
  jest.clearAllTimers()
  jest.useRealTimers()
})
const items = [
  { id: 0, name: "Zero" },
  { id: "beta", name: "Beta" },
]
const columns = [{ id: "name", name: "Name", isRowHeader: true }]
const node = (props: TNativeTableProps = {}, rows = items) => (
  <NativeThemeProvider>
    <Table accessibilityLabel="Rows" {...props}>
      <TableHeader columns={columns} />
      <TableBody items={rows} columns={columns} />
    </Table>
  </NativeThemeProvider>
)
const press = async (target: Parameters<ReturnType<typeof userEvent.setup>["press"]>[0]) => {
  await userEvent.setup().press(target)
  await act(() => {})
}
it("repeats held requests with typed zero/string keys and the select-all sentinel", async () => {
  const changed = jest.fn(),
    held = new Set<string | number>()
  await render(node({ selectionMode: "multiple", selectedKeys: held, onSelectionChange: changed }))
  const rows = screen.getAllByRole("checkbox", { name: "Select Row" })
  await press(rows[0])
  await press(rows[0])
  await press(rows[1])
  expect(changed.mock.calls.map(([keys]) => [...keys])).toEqual([[0], [0], ["beta"]])
  expect(rows[0].props.accessibilityState).toMatchObject({ checked: false })
  expect(held.size).toBe(0)
  await press(screen.getByRole("checkbox", { name: "Select All" }))
  expect(changed).toHaveBeenLastCalledWith("all")
})
it("updates uncontrolled selection and partial/all header presentation without mutating defaults", async () => {
  const defaults = new Set([0])
  await render(node({ selectionMode: "multiple", defaultSelectedKeys: defaults }))
  expect(screen.getByRole("checkbox", { name: "Select All" }).props.accessibilityState).toMatchObject({
    checked: "mixed",
  })
  await press(screen.getAllByRole("checkbox", { name: "Select Row" })[1])
  expect(screen.getByRole("checkbox", { name: "Select All" }).props.accessibilityState).toMatchObject({ checked: true })
  await press(screen.getByRole("checkbox", { name: "Select All" }))
  expect(
    screen
      .getAllByRole("checkbox", { name: "Select Row" })
      .every((row) => row.props.accessibilityState.checked === false),
  ).toBe(true)
  expect([...defaults]).toEqual([0])
})
it("keeps disabled selection distinct from controlled selected output and hides checkboxes in replace mode", async () => {
  const changed = jest.fn()
  const view = await render(
    node({
      selectionMode: "multiple",
      selectedKeys: new Set([0]),
      disabledKeys: new Set([0]),
      onSelectionChange: changed,
    }),
  )
  const row = screen.getAllByRole("checkbox", { name: "Select Row" })[0]
  expect(row.props.accessibilityState).toMatchObject({ checked: true, disabled: true })
  await press(row)
  expect(changed).not.toHaveBeenCalled()
  await view.rerender(node({ selectionMode: "multiple", selectionBehavior: "replace", selectedKeys: new Set([0]) }))
  expect(screen.queryByRole("checkbox")).toBeNull()
})
it("preserves required single selection without adding a select-all checkbox", async () => {
  const changed = jest.fn()
  await render(
    node({
      selectionMode: "single",
      disallowEmptySelection: true,
      defaultSelectedKeys: [0],
      onSelectionChange: changed,
    }),
  )
  expect(screen.queryByRole("checkbox", { name: "Select All" })).toBeNull()
  await press(screen.getAllByRole("checkbox", { name: "Select Row" })[0])
  expect(changed).not.toHaveBeenCalled()
  await press(screen.getAllByRole("checkbox", { name: "Select Row" })[1])
  expect([...changed.mock.calls[0][0]]).toEqual(["beta"])
})
it("publishes actual row-header relationships and selected cell semantics including the selection column", async () => {
  await render(node({ selectionMode: "multiple", selectedKeys: new Set([0]) }))
  const cells = screen.container.queryAll(
    (host) => JSON.parse(host.props.nativeCollectionSemantics || "null")?.kind === "cell",
  )
  const data = cells.map((cell) => JSON.parse(cell.props.nativeCollectionSemantics))
  expect(data.map((cell) => [cell.rowIndex, cell.columnIndex])).toEqual([
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
    [2, 0],
    [2, 1],
  ])
  expect(data[2].rowHeaderTargets).toHaveLength(1)
  expect(data[2].rowHeaderTargets[0]).toBeGreaterThan(0)
  expect(data[2].selected).toBe(true)
  expect(data[4].selected).toBe(false)
  expect(data[3].heading).toBe(true)
})
it("uses current custom selection labels and preserves an owner echo", async () => {
  const changed = jest.fn()
  const labels = { selection: { selectAllRowsAriaLabel: "Everyone", selectRowAriaLabel: "This row" } }
  const view = await render(
    node({ selectionMode: "multiple", selectedKeys: new Set(), labels, onSelectionChange: changed }),
  )
  await press(screen.getAllByRole("checkbox", { name: "This row" })[0])
  const request = changed.mock.calls[0][0]
  await view.rerender(node({ selectionMode: "multiple", selectedKeys: request, labels, onSelectionChange: changed }))
  expect(screen.getAllByRole("checkbox", { name: "This row" })[0].props.accessibilityState).toMatchObject({
    checked: true,
  })
  expect(screen.getByRole("checkbox", { name: "Everyone" }).props.accessibilityState).toMatchObject({
    checked: "mixed",
  })
})

it("retains the required zero/empty row identities without the pinned source's falsy successor truncation", async () => {
  const changed = jest.fn()
  await render(
    node({ selectionMode: "multiple", selectedKeys: new Set(), onSelectionChange: changed }, [
      { id: 0, name: "Zero" },
      { id: "", name: "Empty" },
    ]),
  )
  const rows = screen.getAllByRole("checkbox", { name: "Select Row" })
  expect(rows).toHaveLength(2)
  await press(rows[1])
  expect([...changed.mock.calls[0][0]]).toEqual([""])
})

it.each([undefined, false, true])(
  "admits the table row action only with both callback and clickableRows=%s",
  async (clickableRows) => {
    const action = jest.fn()
    await render(node({ clickableRows, onRowAction: action }))
    await press(screen.getByTestId("table-row-number:0"))
    expect(action.mock.calls).toEqual(clickableRows ? [[0]] : [])
  },
)

it("keeps row actions primary until an owner echoes selection, then toggles the selected row without another action", async () => {
  const action = jest.fn(),
    changed = jest.fn()
  const view = await render(
    node({
      selectionMode: "multiple",
      selectedKeys: new Set(),
      clickableRows: true,
      onRowAction: action,
      onSelectionChange: changed,
    }),
  )
  await press(screen.getByTestId("table-row-number:0"))
  expect(action.mock.calls).toEqual([[0]])
  expect(changed).not.toHaveBeenCalled()
  await press(screen.getAllByRole("checkbox", { name: "Select Row" })[0])
  expect(action.mock.calls).toEqual([[0]])
  const selected = changed.mock.calls[0][0]
  await view.rerender(
    node({
      selectionMode: "multiple",
      selectedKeys: selected,
      clickableRows: true,
      onRowAction: action,
      onSelectionChange: changed,
    }),
  )
  await press(screen.getByTestId("table-row-number:0"))
  expect([...changed.mock.calls[1][0]]).toEqual([])
  expect([...selected]).toEqual([0])
  expect(action.mock.calls).toEqual([[0]])
})

it("allows action for selection-only disabled keys while all-disabled rows reject action", async () => {
  const action = jest.fn()
  const view = await render(
    node({ selectionMode: "multiple", disabledKeys: [0], clickableRows: true, onRowAction: action }),
  )
  await press(screen.getByTestId("table-row-number:0"))
  expect(action).not.toHaveBeenCalled()
  await view.rerender(
    node({
      selectionMode: "multiple",
      disabledKeys: [0],
      disabledBehavior: "selection",
      clickableRows: true,
      onRowAction: action,
    }),
  )
  await press(screen.getByTestId("table-row-number:0"))
  expect(action.mock.calls).toEqual([[0]])
  expect(screen.getAllByRole("checkbox", { name: "Select Row" })[0].props.accessibilityState.disabled).toBe(true)
})

it("takes row-header ownership from the header even when body metadata differs", async () => {
  await render(
    <NativeThemeProvider>
      <Table>
        <TableHeader columns={columns} />
        <TableBody items={items} columns={[{ id: "name", name: "Body", isRowHeader: false }]} />
      </Table>
    </NativeThemeProvider>,
  )
  const cells = screen.container.queryAll(
    (host) => JSON.parse(host.props.nativeCollectionSemantics || "null")?.kind === "cell",
  )
  expect(JSON.parse(cells[1].props.nativeCollectionSemantics).heading).toBe(true)
  expect(JSON.parse(cells[1].props.nativeCollectionSemantics).rowHeaderTargets).toHaveLength(1)
})

it("rejects a committed header without a row-header column, matching the canonical validation", async () => {
  await expect(
    render(
      <NativeThemeProvider>
        <Table>
          <TableHeader columns={[{ id: "name", name: "Name" }]} />
          <TableBody items={items} columns={columns} />
        </Table>
      </NativeThemeProvider>,
    ),
  ).rejects.toThrow("A table must have at least one Column with the isRowHeader prop set to true")
})

it("keeps the outer selection-cell radius separate from the first data cell", async () => {
  await render(node({ selectionMode: "multiple" }))
  const cells = screen.container.queryAll(
    (host) => JSON.parse(host.props.nativeCollectionSemantics || "null")?.kind === "cell",
  )
  expect(cells[2]).toHaveStyle({ borderTopLeftRadius: 5 })
  expect(cells[3]).toHaveStyle({ borderTopLeftRadius: 0 })
})

it("rejects a queued selection after its original native window becomes inactive", async () => {
  let active = true
  const changed = jest.fn()
  await render(
    <NativeFloatingWindowContext.Provider value={() => active}>
      {node({ selectionMode: "multiple", onSelectionChange: changed })}
    </NativeFloatingWindowContext.Provider>,
  )
  await userEvent.setup().press(screen.getAllByRole("checkbox", { name: "Select Row" })[0])
  active = false
  await act(() => {})
  expect(changed).not.toHaveBeenCalled()
})

it("keeps final row outline styles after an original native focus acknowledgment", async () => {
  const original = createRef<View>()
  await render(
    <NativeThemeProvider>
      <Table selectionMode="single">
        <TableHeader columns={columns} />
        <TableBody
          columns={columns}
          isLoading
          renderLoadingState={() => (
            <TableRow
              ref={original}
              id="focus"
              item={items[0]}
              columns={columns}
              style={{ outlineWidth: 0, outlineColor: "red" }}
            />
          )}
        />
      </Table>
    </NativeThemeProvider>,
  )
  const row = screen.getByTestId("table-row-string:focus")
  await act(() =>
    row.props.onNativeFocusChange({
      nativeEvent: {
        ownerId: row.props.ownerId,
        target: findNodeHandle(original.current),
        isFocused: true,
        isFocusVisible: true,
      },
    }),
  )
  expect(screen.getByTestId("table-row-string:focus")).toHaveStyle({ outlineWidth: 0, outlineColor: "red" })
})
