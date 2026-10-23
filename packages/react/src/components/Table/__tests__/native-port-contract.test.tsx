import { fireEvent, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import TableBody from "../components/TableBody/TableBody"
import TableFilterPopover from "../components/TableFilterPopover/TableFilterPopover"
import TableHeader from "../components/TableHeader/TableHeader"
import type { TTableDataColumnMetadata } from "../helpers"
import { TABLE_SORT_DIRECTION__ASCENDING, type TTableSortInstruction, type TTableFilterGroup } from "../queryTypes"
import Table from "../Table"

const items = [
  { id: 0, name: "Zero" },
  { id: "beta", name: "Beta" },
]
const columns = [{ id: "name", name: "Name", isRowHeader: true }]
describe("native Table selection oracle", () => {
  it("keeps row actions primary until selected keys are echoed and preserves checkbox-only selection", async () => {
    const changed = vi.fn(),
      action = vi.fn(),
      user = userEvent.setup()
    const node = (selectedKeys: Set<string | number>) => (
      <Table
        aria-label="Rows"
        selectionMode="multiple"
        selectedKeys={selectedKeys}
        clickableRows
        onRowAction={action}
        onSelectionChange={changed}
      >
        <TableHeader columns={columns} />
        <TableBody items={items} columns={columns} />
      </Table>
    )
    const view = render(node(new Set()))
    await user.click(screen.getByRole("rowheader", { name: "Zero" }))
    expect(action.mock.calls).toEqual([[0]])
    expect(changed).not.toHaveBeenCalled()
    await user.click(screen.getAllByRole("checkbox", { name: /Select Row/ })[0])
    expect(action.mock.calls).toEqual([[0]])
    const selected = changed.mock.calls[0][0]
    view.rerender(node(selected))
    await user.click(screen.getByRole("rowheader", { name: "Zero" }))
    expect([...changed.mock.calls[1][0]]).toEqual([])
    expect([...selected]).toEqual([0])
    expect(action.mock.calls).toEqual([[0]])
  })
  it("records the pinned collection's falsy successor boundary", () => {
    render(
      <Table aria-label="Falsy successor">
        <TableHeader columns={columns} />
        <TableBody
          items={[
            { id: 0, name: "Zero" },
            { id: "", name: "Empty" },
          ]}
          columns={columns}
        />
      </Table>,
    )
    expect(screen.getAllByRole("rowheader").map((row) => row.textContent)).toEqual(["Zero"])
  })
  it("repeats held checkbox requests and preserves typed keys and select-all sentinel", async () => {
    const changed = vi.fn(),
      user = userEvent.setup()
    render(
      <Table aria-label="Rows" selectionMode="multiple" selectedKeys={new Set()} onSelectionChange={changed}>
        <TableHeader columns={columns} />
        <TableBody items={items} columns={columns} />
      </Table>,
    )
    const rows = screen.getAllByRole("checkbox", { name: /Select Row/ })
    await user.click(rows[0])
    await user.click(rows[0])
    await user.click(rows[1])
    expect(changed.mock.calls.map(([keys]) => [...keys])).toEqual([[0], [0], ["beta"]])
    expect(rows[0]).not.toBeChecked()
    await user.click(screen.getByRole("checkbox", { name: "Select All" }))
    expect(changed).toHaveBeenLastCalledWith("all")
  })
  it("keeps disabled selection separate from selected output and renders replace mode without checkboxes", () => {
    const view = render(
      <Table aria-label="Rows" selectionMode="multiple" selectedKeys={new Set([0])} disabledKeys={new Set([0])}>
        <TableHeader columns={columns} />
        <TableBody items={items} columns={columns} />
      </Table>,
    )
    const row = screen.getAllByRole("checkbox", { name: /Select Row/ })[0]
    expect(row).toBeChecked()
    expect(row).toBeDisabled()
    view.rerender(
      <Table aria-label="Rows" selectionMode="multiple" selectionBehavior="replace" selectedKeys={new Set([0])}>
        <TableHeader columns={columns} />
        <TableBody items={items} columns={columns} />
      </Table>,
    )
    expect(screen.queryByRole("checkbox")).toBeNull()
  })
  it("keeps single-selection header space without a select-all checkbox and preserves required selection", async () => {
    const changed = vi.fn(),
      user = userEvent.setup()
    render(
      <Table
        aria-label="Rows"
        selectionMode="single"
        disallowEmptySelection
        defaultSelectedKeys={[0]}
        onSelectionChange={changed}
      >
        <TableHeader columns={columns} />
        <TableBody items={items} columns={columns} />
      </Table>,
    )
    expect(screen.queryByRole("checkbox", { name: "Select All" })).toBeNull()
    const rows = screen.getAllByRole("checkbox", { name: /Select Row/ })
    await user.click(rows[0])
    expect(changed).not.toHaveBeenCalled()
    await user.click(rows[1])
    expect([...changed.mock.calls[0][0]]).toEqual(["beta"])
  })
})

describe("native Table resizing oracle", () => {
  const header: TTableDataColumnMetadata<(typeof items)[number]>[] = [
    { ...columns[0], width: 120, minWidth: 100, maxWidth: 150 },
  ]
  const rect = (width: number) => ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    bottom: 30,
    right: width,
    width,
    height: 30,
    toJSON: () => ({}),
  })
  it("preserves header sorting from keyboard activation of its resize button", async () => {
    const sort = vi.fn(),
      resized = vi.fn(),
      user = userEvent.setup()
    const sortable = [{ ...header[0], sort: { enabled: true, criteriaID: "name" } }]
    render(
      <Table
        aria-label="Resize activation"
        columns={sortable}
        columnResizing={{ enabled: true, onColumnResize: resized }}
        queryControls={{ sorting: { activeSorts: [], onSortChange: sort } }}
      >
        <TableHeader columns={sortable} />
        <TableBody columns={sortable} items={items} />
      </Table>,
    )
    screen.getByRole("button", { name: "Resize Name column" }).focus()
    await user.keyboard("{Enter} ")
    expect(sort).toHaveBeenCalledTimes(2)
    expect(resized).not.toHaveBeenCalled()
  })
  it("keeps a drag's header metadata/callback snapshot while keyboard requests use the current root metadata", async () => {
    const original = vi.fn(),
      current = vi.fn()
    const node = (root = header, shown = header, callback = original) => (
      <Table aria-label="Resizable" columns={root} columnResizing={{ enabled: true, onColumnResize: callback }}>
        <TableHeader columns={shown} />
        <TableBody items={items} columns={shown} />
      </Table>
    )
    const view = render(node())
    vi.spyOn(screen.getByRole("columnheader", { name: "Name" }), "getBoundingClientRect").mockReturnValue(rect(120))
    const button = screen.getByRole("button", { name: "Resize Name column" })
    fireEvent(button, new MouseEvent("pointerdown", { bubbles: true, clientX: 10 }))
    view.rerender(
      node(
        [{ ...header[0], width: 400, minWidth: 130, maxWidth: 180 }],
        [{ ...header[0], width: 400, minWidth: 0, maxWidth: 500 }],
        current,
      ),
    )
    fireEvent(window, new MouseEvent("pointermove", { clientX: 20 }))
    expect(original).toHaveBeenLastCalledWith({ columnID: "name", width: 130 })
    expect(current).not.toHaveBeenCalled()
    fireEvent(window, new MouseEvent("pointerup"))
    vi.spyOn(screen.getByRole("columnheader", { name: "Name" }), "getBoundingClientRect").mockReturnValue(rect(400))
    fireEvent.keyDown(screen.getByRole("button", { name: "Resize Name column" }), { key: "ArrowRight" })
    expect(current).toHaveBeenLastCalledWith({ columnID: "name", width: 180 })
  })
  it("admits pointer resizing without root columns while keyboard resizing stays inert", async () => {
    const resized = vi.fn(),
      user = userEvent.setup()
    render(
      <Table aria-label="No root columns" columnResizing={{ enabled: true, onColumnResize: resized }}>
        <TableHeader columns={header} />
        <TableBody columns={header} items={items} />
      </Table>,
    )
    vi.spyOn(screen.getByRole("columnheader", { name: "Name" }), "getBoundingClientRect").mockReturnValue(rect(120))
    const button = screen.getByRole("button", { name: "Resize Name column" })
    button.focus()
    await user.keyboard("{ArrowRight}")
    expect(resized).not.toHaveBeenCalled()
    fireEvent(button, new MouseEvent("pointerdown", { bubbles: true, clientX: 10 }))
    fireEvent(window, new MouseEvent("pointermove", { clientX: 20 }))
    fireEvent(window, new MouseEvent("pointerup"))
    expect(resized.mock.calls).toEqual([[{ columnID: "name", width: 130 }]])
  })
})

