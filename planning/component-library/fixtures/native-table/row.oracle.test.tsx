import { writeFileSync } from "node:fs"

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import React, { createRef } from "react"
import { TableBody as SourceBody } from "react-aria-components"
import { afterAll, afterEach, expect, it, vi } from "vitest"

import Table from "../../../../packages/react/src/components/Table/Table"
import TableHeader from "../../../../packages/react/src/components/Table/components/TableHeader/TableHeader"
import TableRow from "../../../../packages/react/src/components/Table/components/TableRow/TableRow"
import type { TTableRowProps } from "../../../../packages/react/src/components/Table/components/TableRow/helpers"
import type { TTableProps } from "../../../../packages/react/src/components/Table/helpers"

const records: unknown[] = []
type TItem = { id: string; name: string }
type TRender = NonNullable<TTableRowProps<TItem>["render"]>
const item = { id: "a", name: "Alpha" }
const columns = [{ id: "name", name: "Name", isRowHeader: true }]
const tree = (row: Partial<TTableRowProps<TItem>> = {}, table: TTableProps<TItem> = {}) => (
  <Table aria-label="People" {...table}>
    <TableHeader columns={columns} />
    <SourceBody>
      <TableRow id="a" item={item} columns={columns} {...row} />
    </SourceBody>
  </Table>
)
const recorder = () => vi.fn<TRender>((props) => <tr {...props} />)
afterEach(cleanup)
afterAll(() =>
  writeFileSync(
    "/private/tmp/codon-table-row-source.json",
    JSON.stringify({ records, scope: "Actual CUI MotionRow/RAC source; no native acceptance" }, null, 2) + "\n",
  ),
)

it("receives every actual raw row render field through the canonical motion wrapper", () => {
  const receive = recorder()
  render(
    tree(
      { render: receive },
      { selectionMode: "multiple", selectionBehavior: "replace", selectedKeys: new Set(["a"]) },
    ),
  )
  const values = receive.mock.calls.at(-1)![1]
  expect(values).toEqual({
    isPressed: false,
    isSelected: true,
    isFocused: false,
    isDisabled: false,
    allowsSelection: true,
    hasAction: false,
    isHovered: false,
    isFocusVisible: false,
    selectionMode: "multiple",
    selectionBehavior: "replace",
    isDragging: undefined,
    isDropTarget: undefined,
    isFocusVisibleWithin: false,
    id: "a",
    hasChildItems: false,
    isExpanded: false,
    level: 1,
  })
  expect(Object.hasOwn(values, "defaultChildren")).toBe(false)
  records.push({ scenario: "all-fields", fields: Object.keys(values).sort(), values })
})
it("keeps disabled/expanded values and custom style precedence authoritative", () => {
  const receive = recorder()
  render(
    tree(
      { render: receive, hasChildItems: true, customStyles: { padding: 7 }, style: { padding: 9 } },
      { selectionMode: "multiple", disabledKeys: ["a"], expandedKeys: new Set(["a"]) },
    ),
  )
  const [props, values] = receive.mock.calls.at(-1)!
  expect(values).toMatchObject({
    isDisabled: true,
    allowsSelection: false,
    hasAction: false,
    isExpanded: true,
    hasChildItems: true,
  })
  expect(props.style).toMatchObject({ padding: 9, "--table-row-level": 1 })
  records.push({ scenario: "disabled-expanded", values, style: props.style })
})
it("reports enabled row hover separately from the inert row CSS hover", async () => {
  const receive = recorder(),
    hover = vi.fn()
  const view = render(tree({ render: receive, onHoverChange: hover }))
  const row = screen.getByRole("row", { name: "Alpha" })
  await userEvent.hover(row)
  expect(receive.mock.calls.at(-1)![1].isHovered).toBe(false)
  expect(hover).not.toHaveBeenCalled()
  await userEvent.unhover(row)
  view.rerender(tree({ render: receive, onHoverChange: hover }, { selectionMode: "single" }))
  await userEvent.hover(row)
  expect(receive.mock.calls.at(-1)![1].isHovered).toBe(true)
  expect(hover).toHaveBeenLastCalledWith(true)
  await userEvent.unhover(row)
  expect(receive.mock.calls.at(-1)![1].isHovered).toBe(false)
  records.push({ scenario: "interactive-hover", calls: hover.mock.calls })
})
it("preserves the original motion row/editor across renderer insertion, replacement and removal", () => {
  const ref = createRef<HTMLTableRowElement | HTMLDivElement>()
  const editor = createRef<HTMLInputElement>()
  const customColumns = [
    { ...columns[0], cellRenderer: () => <input ref={editor} aria-label="Held" value="" onChange={() => {}} /> },
  ]
  const view = render(tree({ ref, columns: customColumns }))
  const row = ref.current,
    input = editor.current
  for (const renderRow of [recorder(), recorder(), undefined]) {
    view.rerender(tree({ ref, columns: customColumns, render: renderRow }))
    expect(ref.current === row).toBe(true)
    expect(editor.current === input).toBe(true)
  }
  records.push({ scenario: "original-host-editor", row: !!row, editor: !!input })
})
it("keeps direct focus distinct from visible focus within a descendant editor", async () => {
  const receive = recorder()
  const customColumns = [{ ...columns[0], cellRenderer: () => <input aria-label="Held" /> }]
  render(tree({ render: receive, columns: customColumns }, { selectionMode: "single" }))
  const row = screen.getByRole("row", { name: "Name" }).nextElementSibling
  await userEvent.keyboard("{Tab}")
  const input = screen.getByRole("textbox", { name: "Held" })
  await act(() => input.focus())
  expect(receive.mock.calls.at(-1)![1]).toMatchObject({
    isFocused: false,
    isFocusVisible: false,
    isFocusVisibleWithin: true,
  })
  await act(() => fireEvent.blur(input))
  expect(receive.mock.calls.at(-1)![1].isFocusVisibleWithin).toBe(false)
  records.push({ scenario: "descendant-focus", headerSiblingPresent: !!row })
})

