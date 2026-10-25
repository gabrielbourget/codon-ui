import { createRef } from "react"
import { View } from "react-native"

// @ts-expect-error Table remains private until its complete component contract is implemented.
import { Table as PublicTable } from "../src"
import { NativeSelectableCollectionContext } from "../src/collection/context"
import { FilterClauseRow } from "../src/components/Filtering/FilterClauseRow"
import { buildNativeTableFilterDraft } from "../src/components/Table/filterPopoverDraft"
import { Table } from "../src/components/Table/Table"
import { TableBody } from "../src/components/Table/TableBody"
import { TableCell } from "../src/components/Table/TableCell"
import { TableFilterPopover } from "../src/components/Table/TableFilterPopover"
import { TableHeader } from "../src/components/Table/TableHeader"
import { TableRow } from "../src/components/Table/TableRow"
import type {
  TNativeTableColumnMetadata,
  TNativeTableHeaderProps,
  TNativeTableHeaderRenderState,
  TNativeTableCellProps,
  TNativeTableProps,
} from "../src/components/Table/types"
import { NativeFocusView } from "../src/input/NativeFocusView"

const rows = [{ id: 0, name: "Alpha" }]
const columns: TNativeTableColumnMetadata<(typeof rows)[number]>[] = [
  { id: "name", name: "Person", isRowHeader: true, accessor: (row) => row.name },
  { id: "action", role: "structural", structuralKind: "action", structuralPosition: "right", width: 0 },
]
const view = createRef<View>()
export const tableRef = <Table ref={view} />
export const tableCallbackRef = (
  <Table
    ref={(target) => {
      const original: View | null = target
      return () => void original
    }}
  />
)
// @ts-expect-error The root ref must receive the original native View, not a focus-shaped proxy.
export const invalidTableRef: TNativeTableProps["ref"] = createRef<{ focus: () => void }>()
export const rootGeometry = <Table geometry="round" />
// @ts-expect-error Root geometry retains the canonical finite token domain.
export const invalidRootGeometry: TNativeTableProps["geometry"] = "circular"
export const headerRenderer = (
  <TableHeader
    columns={columns}
    onHoverChange={(hovered) => {
      const value: boolean = hovered
      void value
    }}
    render={(props, state) => {
      const hovered: boolean = state.isHovered
      return <View {...props} style={[props.style, { opacity: hovered ? 0.5 : 1 }]} />
    }}
  />
)
// @ts-expect-error Header hover state retains the original boolean domain.
export const invalidHeaderHover: TNativeTableHeaderRenderState["isHovered"] = "hovered"
// @ts-expect-error A native render callback must return its single original native root.
export const invalidHeaderRender: TNativeTableHeaderProps<object>["render"] = () => null
export const cellRenderer = (
  <TableCell
    id="rendered"
    columnID="name"
    render={(props, state) => {
      const selected: boolean = state.isSelected
      const column: number | null | undefined = state.columnIndex
      // @ts-expect-error Only the children function receives defaultChildren.
      void state.defaultChildren
      void column
      return <NativeFocusView {...props} style={[props.style, { opacity: selected ? 1 : 0.5 }]} />
    }}
  >
    {(state) => {
      const original: undefined = state.defaultChildren
      void original
      return "Value"
    }}
  </TableCell>
)
// @ts-expect-error The Cell renderer must return its native root.
export const invalidCellRender: TNativeTableCellProps["render"] = () => null
export const linkedRow = (
  <TableRow
    id={0}
    item={rows[0]}
    columns={columns}
    href="/people/0"
    onNavigationError={(error, href) => {
      void [error, href]
    }}
  />
)
// @ts-expect-error Native link destinations retain the existing Link string contract.
export const invalidLink = <TableRow item={rows[0]} columns={columns} href={0} />
const composition = (
  <Table accessibilityLabel="People" style={{ width: "100%" }}>
    <TableHeader columns={columns} />
    <TableBody
      ref={view}
      items={rows}
      columns={columns}
      rowKey={(row) => row.id}
      renderCell={({ row, column }) => `${row.name}:${column.id}`}
      renderEmptyState={() => "Empty"}
    />
  </Table>
)
const selection = (
  <Table
    selectionMode="multiple"
    selectedKeys={new Set([0])}
    labels={{ selection: { selectRowAriaLabel: "Row" } }}
    disallowSelectAll
    escapeKeyBehavior="none"
    shouldFocusWrap
  />
)
const textCell = (
  <TableCell columnID="name" textValue="Explicit search text">
    Visible text
  </TableCell>
)
const renderedCell = (
  <TableCell columnID="name">
    {(state) => {
      const flags: boolean[] = [
        state.isPressed,
        state.isHovered,
        state.isFocused,
        state.isFocusVisible,
        state.isSelected,
        state.isDisabled,
        state.isTreeColumn,
        state.isExpanded,
        state.hasChildItems,
      ]
      const id: string | number | undefined = state.id
      const column: number | null | undefined = state.columnIndex
      const level: number = state.level
      const originalDefault: undefined = state.defaultChildren
      void [flags, id, column, level, originalDefault]
      return "Cell content"
    }}
  </TableCell>
)
const ignoredTypeaheadFlag = (
  <NativeSelectableCollectionContext.Provider value={{ disallowTypeAhead: true }}>
    <Table />
  </NativeSelectableCollectionContext.Provider>
)
// @ts-expect-error The inherited context flag is not a public Table prop in the canonical source.
const invalidTypeaheadProp = <Table disallowTypeAhead />
// @ts-expect-error Search metadata is a string, preserving the canonical textValue contract.
const invalidTextValue = <TableCell columnID="name" textValue={0} />
// @ts-expect-error Escape behavior retains the canonical finite policy.
const invalidEscape = <Table escapeKeyBehavior="close" />
const action = (
  <Table
    clickableRows
    onRowAction={(key) => {
      const typed: string | number = key
      void typed
    }}
  />
)
const query = (
  <Table
    columns={columns}
    queryControls={{
      sorting: { activeSorts: [], onSortChange: () => {} },
      pagination: {
        currentPage: 1,
        itemsPerPage: 10,
        numberOfItems: 20,
        setCurrentPage: () => {},
        setItemsPerPage: () => {},
      },
    }}
  />
)
const filtering = (
  <Table queryControls={{ filtering: { activeFilters: [], mode: "popover", onFiltersChange: () => {} } }} />
)
// @ts-expect-error An onFiltersChange owner requires the explicit popover mode.
const invalidFiltering = <Table queryControls={{ filtering: { activeFilters: [], onFiltersChange: () => {} } }} />
const filterPopover = (
  <TableFilterPopover
    column={columns[0]}
    activeFilters={[]}
    onFiltersChange={() => {}}
    isFilterActive={false}
    activeFilterIcon={null}
    inactiveFilterIcon={null}
    data-testid="filters"
    labels={{ argumentInput: { comboBox: { triggerButtonAriaLabel: "Show" } } }}
  />
)
const filterDraft = buildNativeTableFilterDraft(columns[0])
const clause = (
  <FilterClauseRow
    ref={view}
    nativeID="filter-clause"
    group={filterDraft}
    clause={filterDraft.clauses[0]}
    listIndex={0}
    availableFilterCriteria={[]}
    onModifyFilterClause={() => {}}
    onDeleteFilterClause={() => {}}
    customStyles={{ padding: 0 }}
  />
)
const resizing = (
  <Table
    columns={columns}
    columnResizing={{
      enabled: true,
      onColumnResize: ({ columnID, width }) => {
        const result: [string, number] = [columnID, width]
        void result
      },
    }}
  />
)
// @ts-expect-error Resizing requests require the owner's width callback.
const invalidResizing = <Table columnResizing={{ enabled: true }} />
// @ts-expect-error Native body rows preserve canonical string/number keys.
const key = <TableBody items={rows} columns={columns} rowKey={() => false} />
// @ts-expect-error DOM classes do not enter the native renderer.
const dom = <Table className="table" />
// @ts-expect-error Native styles do not accept CSS table-layout.
const css = <Table style={{ tableLayout: "fixed" }} />
// @ts-expect-error A cell cannot replace its original native ref with a DOM ref.
const ref = <TableCell columnID="name" ref={createRef<{ getBoundingClientRect: () => { width: number } }>()} />
void [
  PublicTable,
  composition,
  selection,
  textCell,
  renderedCell,
  ignoredTypeaheadFlag,
  invalidTypeaheadProp,
  invalidTextValue,
  invalidEscape,
  action,
  query,
  filtering,
  invalidFiltering,
  filterPopover,
  clause,
  resizing,
  invalidResizing,
  key,
  dom,
  css,
  ref,
]
