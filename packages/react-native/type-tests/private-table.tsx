import { createRef } from "react"
import type { View } from "react-native"

// @ts-expect-error Table remains private until its complete component contract is implemented.
import { Table as PublicTable } from "../src"
import { Table } from "../src/components/Table/Table"
import { TableBody } from "../src/components/Table/TableBody"
import { TableCell } from "../src/components/Table/TableCell"
import { TableHeader } from "../src/components/Table/TableHeader"
import type { TNativeTableColumnMetadata } from "../src/components/Table/types"

const rows = [{ id: 0, name: "Alpha" }]
const columns: TNativeTableColumnMetadata<(typeof rows)[number]>[] = [
  { id: "name", name: "Person", isRowHeader: true, accessor: (row) => row.name },
  { id: "action", role: "structural", structuralKind: "action", structuralPosition: "right", width: 0 },
]
const view = createRef<View>()
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
  <Table selectionMode="multiple" selectedKeys={new Set([0])} labels={{ selection: { selectRowAriaLabel: "Row" } }} />
)
const action = (
  <Table
    clickableRows
    onRowAction={(key) => {
      const typed: string | number = key
      void typed
    }}
  />
)
// @ts-expect-error Sorting/filtering/pagination remain required future Table work, not ignored props.
const query = <Table queryControls={{}} />
// @ts-expect-error Native pointer/keyboard resizing has not been implemented by this view step.
const resizing = <Table columnResizing={{ enabled: true }} />
// @ts-expect-error Native body rows preserve canonical string/number keys.
const key = <TableBody items={rows} columns={columns} rowKey={() => false} />
// @ts-expect-error DOM classes do not enter the native renderer.
const dom = <Table className="table" />
// @ts-expect-error Native styles do not accept CSS table-layout.
const css = <Table style={{ tableLayout: "fixed" }} />
// @ts-expect-error A cell cannot replace its original native ref with a DOM ref.
const ref = <TableCell columnID="name" ref={createRef<{ getBoundingClientRect: () => { width: number } }>()} />
void [PublicTable, composition, selection, action, query, resizing, key, dom, css, ref]