describe("native Table filtering oracle", () => {
  const column: TTableDataColumnMetadata<(typeof items)[number]> = {
    id: "name",
    name: "Name",
    isRowHeader: true,
    filter: {
      enabled: true,
      criteriaID: "person",
      queryKey: "user.name",
      allowedOperationCodes: ["equal", "not-equal", "like"],
    },
  }
  const group = (): TTableFilterGroup => ({
    id: "applied-id",
    criteriaID: "person",
    criteriaName: "Old name",
    dataType: "text",
    joinOperator: "or",
    clauses: [{ id: "held-clause", operationCode: "equal", argument: "applied" }],
  })
  it("normalizes isolated text drafts and contains form submission while replacing current owner groups", async () => {
    const changed = vi.fn(),
      outside = vi.fn(),
      user = userEvent.setup()
    const other = { ...group(), id: "other", criteriaID: "other" }
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault()
          outside()
        }}
      >
        <TableFilterPopover
          column={column}
          filterGroup={group()}
          activeFilters={[other, group()]}
          onFiltersChange={changed}
          isFilterActive
          activeFilterIcon="Active"
          inactiveFilterIcon="Inactive"
        />
      </form>,
    )
    await user.click(screen.getByRole("button", { name: "Filter by Name" }))
    const input = screen.getByRole("textbox", { name: "Filter Name" })
    await user.clear(input)
    await user.type(input, "  requested  ")
    expect(changed).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "Apply" }))
    expect(changed).toHaveBeenCalledWith([
      other,
      {
        id: "person",
        criteriaID: "person",
        criteriaName: "Name",
        queryKey: "user.name",
        dataType: "text",
        joinOperator: "or",
        clauses: [{ id: "held-clause", operationCode: "equal", argument: "requested" }],
      },
    ])
    expect(outside).not.toHaveBeenCalled()
  })
  it("keeps a dismissed draft until metadata or the applied group changes identity", async () => {
    const user = userEvent.setup(),
      applied = group(),
      changed = vi.fn()
    const node = (metadata = column) => (
      <TableFilterPopover
        column={metadata}
        filterGroup={applied}
        activeFilters={[applied]}
        onFiltersChange={changed}
        isFilterActive
        activeFilterIcon="Active"
        inactiveFilterIcon="Inactive"
      />
    )
    const view = render(node())
    await user.click(screen.getByRole("button", { name: "Filter by Name" }))
    const input = screen.getByRole("textbox", { name: "Filter Name" })
    await user.clear(input)
    await user.type(input, "draft")
    await user.keyboard("{Escape}")
    await user.click(screen.getByRole("button", { name: "Filter by Name" }))
    expect(screen.getByRole("textbox", { name: "Filter Name" })).toHaveValue("draft")
    view.rerender(node({ ...column, name: "Revised" }))
    expect(screen.getByRole("textbox", { name: "Filter Revised" })).toHaveValue("applied")
    expect(changed).not.toHaveBeenCalled()
  })
  it("clears all matching criteria groups while retaining unrelated owner objects", async () => {
    const changed = vi.fn(),
      user = userEvent.setup(),
      other = { ...group(), id: "other", criteriaID: "other" }
    render(
      <TableFilterPopover
        column={column}
        filterGroup={group()}
        activeFilters={[other, group(), group()]}
        onFiltersChange={changed}
        isFilterActive
        activeFilterIcon="Active"
        inactiveFilterIcon="Inactive"
      />,
    )
    await user.click(screen.getByRole("button", { name: "Filter by Name" }))
    await user.click(screen.getByRole("button", { name: "Clear" }))
    expect(changed).toHaveBeenCalledWith([other])
    expect(changed.mock.calls[0][0][0]).toBe(other)
  })
})