it("records original advertised press callbacks and row action ordering", async () => {
  const calls: string[] = []
  const receive = recorder()
  render(
    tree({
      render: receive,
      onPressStart: () => calls.push("start"),
      onPressUp: () => calls.push("up"),
      onPress: () => calls.push("press"),
      onPressEnd: () => calls.push("end"),
      onPressChange: (value) => calls.push(`change:${value}`),
      onAction: () => calls.push("action"),
    }),
  )
  await userEvent.click(screen.getByRole("row", { name: "Alpha" }))
  records.push({ scenario: "press-events", calls })
  expect(calls).toEqual(["start", "change:true", "up", "end", "change:false", "action", "press"])
})

it.each(["inert", "selectable", "disabled"] as const)(
  "records caller-only press behavior for a %s row",
  async (mode) => {
    const calls: string[] = [],
      receive = recorder()
    render(
      tree(
        {
          render: receive,
          onPressStart: () => calls.push("start"),
          onPressEnd: () => calls.push("end"),
          onPress: () => calls.push("press"),
        },
        { selectionMode: mode === "inert" ? "none" : "single", disabledKeys: mode === "disabled" ? ["a"] : [] },
      ),
    )
    const row = screen.getByRole("row", { name: "Alpha" }),
      user = userEvent.setup()
    await user.pointer([{ target: row, keys: "[MouseLeft>]" }])
    const pressed = receive.mock.calls.at(-1)![1].isPressed
    await user.pointer([{ target: row, keys: "[/MouseLeft]" }])
    records.push({ scenario: `caller-only-${mode}`, calls, pressed, values: receive.mock.calls.at(-1)![1] })
    expect(calls).toEqual(mode === "selectable" ? ["start", "end", "press"] : [])
    expect(pressed).toBe(mode === "selectable")
  },
)
