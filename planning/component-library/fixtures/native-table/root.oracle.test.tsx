import { writeFileSync } from "node:fs"

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import React, { createRef, useContext } from "react"
import { DEFAULT_SLOT, SelectableCollectionContext, TableContext, TableStateContext } from "react-aria-components"
import { afterAll, afterEach, expect, it, vi } from "vitest"

import Table from "../../../../packages/react/src/components/Table/Table"
import TableBody from "../../../../packages/react/src/components/Table/components/TableBody/TableBody"
import TableHeader from "../../../../packages/react/src/components/Table/components/TableHeader/TableHeader"
import type { TTableProps } from "../../../../packages/react/src/components/Table/helpers"

type TSourceState = NonNullable<React.ContextType<typeof TableStateContext>>
type TRenderState = Parameters<NonNullable<TTableProps["render"]>>[1]
const records: unknown[] = []
let state: TSourceState
let flags: TRenderState
const Probe = () => {
  state = useContext(TableStateContext)!
  return null
}
const items = [
  { id: "a", name: "Alpha" },
  { id: "b", name: "Beta" },
]
const columns = [{ id: "name", name: "Name", isRowHeader: true }]
const custom: NonNullable<TTableProps["render"]> = (props, value) => {
  flags = value
  return <table {...props} />
}
const tree = (props: TTableProps<(typeof items)[number]> = {}, rows = items) => (
  <Table aria-label="People" render={custom} {...props}>
    <TableHeader
      columns={columns}
      render={(header) => (
        <thead {...header}>
          <Probe />
          {header.children}
        </thead>
      )}
    />
    <TableBody columns={columns} items={rows} rowKey={(item) => item.id} />
  </Table>
)
afterEach(cleanup)
afterAll(() =>
  writeFileSync(
    "/private/tmp/codon-table-root-oracle.json",
    JSON.stringify({ scope: "Actual canonical root/context/render source; no native acceptance", records }, null, 2) +
      "\n",
  ),
)

