import { writeFileSync } from "node:fs"

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import React, { useContext } from "react"
import {
  Cell,
  Column,
  Row,
  SelectableCollectionContext,
  TableBody as BaseBody,
  TableHeader as BaseHeader,
  TableStateContext,
} from "react-aria-components"
import { afterAll, afterEach, expect, it, vi } from "vitest"

import Table from "../../../../packages/react/src/components/Table/Table"
import TableBody from "../../../../packages/react/src/components/Table/components/TableBody/TableBody"
import TableHeader from "../../../../packages/react/src/components/Table/components/TableHeader/TableHeader"
import type { TTableProps } from "../../../../packages/react/src/components/Table/helpers"

const records: unknown[] = []
let current: React.ContextType<typeof TableStateContext>
const Probe = () => {
  current = useContext(TableStateContext)
  return null
}
const items = [
  { id: "a", name: "Alpha", value: 0 },
  { id: "b", name: "Beta", value: false },
]
const columns = [
  {
    id: "name",
    name: "Name",
    isRowHeader: true,
    accessor: (row: (typeof items)[number]) => (
      <>
        <Probe />
        {row.name}
      </>
    ),
    sort: { enabled: true, criteriaID: "name-sort" },
  },
  { id: "value", name: "Value" },
]
const tree = (props: Partial<TTableProps<(typeof items)[number]>> = {}) => (
  <Table aria-label="Source table" {...props}>
    <TableHeader
      columns={columns}
      render={(rootProps) => (
        <thead {...rootProps}>
          <Probe />
          {rootProps.children}
        </thead>
      )}
    />
    <TableBody items={items} columns={columns} rowKey={(row) => row.id} />
  </Table>
)
const navigation = (read: () => unknown) => {
  try {
    return read()
  } catch (failure) {
    return { error: failure instanceof Error ? failure.message : String(failure) }
  }
}
const trace = () => {
  if (!current) throw new Error("Actual TableStateContext was not rendered")
  const collection = current.collection
  return {
    stateFields: Object.keys(current).sort(),
    roots: [...collection].map((node) => node.type),
    first: collection.getFirstKey(),
    last: collection.getLastKey(),
    nextRow: collection.getKeyAfter("a"),
    previousRow: navigation(() => collection.getKeyBefore("b")),
    previousFirst: collection.getKeyBefore("a"),
    nextColumn: collection.getKeyAfter("name"),
    previousColumn: collection.getKeyBefore("value"),
    columns: collection.columns.map((node) => ({
      key: node.key,
      index: node.index,
      colIndex: node.colIndex,
      colSpan: node.colSpan,
    })),
    rows: collection.rows.map((node) => ({
      key: node.key,
      type: node.type,
      index: node.index,
      level: node.level,
      value: node.value,
    })),
    headerRows: collection.headerRows.map((row) => ({
      type: row.type,
      key: row.key,
      index: row.index,
      children: [...collection.getChildren(row.key)].map((node) => node.key),
    })),
    rowHeaderKeys: [...collection.rowHeaderColumnKeys],
    bodyCells: [...collection.getChildren("a")].map((node) => ({
      type: node.type,
      index: node.index,
      colIndex: node.colIndex,
      colSpan: node.colSpan,
      textValue: node.textValue,
    })),
    rowText: collection.getTextValue("a"),
    showSelectionCheckboxes: current.showSelectionCheckboxes,
    disabledKeys: [...current.disabledKeys],
    sortDescriptor: current.sortDescriptor,
    expandedKeys: [...current.expandedKeys],
    treeColumn: current.treeColumn,
    isKeyboardNavigationDisabled: current.isKeyboardNavigationDisabled,
  }
}
afterEach(() => {
  cleanup()
  current = null
})
afterAll(() =>
  writeFileSync(
    "/private/tmp/codon-table-state-oracle.json",
    JSON.stringify({ scope: "Actual canonical Table/state collection; no native acceptance", records }, null, 2) + "\n",
  ),
)

it("records the actual complete Table state and specialized collection", () => {
  render(tree())
  const record = trace()
  expect(record.roots).toEqual(["tableheader", "tablebody"])
  expect([record.first, record.last, record.nextRow, record.previousRow, record.previousFirst]).toEqual([
    "a",
    "b",
    "b",
    "a",
    null,
  ])
  expect(record.headerRows[0].children).toEqual(["name", "value"])
  records.push({ scenario: "base", ...record })
})
it("records the actual source header-only rejection", () => {
  expect(() =>
    render(
      <Table aria-label="Header only">
        <TableHeader columns={columns} />
      </Table>,
    ),
  ).toThrow("node.render is not a function")
  records.push({ scenario: "header-only", error: "node.render is not a function" })
})

