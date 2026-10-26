import { writeFileSync } from "node:fs"

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import React, { createRef, useContext } from "react"
import {
  Cell,
  ColumnResizer,
  ResizableTableContainer,
  Row,
  TableBody,
  TableColumnResizeStateContext,
  TableHeader,
  TableStateContext,
  TableContext,
  type ColumnProps,
} from "react-aria-components"
import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest"

import Table from "../../../../packages/react/src/components/Table/Table"
import Column from "../../../../packages/react/src/components/Table/components/TableColumn/TableColumn"
import type { TTableProps } from "../../../../packages/react/src/components/Table/helpers"

type TRender = NonNullable<ColumnProps["render"]>
type TValues = Parameters<TRender>[1]
const records: unknown[] = []
let state: NonNullable<React.ContextType<typeof TableStateContext>>
let layout: React.ContextType<typeof TableColumnResizeStateContext>
const Probe = () => {
  state = useContext(TableStateContext)!
  layout = useContext(TableColumnResizeStateContext)
  return null
}
const receive = () => vi.fn<TRender>((props) => <th {...props} />)
const tree = (column: ColumnProps = {}, table: TTableProps = {}, resizer = false) => (
  <Table aria-label="Columns" {...table}>
    <TableHeader>
      <Column id="name" isRowHeader {...column}>
        {column.children ?? (
          <>
            Name
            <Probe />
            {resizer && <ColumnResizer aria-label="Size" />}
          </>
        )}
      </Column>
      <Column id="other">Other</Column>
    </TableHeader>
    <TableBody>
      <Row id="row">
        <Cell>Alpha</Cell>
        <Cell>Beta</Cell>
      </Row>
    </TableBody>
  </Table>
)
beforeEach(() => vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(500))
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})
afterAll(() =>
  writeFileSync(
    "/private/tmp/codon-table-column-source.json",
    JSON.stringify(
      { records, scope: "Actual unchanged CUI/RAC Column/container/handle; no native acceptance" },
      null,
      2,
    ) + "\n",
  ),
)

