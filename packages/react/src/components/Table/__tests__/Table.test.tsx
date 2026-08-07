import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { ROUND } from "../../../tokens/geometry"
import { PAGINATION_SUBCOMPONENT__ITEMS_PER_PAGE } from "../../Pagination/helpers"
import TableBody from "../components/TableBody/TableBody"
import tableCellStyles from "../components/TableCell/TableCellStyles.module.css"
import TableFilterPopover from "../components/TableFilterPopover/TableFilterPopover"
import tableFilterPopoverStyles from "../components/TableFilterPopover/TableFilterPopoverStyles.module.css"
import TableHeader from "../components/TableHeader/TableHeader"
import tableRowStyles from "../components/TableRow/TableRowStyles.module.css"
import {
  TABLE_COLUMN_ROLE__STRUCTURAL,
  TABLE_STRUCTURAL_COLUMN_KIND__ACTION,
  TABLE_STRUCTURAL_COLUMN_POSITION__LEFT,
  TABLE_STRUCTURAL_COLUMN_POSITION__RIGHT,
  type TTableColumnMetadata,
} from "../helpers"
import {
  TABLE_FILTER_ARGUMENT_DATA_TYPE__DATE,
  TABLE_FILTER_ARGUMENT_DATA_TYPE__TEXT,
  TABLE_FILTER_OPERATION_CODE__EQUAL,
  TABLE_FILTER_OPERATION_CODE__GREATER_THAN_EQUAL,
  TABLE_FILTER_OPERATION_CODE__LESS_THAN_EQUAL,
  TABLE_SORT_DIRECTION__ASCENDING,
} from "../queryTypes"
import Table from "../Table"
import tableStyles from "../TableStyles.module.css"

type TTableTestRow = {
  id: string
  name: string
  date: string
}

const row: TTableTestRow = {
  id: "row-1",
  name: "Alpha",
  date: "2026-04-19",
}

const columns: TTableColumnMetadata<TTableTestRow>[] = [
  {
    id: "name",
    name: "Name",
    isRowHeader: true,
    accessor: (r) => r.name,
  },
  {
    id: "right-action",
    role: TABLE_COLUMN_ROLE__STRUCTURAL,
    structuralKind: TABLE_STRUCTURAL_COLUMN_KIND__ACTION,
    structuralPosition: TABLE_STRUCTURAL_COLUMN_POSITION__RIGHT,
    width: 44,
    name: "Right action",
    headerAriaLabel: "Right action",
    cellRenderer: () => "Right action",
  },
  {
    id: "left-action",
    role: TABLE_COLUMN_ROLE__STRUCTURAL,
    structuralKind: TABLE_STRUCTURAL_COLUMN_KIND__ACTION,
    structuralPosition: TABLE_STRUCTURAL_COLUMN_POSITION__LEFT,
    width: 44,
    name: "Left action",
    headerAriaLabel: "Left action",
    cellRenderer: () => "Left action",
  },
  {
    id: "hidden-data",
    name: "Hidden Data",
    isHidden: true,
    accessor: () => "Hidden data",
  },
  {
    id: "date",
    name: "Date",
    accessor: (r) => r.date,
  },
]

const filterableDateColumn: TTableColumnMetadata<TTableTestRow> = {
  id: "date",
  name: "Date",
  filter: {
    enabled: true,
    criteriaID: "date",
    dataType: TABLE_FILTER_ARGUMENT_DATA_TYPE__DATE,
    allowedOperationCodes: [
      TABLE_FILTER_OPERATION_CODE__GREATER_THAN_EQUAL,
      TABLE_FILTER_OPERATION_CODE__LESS_THAN_EQUAL,
    ],
  },
}