it("exposes all four source root render values over the actual filtered state", () => {
  render(tree())
  expect(Object.keys(flags).sort()).toEqual(["isDropTarget", "isFocusVisible", "isFocused", "state"])
  expect(flags.state === state).toBe(true)
  expect(flags.isDropTarget).toBe(false)
  expect(flags.isFocused).toBe(false)
  records.push({
    scenario: "render-fields",
    fields: Object.keys(flags).sort(),
    sameState: flags.state === state,
    focused: flags.isFocused,
    focusVisible: flags.isFocusVisible,
  })
})
it("merges root context before selection state and header options", () => {
  const change = vi.fn()
  render(
    <TableContext.Provider value={{ selectionMode: "multiple", selectedKeys: new Set(), onSelectionChange: change }}>
      {tree()}
    </TableContext.Provider>,
  )
  expect(state.selectionManager.selectionMode).toBe("multiple")
  expect(screen.getAllByRole("checkbox").length).toBe(3)
  act(() => state.selectionManager.toggleSelection("a"))
  act(() => state.selectionManager.toggleSelection("a"))
  expect(change.mock.calls.map(([keys]) => [...keys])).toEqual([["a"], ["a"]])
  expect(state.selectionManager.isSelected("a")).toBe(false)
  records.push({
    scenario: "selection-context",
    requests: change.mock.calls.map(([keys]) => [...keys]),
    checkboxes: screen.getAllByRole("checkbox").length,
  })
})
it("preserves named/default slots, exact refs and explicit null context bypass", () => {
  const ref = createRef<HTMLTableElement>()
  const context = {
    slots: {
      people: { ref, id: "people-context", "aria-label": "Context", style: { paddingTop: 19 } },
      [DEFAULT_SLOT]: { id: "default-context" },
    },
  }
  const view = render(<TableContext.Provider value={context}>{tree({ slot: "people" })}</TableContext.Provider>)
  const root = screen.getByRole("grid")
  expect(ref.current === root).toBe(true)
  expect(root.id).toBe("people-context")
  const namedId = root.id
  expect(root.getAttribute("aria-label")).toBe("People")
  view.rerender(<TableContext.Provider value={context}>{tree({ slot: null })}</TableContext.Provider>)
  expect(ref.current).toBeNull()
  expect(screen.getByRole("grid").style.paddingTop).toBe("")
  expect(screen.getByRole("grid").id).toBe("people-context")
  view.rerender(<TableContext.Provider value={context}>{tree()}</TableContext.Provider>)
  expect(screen.getByRole("grid").id).toBe("default-context")
  records.push({ scenario: "slots", namedId, nullBypasses: true, defaultId: screen.getByRole("grid").id })
})
it("resolves both context style functions before authored wrapper overrides", () => {
  const calls: { owner: string; defaultStyle: unknown; stateFields: string[] }[] = []
  const style =
    (owner: string, value: React.CSSProperties) => (values: TRenderState & { defaultStyle: React.CSSProperties }) => {
      calls.push({ owner, defaultStyle: { ...values.defaultStyle }, stateFields: Object.keys(values.state).sort() })
      return value
    }
  render(
    <TableContext.Provider value={{ style: style("table", { marginTop: 7, paddingTop: 7 }) }}>
      <SelectableCollectionContext.Provider value={{ style: style("shared", { marginTop: 5, paddingBottom: 5 }) }}>
        {tree({ customStyles: { marginTop: 11 }, style: { marginBottom: 12 } })}
      </SelectableCollectionContext.Provider>
    </TableContext.Provider>,
  )
  const root = screen.getByRole("grid")
  expect(root.style.marginTop).toBe("11px")
  expect(root.style.marginBottom).toBe("12px")
  expect(root.style.paddingTop).toBe("7px")
  expect(root.style.paddingBottom).toBe("5px")
  records.push({ scenario: "style-contexts", calls, final: root.getAttribute("style") })
})
it("retains raw context sorting even when wrapper query sorting is absent", () => {
  const change = vi.fn()
  render(
    <TableContext.Provider
      value={{ sortDescriptor: { column: "name", direction: "descending" }, onSortChange: change }}
    >
      {tree()}
    </TableContext.Provider>,
  )
  expect(state.sortDescriptor).toEqual({ column: "name", direction: "descending" })
  act(() => state.sort("name", "ascending"))
  expect(change).toHaveBeenCalledWith({ column: "name", direction: "ascending" })
  records.push({
    scenario: "raw-sort-context",
    descriptor: state.sortDescriptor,
    requests: change.mock.calls.map(([next]) => next),
  })
})
it("chains current context sorting before the wrapper query bridge", () => {
  const order: string[] = []
  const source = vi.fn(() => order.push("context"))
  const query = vi.fn(() => order.push("query"))
  render(
    <TableContext.Provider value={{ onSortChange: source }}>
      {tree({
        columns: [{ ...columns[0], sort: { enabled: true, criteriaID: "person" } }],
        queryControls: { sorting: { activeSorts: [], onSortChange: query } },
      })}
    </TableContext.Provider>,
  )
  act(() => state.sort("name", "descending"))
  expect(order).toEqual(["context", "query"])
  expect(query.mock.calls[0][0][0].sortDirection).toBe("Ascending")
  records.push({ scenario: "sort-owner-order", order, raw: source.mock.calls[0][0], query: query.mock.calls[0][0] })
})
it("preserves the original root and child editor across default and custom rendering", () => {
  const ref = createRef<HTMLTableElement>()
  const source = (useCustom: boolean) => (
    <Table ref={ref} aria-label="Editor table" render={useCustom ? custom : undefined}>
      <TableHeader columns={columns} />
      <TableBody
        columns={[{ ...columns[0], cellRenderer: () => <input aria-label="Held editor" value="held" readOnly /> }]}
        items={[items[0]]}
        rowKey={(item) => item.id}
      />
    </Table>
  )
  const view = render(source(false))
  const root = ref.current
  const editor = screen.getByRole("textbox")
  view.rerender(source(true))
  expect(ref.current === root).toBe(true)
  expect(screen.getByRole("textbox") === editor).toBe(true)
  view.rerender(source(false))
  expect(ref.current === root).toBe(true)
  expect(screen.getByRole("textbox") === editor).toBe(true)
  records.push({
    scenario: "render-continuity",
    rootSame: true,
    editorSame: true,
    value: (editor as HTMLInputElement).value,
  })
})
it("observes root focus separately from descendant focus and updates modality", () => {
  render(tree({}, []))
  act(() => state.setKeyboardNavigationDisabled(true))
  const root = screen.getByRole("grid")
  fireEvent.mouseDown(document.body)
  act(() => root.focus())
  expect(flags.isFocused).toBe(true)
  const pointerVisible = flags.isFocusVisible
  fireEvent.keyDown(document, { key: "Tab" })
  const keyboardVisible = flags.isFocusVisible
  act(() => root.blur())
  expect(flags.isFocused).toBe(false)
  records.push({
    scenario: "focus",
    pointerVisible,
    keyboardVisible,
    blurred: { isFocused: flags.isFocused, isFocusVisible: flags.isFocusVisible },
  })
})
it("records unsupported root key callback extras as ignored source input", () => {
  const order: string[] = []
  let original: unknown
  const inherited = vi.fn((event) => {
    original = event
    order.push("context")
  })
  const caller = vi.fn((event) => {
    expect(event === original).toBe(true)
    order.push("caller")
    event.preventDefault()
  })
  render(<TableContext.Provider value={{ onKeyDown: inherited }}>{tree({ onKeyDown: caller })}</TableContext.Provider>)
  fireEvent.keyDown(screen.getByRole("grid"), { key: "a", ctrlKey: true })
  expect(order).toEqual([])
  records.push({ scenario: "unsupported-key-extras", order, delivered: original !== undefined })
})

it("retains context row action through an inactive wrapper action gate", async () => {
  const { default: userEvent } = await import("@testing-library/user-event")
  const action = vi.fn()
  render(
    <TableContext.Provider value={{ onRowAction: action }}>{tree({ clickableRows: false })}</TableContext.Provider>,
  )
  const row = screen.getByText("Alpha").closest("tr")
  if (!row) throw new Error("Expected original source row")
  await userEvent.setup().click(row)
  expect(action).toHaveBeenCalledWith("a")
  records.push({ scenario: "raw-context-action", requests: action.mock.calls.map(([key]) => key) })
})

it("retains original root naming, description and details references", () => {
  render(
    <>
      <span id="table-name">Reference name</span>
      <span id="table-note">Reference description</span>
      <span id="table-details">Reference details</span>
      {tree({ "aria-labelledby": "table-name", "aria-describedby": "table-note", "aria-details": "table-details" })}
    </>,
  )
  const root = screen.getByRole("grid", { name: "Reference name" })
  expect(root.getAttribute("aria-labelledby")).toBe("table-name")
  expect(root.getAttribute("aria-describedby")?.split(" ")).toContain("table-note")
  expect(root.getAttribute("aria-details")).toBe("table-details")
  records.push({
    scenario: "references",
    labelledBy: root.getAttribute("aria-labelledby"),
    describedBy: root.getAttribute("aria-describedby"),
    details: root.getAttribute("aria-details"),
  })
})