describe("native Table query oracle", () => {
  const sortable: TTableDataColumnMetadata<(typeof items)[number]>[] = [
    { ...columns[0], sort: { enabled: true, criteriaID: "person", queryKey: "user.name" } },
  ]
  it("keeps root and inner header metadata routes separate and admits inner presses with root columns omitted", async () => {
    const changed = vi.fn(),
      user = userEvent.setup()
    const node = (rootColumns: typeof sortable | undefined) => (
      <Table
        aria-label="Rows"
        columns={rootColumns}
        queryControls={{ sorting: { activeSorts: [], onSortChange: changed } }}
      >
        <TableHeader columns={sortable} />
        <TableBody columns={sortable} items={items} />
      </Table>
    )
    const view = render(node([{ ...sortable[0], name: "Root name", sort: { enabled: true, criteriaID: "root" } }]))
    await user.click(screen.getByRole("columnheader", { name: "Name" }))
    expect(changed).toHaveBeenLastCalledWith([
      {
        id: "sort-root",
        criteriaID: "root",
        criteriaName: "Root name",
        queryKey: undefined,
        sortDirection: TABLE_SORT_DIRECTION__ASCENDING,
      },
    ])
    await user.click(screen.getByRole("button", { name: "Name" }))
    expect(changed).toHaveBeenLastCalledWith([
      {
        id: "sort-person",
        criteriaID: "person",
        criteriaName: "Name",
        queryKey: "user.name",
        sortDirection: TABLE_SORT_DIRECTION__ASCENDING,
      },
    ])
    expect(changed).toHaveBeenCalledTimes(2)
    view.rerender(node(undefined))
    await user.click(screen.getByRole("columnheader", { name: "Name" }))
    expect(changed).toHaveBeenCalledTimes(2)
    await user.click(screen.getByRole("button", { name: "Name" }))
    expect(changed).toHaveBeenCalledTimes(3)
  })
  it("repeats held inner requests and retains the exact original array for an empty criterion", async () => {
    const changed = vi.fn(),
      user = userEvent.setup(),
      active: TTableSortInstruction[] = []
    const node = (header = sortable) => (
      <Table aria-label="Rows" queryControls={{ sorting: { activeSorts: active, onSortChange: changed } }}>
        <TableHeader columns={header} />
        <TableBody columns={sortable} items={items} />
      </Table>
    )
    const view = render(node())
    await user.click(screen.getByRole("button", { name: "Name" }))
    await user.click(screen.getByRole("button", { name: "Name" }))
    expect(changed.mock.calls[0]).toEqual(changed.mock.calls[1])
    expect(active).toEqual([])
    view.rerender(node([{ ...sortable[0], sort: { enabled: true, criteriaID: "" } }]))
    await user.click(screen.getByRole("button", { name: "Name" }))
    expect(changed.mock.calls[2][0]).toBe(active)
  })
  it("keeps pagination outside the grid and lets explicit undefined groups override Table's defaults", async () => {
    const page = vi.fn(),
      user = userEvent.setup()
    const pagination = {
      currentPage: 1,
      itemsPerPage: 10,
      numberOfItems: 100,
      setCurrentPage: page,
      setItemsPerPage: vi.fn(),
    }
    const node = (defaults: boolean) => (
      <Table
        aria-label="Rows"
        queryControls={{
          pagination: defaults ? pagination : { ...pagination, chosenPaginationSubcomponents: undefined },
        }}
      >
        <TableHeader columns={columns} />
        <TableBody columns={columns} items={items} />
      </Table>
    )
    const view = render(node(true))
    const footer = screen.getByRole("navigation")
    expect(screen.getByRole("grid").contains(footer)).toBe(false)
    expect(screen.getByText("Items Per Page")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Next Page" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Go To Page 10" }))
    await user.click(screen.getByRole("button", { name: "Go To Page 10" }))
    expect(page.mock.calls).toEqual([[10], [10]])
    view.rerender(node(false))
    expect(screen.queryByText("Items Per Page")).not.toBeInTheDocument()
  })
})