describe("<Table /> Tests", () => {
  it("Renders normalized structural columns around metadata-ordered data columns.", () => {
    render(
      <Table aria-label="Normalized table" columns={columns}>
        <TableHeader<TTableTestRow> columns={columns} />
        <TableBody<TTableTestRow> columns={columns} items={[row]} rowKey={(r) => r.id} />
      </Table>,
    )

    const columnHeaders = screen.getAllByRole("columnheader")
    expect(columnHeaders.map((header) => header.textContent || header.getAttribute("aria-label"))).toEqual([
      "Left action",
      "Name",
      "Date",
      "Right action",
    ])

    expect(screen.getByRole("rowheader", { name: "Alpha" })).toBeInTheDocument()
    expect(screen.getAllByRole("gridcell").map((cell) => cell.textContent)).toEqual([
      "Left action",
      "2026-04-19",
      "Right action",
    ])
  })

  it("Marks rows clickable only when clickability and a row action are both provided.", () => {
    const ActionTable = (props: { clickableRows?: boolean; onRowAction?: (key: string | number) => void }) => (
      <Table aria-label="Action table" columns={columns} {...props}>
        <TableHeader<TTableTestRow> columns={columns} />
        <TableBody<TTableTestRow> columns={columns} items={[row]} rowKey={(r) => r.id} />
      </Table>
    )

    const { rerender } = render(<ActionTable />)
    const table = screen.getByRole("grid", { name: "Action table" })
    expect(table).not.toHaveAttribute("data-clickable-rows")

    rerender(<ActionTable clickableRows />)
    expect(table).not.toHaveAttribute("data-clickable-rows")

    rerender(<ActionTable onRowAction={vi.fn()} />)
    expect(table).not.toHaveAttribute("data-clickable-rows")

    rerender(<ActionTable clickableRows onRowAction={vi.fn()} />)
    expect(table).toHaveAttribute("data-clickable-rows", "true")
  })

  it("Merges native and custom table root styling without leaking wrapper props.", () => {
    render(
      <Table
        aria-label="Styled table"
        columns={columns}
        className="native-table"
        customClassName="custom-table"
        customStyles={{ height: 320 }}
        geometry={ROUND}
        hoverColor="pink"
        stickyHeader
        style={{ width: 640 }}
        zebra
        zebraColor="aliceblue"
      >
        <TableHeader<TTableTestRow> columns={columns} />
        <TableBody<TTableTestRow> columns={columns} items={[row]} rowKey={(r) => r.id} />
      </Table>,
    )

    const table = screen.getByRole("grid", { name: "Styled table" })

    expect(table).toHaveClass(tableStyles.table)
    expect(table).toHaveClass(tableStyles["table--zebra"])
    expect(table).toHaveClass("custom-table")
    expect(table).toHaveClass("native-table")
    expect(table).toHaveStyle({ height: "320px", width: "640px" })
    expect(table).not.toHaveAttribute("customclassname")
    expect(table).not.toHaveAttribute("customstyles")
    expect(table).not.toHaveAttribute("geometry")
    expect(table).not.toHaveAttribute("hovercolor")
    expect(table).not.toHaveAttribute("stickyheader")
    expect(table).not.toHaveAttribute("zebra")
    expect(table).not.toHaveAttribute("zebracolor")
  })

  it("Merges table header, body, generated row, and body cell styling hooks.", () => {
    const styledColumns: TTableColumnMetadata<TTableTestRow>[] = [
      {
        id: "name",
        name: "Name",
        isRowHeader: true,
        accessor: (r) => r.name,
        customBodyCellClassName: "custom-name-cell",
        customBodyCellStyles: { backgroundColor: "tomato" },
        maxLines: 2,
        truncate: true,
        width: 120,
      },
      {
        id: "date",
        name: "Date",
        accessor: (r) => r.date,
      },
    ]

    render(
      <Table aria-label="Primitive styled table" columns={styledColumns}>
        <TableHeader<TTableTestRow>
          columns={styledColumns}
          data-testid="styled-table-header"
          className="native-header"
          customClassName="custom-header"
          customStyles={{ height: 40 }}
          style={{ width: 500 }}
        />
        <TableBody<TTableTestRow>
          columns={styledColumns}
          data-testid="styled-table-body"
          items={[row]}
          rowKey={(r) => r.id}
          geometry={ROUND}
          className="native-body"
          customClassName="custom-body"
          customStyles={{ height: 80 }}
          style={{ width: 500 }}
          customRowClassName="custom-row"
          customRowStyles={{ opacity: 0.9 }}
        />
      </Table>,
    )

    const header = screen.getByTestId("styled-table-header")
    const body = screen.getByTestId("styled-table-body")
    const rowHeader = screen.getByRole("rowheader", { name: "Alpha" })
    const generatedRow = rowHeader.closest("tr") as HTMLElement

    expect(header).toHaveClass("custom-header")
    expect(header).toHaveClass("native-header")
    expect(header).toHaveStyle({ height: "40px", width: "500px" })
    expect(header).not.toHaveAttribute("customclassname")
    expect(header).not.toHaveAttribute("customstyles")

    expect(body).toHaveClass("custom-body")
    expect(body).toHaveClass("native-body")
    expect(body).toHaveStyle({ height: "80px", width: "500px" })
    expect(body).not.toHaveAttribute("customrowclassname")
    expect(body).not.toHaveAttribute("customrowstyles")
    expect(body).not.toHaveAttribute("geometry")

    expect(generatedRow).toHaveClass(tableRowStyles.tableRow)
    expect(generatedRow).toHaveClass(tableRowStyles["tableRow--round"])
    expect(generatedRow).toHaveClass("custom-row")
    expect(generatedRow).toHaveStyle({ opacity: "0.9" })
    expect(generatedRow).not.toHaveAttribute("geometry")
    expect(generatedRow).not.toHaveAttribute("customclassname")
    expect(generatedRow).not.toHaveAttribute("customstyles")

    expect(rowHeader).toHaveClass(tableCellStyles.tableCell)
    expect(rowHeader).toHaveClass(tableCellStyles["tableCell--truncate"])
    expect(rowHeader).toHaveClass("custom-name-cell")
    expect(rowHeader).toHaveStyle("background-color: rgb(255, 99, 71); width: 120px")
    expect(rowHeader.querySelector(`.${tableCellStyles.tableCell__clamp}`)).toBeInTheDocument()
    expect(rowHeader).not.toHaveAttribute("alignment")
    expect(rowHeader).not.toHaveAttribute("customclassname")
    expect(rowHeader).not.toHaveAttribute("customstyles")
    expect(rowHeader).not.toHaveAttribute("maxlines")
    expect(rowHeader).not.toHaveAttribute("truncate")
  })

  it("Uses provided labels for table selection controls.", () => {
    render(
      <Table
        aria-label="Selectable table"
        columns={columns}
        selectionMode="multiple"
        selectionBehavior="toggle"
        selectedKeys={new Set()}
        onSelectionChange={vi.fn()}
        labels={{
          selection: {
            selectAllRowsAriaLabel: "Select every localized row",
            selectRowAriaLabel: "Select localized row",
          },
        }}
      >
        <TableHeader<TTableTestRow> columns={columns} />
        <TableBody<TTableTestRow> columns={columns} items={[row]} rowKey={(r) => r.id} />
      </Table>,
    )

    expect(screen.getByRole("checkbox", { name: "Select every localized row" })).toBeInTheDocument()
    expect(screen.getByRole("checkbox", { name: /select localized row/iu })).toBeInTheDocument()
  })

  it("Owns default table header sort and filter icons while preserving filter icon overrides.", () => {
    const sortableFilterableColumns: TTableColumnMetadata<TTableTestRow>[] = [
      {
        ...filterableDateColumn,
        sort: {
          enabled: true,
          criteriaID: "date",
        },
      },
    ]

    render(
      <Table
        aria-label="Sortable filterable table"
        columns={sortableFilterableColumns}
        queryControls={{
          sorting: {
            activeSorts: [
              {
                id: "sort-date",
                criteriaID: "date",
                criteriaName: "Date",
                sortDirection: TABLE_SORT_DIRECTION__ASCENDING,
              },
            ],
            onSortChange: vi.fn(),
          },
          filtering: {
            mode: "external",
            activeFilters: [],
            onFilterIconPress: vi.fn(),
          },
        }}
      >
        <TableHeader<TTableTestRow> columns={sortableFilterableColumns} />
        <TableBody<TTableTestRow> columns={sortableFilterableColumns} items={[row]} rowKey={(r) => r.id} />
      </Table>,
    )

    expect(screen.getByTestId("table-header-default-sort-ascending-icon")).toBeInTheDocument()
    expect(screen.getByTestId("table-header-default-inactive-filter-icon")).toBeInTheDocument()
  })

  it("Emits bounded column resize changes from table header resize controls.", () => {
    const onColumnResize = vi.fn()
    const resizableColumns: TTableColumnMetadata<TTableTestRow>[] = [
      {
        id: "name",
        name: "Name",
        isRowHeader: true,
        accessor: (r) => r.name,
        width: 120,
        minWidth: 100,
        maxWidth: 150,
      },
    ]

    render(
      <Table aria-label="Resizable table" columns={resizableColumns} columnResizing={{ enabled: true, onColumnResize }}>
        <TableHeader<TTableTestRow> columns={resizableColumns} />
        <TableBody<TTableTestRow> columns={resizableColumns} items={[row]} rowKey={(r) => r.id} />
      </Table>,
    )

    const columnHeader = screen.getByRole("columnheader", { name: "Name" })
    vi.spyOn(columnHeader, "getBoundingClientRect").mockReturnValue({
      bottom: 0,
      height: 0,
      left: 0,
      right: 120,
      toJSON: () => ({}),
      top: 0,
      width: 120,
      x: 0,
      y: 0,
    })

    const resizeButton = screen.getByRole("button", { name: "Resize Name column" })

    fireEvent(resizeButton, new MouseEvent("pointerdown", { bubbles: true, clientX: 10 }))
    fireEvent(window, new MouseEvent("pointermove", { bubbles: true, clientX: 60 }))
    fireEvent(window, new MouseEvent("pointerup", { bubbles: true }))
    expect(onColumnResize).toHaveBeenLastCalledWith({ columnID: "name", width: 150 })
  })

  it("Renders pagination controls from table query controls.", () => {
    render(
      <Table
        aria-label="Paginated table"
        columns={columns}
        queryControls={{
          pagination: {
            currentPage: 1,
            setCurrentPage: vi.fn(),
            itemsPerPage: 10,
            setItemsPerPage: vi.fn(),
            numberOfItems: 25,
          },
        }}
      >
        <TableHeader<TTableTestRow> columns={columns} />
        <TableBody<TTableTestRow> columns={columns} items={[row]} rowKey={(r) => r.id} />
      </Table>,
    )

    expect(screen.getByRole("grid", { name: "Paginated table" })).toBeInTheDocument()
    expect(screen.getByRole("navigation", { name: "Pagination Navigation" })).toBeInTheDocument()
  })

  it("Falls back to default pagination page-size options when none are supplied.", async () => {
    const user = userEvent.setup()

    render(
      <Table
        aria-label="Default page-size table"
        columns={columns}
        queryControls={{
          pagination: {
            currentPage: 1,
            setCurrentPage: vi.fn(),
            itemsPerPage: 10,
            setItemsPerPage: vi.fn(),
            numberOfItems: 250,
            chosenPaginationSubcomponents: [PAGINATION_SUBCOMPONENT__ITEMS_PER_PAGE],
          },
        }}
      >
        <TableHeader<TTableTestRow> columns={columns} />
        <TableBody<TTableTestRow> columns={columns} items={[row]} rowKey={(r) => r.id} />
      </Table>,
    )

    await user.click(screen.getByLabelText("Items Per Page"))

    expect(await screen.findByRole("option", { name: "30" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "100" })).toBeInTheDocument()
  })

  it("Contains filter popover submissions when rendered inside a parent form.", async () => {
    const user = userEvent.setup()
    const onFiltersChange = vi.fn()
    const onParentSubmit = vi.fn()

    const { baseElement } = render(
      <form
        aria-label="Parent edit form"
        onSubmit={(event) => {
          event.preventDefault()
          onParentSubmit()
        }}
      >
        <TableFilterPopover<TTableTestRow>
          column={filterableDateColumn}
          activeFilters={[]}
          onFiltersChange={onFiltersChange}
          isFilterActive={false}
          activeFilterIcon={<span>Active</span>}
          inactiveFilterIcon={<span>Inactive</span>}
        />
      </form>,
    )

    await user.click(screen.getByRole("button", { name: "Filter by Date" }))

    await waitFor(() => expect(baseElement.querySelectorAll('[data-testid="form-field-label"]')).toHaveLength(2))
    expect(screen.getByTestId("table-filter-popover-default-add-condition-icon")).toBeInTheDocument()

    await user.click(await screen.findByRole("button", { name: "Apply" }))

    expect(onFiltersChange).toHaveBeenCalledTimes(1)
    expect(onParentSubmit).not.toHaveBeenCalled()
  })

  it("Uses provided filtering labels through the popover and clause row stack.", async () => {
    const user = userEvent.setup()

    render(
      <TableFilterPopover<TTableTestRow>
        column={filterableDateColumn}
        activeFilters={[]}
        onFiltersChange={vi.fn()}
        isFilterActive={false}
        activeFilterIcon={<span>Active</span>}
        inactiveFilterIcon={<span>Inactive</span>}
        labels={{
          popover: {
            triggerButtonAriaLabel: ({ criteriaName }) => `Open ${criteriaName} filters`,
            title: "Column filters",
            applyButton: "Confirm filters",
          },
          filterClause: {
            conditionLabel: "Localized condition",
            operations: {
              [TABLE_FILTER_OPERATION_CODE__GREATER_THAN_EQUAL]: "On or after",
            },
          },
          argumentInput: {
            dateLabel: "Localized date",
            dateTimePicker: {
              inputButtonGroupAriaLabel: "Localized filter date controls",
              triggerButtonAriaLabel: "Open localized filter calendar",
            },
          },
        }}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Open Date filters" }))

    expect(await screen.findByText("Column filters")).toBeInTheDocument()
    expect(screen.getByText("Localized condition")).toBeInTheDocument()
    expect(screen.getAllByText("On or after").length).toBeGreaterThan(0)
    expect(screen.getByText("Localized date")).toBeInTheDocument()
    expect(screen.getByRole("group", { name: "Localized date" })).toHaveAttribute(
      "aria-label",
      "Localized filter date controls",
    )
    expect(screen.getByRole("button", { name: /open localized filter calendar/iu })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Confirm filters" })).toBeInTheDocument()
  })

  it("Preserves typeahead filter metadata in table filter popovers.", async () => {
    const user = userEvent.setup()
    const typeAheadColumn: TTableColumnMetadata<TTableTestRow> = {
      id: "name",
      name: "Name",
      filter: {
        enabled: true,
        criteriaID: "name",
        dataType: TABLE_FILTER_ARGUMENT_DATA_TYPE__TEXT,
        allowedOperationCodes: [TABLE_FILTER_OPERATION_CODE__EQUAL],
        usesTypeAheadInput: true,
        typeAheadInputOnChange: vi.fn(),
      },
    }

    render(
      <TableFilterPopover<TTableTestRow>
        column={typeAheadColumn}
        activeFilters={[]}
        onFiltersChange={vi.fn()}
        isFilterActive={false}
        activeFilterIcon={<span>Active</span>}
        inactiveFilterIcon={<span>Inactive</span>}
        labels={{
          argumentInput: {
            typeAheadSearchUnavailable: "Typeahead filters are unavailable",
          },
        }}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Filter by Name" }))

    expect(await screen.findByText("Typeahead filters are unavailable")).toBeInTheDocument()
    expect(screen.queryByPlaceholderText("Filter Argument")).not.toBeInTheDocument()
  })

  it("Merges table filter popover trigger, root, and slot styling hooks.", async () => {
    const user = userEvent.setup()

    const { baseElement } = render(
      <TableFilterPopover<TTableTestRow>
        column={filterableDateColumn}
        activeFilters={[]}
        onFiltersChange={vi.fn()}
        isFilterActive={false}
        activeFilterIcon={<span>Active</span>}
        inactiveFilterIcon={<span>Inactive</span>}
        data-testid="custom-table-filter-popover"
        triggerClassName="header-filter-trigger"
        triggerStyle={{ marginTop: 5 }}
        customTriggerClassName="custom-filter-trigger"
        customTriggerStyles={{ marginLeft: 10 }}
        customPopoverClassName="custom-filter-popover"
        customPopoverStyles={{ padding: 5, width: 360 }}
        className="native-filter-form"
        customClassName="custom-filter-form"
        customStyles={{ minWidth: 260 }}
        style={{ maxWidth: 300 }}
        customTitleRowClassName="custom-title-row"
        customTitleRowStyles={{ marginBottom: 5 }}
        customTitleGroupClassName="custom-title-group"
        customTitleGroupStyles={{ gap: 10 }}
        customClauseListClassName="custom-clause-list"
        customClauseListStyles={{ rowGap: 10 }}
        customActionsClassName="custom-actions"
        customActionsStyles={{ marginTop: 5 }}
      />,
    )

    const trigger = screen.getByRole("button", { name: "Filter by Date" })

    expect(trigger).toHaveClass("header-filter-trigger")
    expect(trigger).toHaveClass("custom-filter-trigger")
    expect(trigger).toHaveStyle({ marginLeft: "10px", marginTop: "5px" })

    await user.click(trigger)

    const popover = baseElement.querySelector('[data-testid="click-popover"]') as HTMLElement
    const form = await screen.findByTestId("custom-table-filter-popover")
    const titleRow = form.querySelector(".custom-title-row") as HTMLElement
    const titleGroup = form.querySelector(".custom-title-group") as HTMLElement
    const clauseList = form.querySelector(".custom-clause-list") as HTMLElement
    const actions = form.querySelector(".custom-actions") as HTMLElement

    expect(popover).toHaveClass("custom-filter-popover")
    expect(popover).toHaveStyle({ padding: "5px", width: "360px" })
    expect(form).toHaveClass(tableFilterPopoverStyles.tableFilterPopover)
    expect(form).toHaveClass("custom-filter-form")
    expect(form).toHaveClass("native-filter-form")
    expect(form).toHaveStyle({ maxWidth: "300px", minWidth: "260px" })
    expect(titleRow).toHaveStyle({ marginBottom: "5px" })
    expect(titleGroup).toHaveStyle({ gap: "10px" })
    expect(clauseList).toHaveStyle({ rowGap: "10px" })
    expect(actions).toHaveStyle({ marginTop: "5px" })
  })
})