it("retains repeated owner-vetoed programmatic selection requests", async () => {
  const change = vi.fn()
  render(tree({ selectionMode: "multiple", selectedKeys: new Set(), onSelectionChange: change }))
  await act(() => current!.selectionManager.toggleSelection("a"))
  await act(() => current!.selectionManager.toggleSelection("a"))
  expect(change.mock.calls.map(([value]) => [...value])).toEqual([["a"], ["a"]])
  expect(current!.selectionManager.isSelected("a")).toBe(false)
  records.push({ scenario: "selection-veto", ...trace(), requests: change.mock.calls.map(([value]) => [...value]) })
})
it("keeps source query sorting authoritative when the state requests an explicit direction", async () => {
  const change = vi.fn()
  render(tree({ columns, queryControls: { sorting: { activeSorts: [], onSortChange: change } } }))
  await act(() => current!.sort("name", "descending"))
  expect(change.mock.calls[0][0][0].sortDirection).toBe("Ascending")
  expect(current!.sortDescriptor).toBeNull()
  records.push({ scenario: "sort-veto", requests: change.mock.calls, ...trace() })
})
it("retains repeated expansion vetoes, typed keys and independent keyboard-navigation state", async () => {
  const change = vi.fn()
  render(tree({ expandedKeys: new Set(), onExpandedChange: change, treeColumn: "name" }))
  await act(() => current!.toggleKey("a"))
  await act(() => current!.toggleKey("a"))
  expect(change.mock.calls.map(([value]) => [...value])).toEqual([["a"], ["a"]])
  await act(() => current!.setKeyboardNavigationDisabled(true))
  expect(current!.isKeyboardNavigationDisabled).toBe(true)
  await act(() => current!.setKeyboardNavigationDisabled(false))
  expect(current!.isKeyboardNavigationDisabled).toBe(false)
  records.push({ scenario: "expanded-veto", requests: change.mock.calls.map(([value]) => [...value]), ...trace() })
})
it("records the actual filtered collection and its cached row arrays", () => {
  render(
    <SelectableCollectionContext.Provider value={{ filter: (_text, node) => node.key === "b" }}>
      {tree()}
    </SelectableCollectionContext.Provider>,
  )
  expect(current!.collection.getItem("a")).toBeNull()
  records.push({ scenario: "filtered", ...trace() })
})
it("filters by actual child-cell nodes rather than row nodes", () => {
  render(
    <SelectableCollectionContext.Provider value={{ filter: (_text, node) => node.parentKey === "b" }}>
      {tree()}
    </SelectableCollectionContext.Provider>,
  )
  expect(current!.collection.rows.map((node) => node.key)).toEqual(["b"])
  expect(current!.collection.getFirstKey()).toBe("b")
  records.push({ scenario: "cell-filtered", ...trace() })
})

it("records original key-default behavior after navigation is disabled", async () => {
  render(tree({ selectionMode: "multiple" }))
  const grid = screen.getByRole("grid")
  await act(() => current!.selectionManager.setFocusedKey("a"))
  await act(() => current!.setKeyboardNavigationDisabled(true))
  fireEvent.keyDown(grid, { key: "ArrowDown" })
  expect(current!.selectionManager.focusedKey).toBe("a")
  fireEvent.keyDown(grid, { key: " ", code: "Space" })
  records.push({
    scenario: "navigation-disabled",
    focusedKey: current!.selectionManager.focusedKey,
    selectedKeys: [...current!.selectionManager.selectedKeys],
  })
})
it("supports a real spanning cell and rejects a real cell-count mismatch", () => {
  const raw = (span: number) => (
    <Table aria-label="Spans">
      <BaseHeader>
        <Column id="name" isRowHeader>
          Name
        </Column>
        <Column id="value">Value</Column>
      </BaseHeader>
      <BaseBody>
        <Row id="a">
          <Cell colSpan={span}>
            <Probe />
            Span
          </Cell>
        </Row>
      </BaseBody>
    </Table>
  )
  render(raw(2))
  const cell = [...current!.collection.getChildren("a")][0]
  expect([cell.colSpan, cell.colIndex]).toEqual([2, null])
  records.push({ scenario: "span", cell: { colSpan: cell.colSpan, colIndex: cell.colIndex }, ...trace() })
  cleanup()
  expect(() => render(raw(1))).toThrow("Cell count must match column count")
})
it("records the actual column-versus-row key collision outcome", () => {
  let error: string | null = null
  try {
    render(
      <Table aria-label="Collision">
        <BaseHeader>
          <Column id="same" isRowHeader>
            Name
          </Column>
        </BaseHeader>
        <BaseBody>
          <Row id="same">
            <Cell>
              <Probe />
              Value
            </Cell>
          </Row>
        </BaseBody>
      </Table>,
    )
  } catch (failure) {
    error = failure instanceof Error ? failure.message : String(failure)
  }
  records.push({ scenario: "key-collision", error, survivingType: current?.collection.getItem("same")?.type ?? null })
})