it("provides nine raw fields and the original error without a resizing container", () => {
  const renderColumn = receive()
  render(tree({ render: renderColumn }))
  const values = renderColumn.mock.calls.at(-1)![1]
  expect(Object.keys(values).sort()).toEqual(
    [
      "allowsSorting",
      "isFocusVisible",
      "isFocused",
      "isHovered",
      "isPressed",
      "isResizing",
      "sort",
      "sortDirection",
      "startResize",
    ].sort(),
  )
  expect(values).toMatchObject({
    allowsSorting: undefined,
    isFocused: false,
    isFocusVisible: false,
    isHovered: false,
    isPressed: false,
    isResizing: false,
    sortDirection: undefined,
  })
  expect(Object.hasOwn(values, "defaultChildren")).toBe(false)
  expect(() => values.startResize()).toThrow("Wrap your <Table> in a <ResizableTableContainer>")
  records.push({ scenario: "raw-fields", fields: Object.keys(values), values })
})
it("sorts with the actual key/direction and held owner descriptor even without allowsSorting", () => {
  const renderColumn = receive(),
    changed = vi.fn()
  const view = render(
    <TableContext.Provider
      value={{ sortDescriptor: { column: "name", direction: "ascending" }, onSortChange: changed }}
    >
      {tree({ render: renderColumn })}
    </TableContext.Provider>,
  )
  const values = () => renderColumn.mock.calls.at(-1)![1]
  act(() => {
    values().sort("descending")
    values().sort("descending")
  })
  expect(changed.mock.calls).toEqual([
    [{ column: "name", direction: "descending" }],
    [{ column: "name", direction: "descending" }],
  ])
  expect(values().sortDirection).toBe("ascending")
  view.rerender(
    <TableContext.Provider
      value={{ sortDescriptor: { column: "name", direction: "descending" }, onSortChange: changed }}
    >
      {tree({ render: renderColumn })}
    </TableContext.Provider>,
  )
  expect(values().sortDirection).toBe("descending")
  records.push({ scenario: "sort-veto-echo", calls: changed.mock.calls })
})
it("routes children/style defaults and preserves the original header and held editor through renderer changes", () => {
  const ref = createRef<HTMLTableCellElement | HTMLDivElement>(),
    editor = createRef<HTMLInputElement>()
  const renderColumn = receive(),
    children = vi.fn(() => <input ref={editor} aria-label="Held" value="" onChange={() => {}} />)
  const style = vi.fn((values) => ({ ...values.defaultStyle, padding: 9 }))
  const view = render(tree({ ref, children, style }))
  const original = ref.current,
    input = editor.current
  expect(children.mock.calls.at(-1)![0]).toHaveProperty("defaultChildren", undefined)
  expect(style.mock.calls.at(-1)![0].defaultStyle).toEqual({})
  for (const callback of [renderColumn, receive(), undefined]) {
    view.rerender(tree({ ref, children, style, render: callback }))
    expect(ref.current === original).toBe(true)
    expect(editor.current === input).toBe(true)
  }
  records.push({ scenario: "original-header-editor", styleDefault: style.mock.calls.at(-1)![0].defaultStyle })
})
it("limits hover and press state to sortable headers", async () => {
  const renderColumn = receive(),
    user = userEvent.setup()
  const view = render(tree({ render: renderColumn }))
  const header = screen.getByRole("columnheader", { name: "Name" })
  await user.hover(header)
  expect(renderColumn.mock.calls.at(-1)![1].isHovered).toBe(false)
  await user.unhover(header)
  view.rerender(tree({ render: renderColumn, allowsSorting: true }))
  await user.hover(header)
  expect(renderColumn.mock.calls.at(-1)![1].isHovered).toBe(true)
  await user.pointer([{ target: header, keys: "[MouseLeft>]" }])
  expect(renderColumn.mock.calls.at(-1)![1].isPressed).toBe(true)
  await user.pointer([{ target: header, keys: "[/MouseLeft]" }])
  expect(renderColumn.mock.calls.at(-1)![1].isPressed).toBe(false)
})
it("retains the complete nine-field sizing state and actual Table identity", () => {
  render(<ResizableTableContainer>{tree({ width: 200 })}</ResizableTableContainer>)
  expect(layout?.tableState).toBe(state)
  expect(Object.keys(layout!).sort()).toEqual(
    [
      "columnWidths",
      "endResize",
      "getColumnMaxWidth",
      "getColumnMinWidth",
      "getColumnWidth",
      "resizingColumn",
      "startResize",
      "tableState",
      "updateResizedColumns",
    ].sort(),
  )
  expect([...layout!.columnWidths]).toEqual([
    ["name", 200],
    ["other", 300],
  ])
  expect(layout!.getColumnMinWidth("name")).toBe(75)
  expect(layout!.getColumnMaxWidth("name")).toBe(Number.MAX_SAFE_INTEGER)
  act(() => layout!.updateResizedColumns("name", 240))
  expect(layout!.getColumnWidth("name")).toBe(200)
  records.push({ scenario: "resize-state", widths: [...layout!.columnWidths], fields: Object.keys(layout!) })
})
it("starts real resizing, disables navigation, sends controlled width requests and restores on Escape", async () => {
  vi.useFakeTimers()
  const renderColumn = receive(),
    started = vi.fn(),
    changed = vi.fn(),
    ended = vi.fn()
  render(
    <ResizableTableContainer onResizeStart={started} onResize={changed} onResizeEnd={ended}>
      {tree({ render: renderColumn, width: 200 }, {}, true)}
    </ResizableTableContainer>,
  )
  act(() => renderColumn.mock.calls.at(-1)![1].startResize())
  await act(() => vi.advanceTimersByTimeAsync(401))
  expect(renderColumn.mock.calls.at(-1)![1].isResizing).toBe(true)
  expect(state.isKeyboardNavigationDisabled).toBe(true)
  expect(started).toHaveBeenCalledTimes(1)
  const slider = screen.getByRole("slider")
  expect(document.activeElement).toBe(slider)
  fireEvent.keyDown(slider, { key: "ArrowRight" })
  expect(changed.mock.calls.at(-1)![0].get("name")).toBe(210)
  expect(layout!.getColumnWidth("name")).toBe(200)
  fireEvent.keyDown(slider, { key: "Escape" })
  expect(ended.mock.calls.at(-1)![0].get("name")).toBe(210)
  expect(renderColumn.mock.calls.at(-1)![1].isResizing).toBe(false)
  expect(state.isKeyboardNavigationDisabled).toBe(false)
  records.push({
    scenario: "raw-resize-keyboard",
    starts: started.mock.calls.length,
    changes: changed.mock.calls.map(([map]) => [...map]),
    ends: ended.mock.calls.length,
  })
})
it("keeps the original resize input separate from caller children and their defaultChildren", () => {
  const children = vi.fn((values) => <span>Custom resize content {String(values.defaultChildren)}</span>)
  const renderHandle = vi.fn((props) => <div {...props} />)
  render(
    <ResizableTableContainer>
      <Table aria-label="Custom resizer">
        <TableHeader>
          <Column id="name" isRowHeader width={200}>
            Name
            <ColumnResizer children={children} render={renderHandle} />
          </Column>
          <Column id="other">Other</Column>
        </TableHeader>
        <TableBody>
          <Row id="row">
            <Cell>Alpha</Cell>
            <Cell>Beta</Cell>
          </Row>
        </TableBody>
      </Table>
    </ResizableTableContainer>,
  )
  expect(children.mock.calls.at(-1)![0].defaultChildren).toBeUndefined()
  expect(screen.getByText("Custom resize content undefined")).toBeTruthy()
  expect(screen.getByRole("slider")).toBeTruthy()
  records.push({ scenario: "custom-resizer-content", inputPresent: true, defaultChildren: "undefined" })
})
