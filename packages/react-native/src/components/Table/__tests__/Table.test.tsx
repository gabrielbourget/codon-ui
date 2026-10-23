import "../../../collection/__tests__/nativeReceipts"

import { cleanup } from "@testing-library/react-native"
import { createRef, useState } from "react"
import { StyleSheet, TextInput } from "react-native"

import {
  actWithNativeCollections as act,
  renderWithNativeCollections as render,
  screen,
} from "../../../collection/__tests__/nativeReceipts"
import { NativeThemeProvider } from "../../../theme"
import { Table } from "../Table"
import { TableBody } from "../TableBody"
import { TableHeader } from "../TableHeader"
import { TableRow } from "../TableRow"
import type { TNativeTableColumnMetadata } from "../types"

jest.unmock("react-native/Libraries/Components/TextInput/TextInput")
afterEach(cleanup)
type TRow = { id: string | number; name: string; left?: string; right?: string }
const columns: TNativeTableColumnMetadata<TRow>[] = [
  { id: "right", name: "Right", role: "structural", structuralPosition: "right", structuralKind: "action", width: 30 },
  { id: "name", name: "Name" },
  { id: "hidden", name: "Hidden", isHidden: true },
  { id: "left", name: "Left", role: "structural", structuralPosition: "left", structuralKind: "action", width: 0 },
]
const items: TRow[] = [
  { id: "a", name: "Alpha", left: "A", right: "Z" },
  { id: "b", name: "Beta", left: "B", right: "Y" },
]
const wrap = (children: React.ReactNode) => <NativeThemeProvider>{children}</NativeThemeProvider>
const cells = () =>
  screen.container.queryAll((host) => JSON.parse(host.props.nativeCollectionSemantics || "null")?.kind === "cell")
const root = () => JSON.parse(screen.getByTestId("table").props.nativeCollectionSemantics)

it("renders native header/body/row/cell composition in normalized logical column order", async () => {
  await render(
    wrap(
      <Table accessibilityLabel="People">
        <TableHeader columns={columns} />
        <TableBody items={items} columns={columns} />
      </Table>,
    ),
  )
  const visible = cells()
  expect(visible).toHaveLength(9)
  for (const [index, text] of ["Left", "Name", "Right", "A", "Alpha", "Z", "B", "Beta", "Y"].entries())
    expect(visible[index]).toHaveTextContent(text)
  expect(screen.queryByText("Hidden")).toBeNull()
  expect(root()).toMatchObject({ kind: "root", rowCount: 3, columnCount: 3, selectionMode: "none" })
  const semantics = visible.map((host) => JSON.parse(host.props.nativeCollectionSemantics))
  expect(semantics.map((cell) => [cell.rowIndex, cell.columnIndex])).toEqual([
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 0],
    [1, 1],
    [1, 2],
    [2, 0],
    [2, 1],
    [2, 2],
  ])
  expect(semantics.slice(0, 3).every((cell) => cell.heading)).toBe(true)
  expect(semantics.slice(3).every((cell) => cell.parentTarget > 0 && cell.columnHeaderTargets.length === 1)).toBe(true)
})

it("keeps explicit zero-width structural tracks and independent native style owners", async () => {
  const registered = StyleSheet.create({ header: { paddingTop: 8 }, body: { paddingBottom: 9 } })
  const styled = columns.map((column) =>
    column.id === "name" ? { ...column, customBodyCellStyles: { padding: 7 } } : column,
  )
  await render(
    wrap(
      <Table testID="table" customStyles={{ marginTop: 2, width: 100 }} style={{ width: 200 }}>
        <TableHeader testID="header" columns={styled} customStyles={registered.header} />
        <TableBody
          testID="body"
          items={items}
          columns={styled}
          customStyles={registered.body}
          customRowStyles={{ marginTop: 3 }}
        />
      </Table>,
    ),
  )
  expect(screen.getByTestId("table")).toHaveStyle({ width: 200, marginTop: 2 })
  expect(screen.getByTestId("header")).toHaveStyle({ paddingTop: 8 })
  expect(screen.getByTestId("body")).toHaveStyle({ paddingBottom: 9 })
  expect(cells()[0]).toHaveStyle({ width: 0, flexGrow: 0 })
  expect(cells()[4]).toHaveStyle({ padding: 7 })
  for (const key of ["items", "columns", "rowKey", "renderCell", "customStyles"])
    expect(screen.getByTestId("body").props[key]).toBeUndefined()
})

it("calls the column renderer before the body renderer with original row and column objects", async () => {
  const columnRender = jest.fn(({ row }: { row: TRow }) => row.name)
  const fallback = jest.fn(({ row }: { row: TRow }) => `fallback:${row.id}`)
  const received = [
    { id: "name", name: "Name", cellRenderer: columnRender },
    { id: "other", name: "Other" },
  ]
  await render(
    wrap(
      <Table>
        <TableHeader columns={received} />
        <TableBody items={[items[0]]} columns={received} renderCell={fallback} />
      </Table>,
    ),
  )
  expect(columnRender).toHaveBeenCalledWith({ row: items[0], column: received[0] })
  expect(fallback).toHaveBeenCalledWith({ row: items[0], column: received[1] })
  expect(fallback.mock.calls.some(([value]) => "column" in value && value.column === received[0])).toBe(false)
  expect(cells()[2]).toHaveTextContent("Alpha")
  expect(cells()[3]).toHaveTextContent("fallback:a")
})

it.each([undefined, "auto", null] as const)(
  "keeps fluid header and body tracks independent of content width for %s",
  async (width) => {
    const metadata: TNativeTableColumnMetadata<TRow>[] = [{ id: "name", name: "Short", width }]
    await render(
      wrap(
        <Table>
          <TableHeader columns={metadata} />
          <TableBody columns={metadata} items={[{ id: "long", name: "A much longer body value" }]} />
        </Table>,
      ),
    )
    for (const cell of cells()) expect(cell).toHaveStyle({ flexGrow: 1, flexShrink: 1, flexBasis: 0 })
  },
)

it.each([
  [0, "0"],
  [false, "False"],
  [true, "True"],
  ["", ""],
  [null, ""],
  [{ nested: 0 }, '{"nested":0}'],
] as const)("renders canonical scalar/object cell value %j", async (value, expected) => {
  const data = [{ id: "value", value }]
  const metadata = [{ id: "value", name: "Value" }]
  await render(
    wrap(
      <Table>
        <TableHeader columns={metadata} />
        <TableBody items={data} columns={metadata} />
      </Table>,
    ),
  )
  expect(cells()[1]).toHaveTextContent(expected === "" ? /^$/ : expected)
})

it("replaces source rows with a loading row and then uses the empty renderer without stale cells", async () => {
  const metadata = [{ id: "name", name: "Name" }]
  const empty = jest.fn(() => "No people")
  const node = (loading: boolean) =>
    wrap(
      <Table>
        <TableHeader columns={metadata} />
        <TableBody
          columns={metadata}
          items={loading ? items : []}
          isLoading={loading}
          renderLoadingState={() => <TableRow id="loading" item={{ name: "Loading" }} columns={metadata} />}
          renderEmptyState={empty}
        />
      </Table>,
    )
  const view = await render(node(true))
  expect(cells()).toHaveLength(2)
  expect(cells()[1]).toHaveTextContent("Loading")
  expect(screen.queryByText("Alpha")).toBeNull()
  expect(empty).not.toHaveBeenCalled()
  await view.rerender(node(false))
  expect(screen.getByText("No people")).toBeOnTheScreen()
  expect(screen.queryByText("Loading")).toBeNull()
  expect(root().rowCount).toBe(1)
})

it("keeps ordinary items while isLoading has no loading renderer", async () => {
  await render(
    wrap(
      <Table>
        <TableHeader columns={columns} />
        <TableBody items={items} columns={columns} isLoading />
      </Table>,
    ),
  )
  expect(screen.getByText("Alpha")).toBeOnTheScreen()
  expect(screen.getByText("Beta")).toBeOnTheScreen()
})

it("preserves an original editor and its held value through opaque child-local row reorder", async () => {
  const editor = createRef<TextInput>()
  let reverse: () => void = () => {}
  const metadata: TNativeTableColumnMetadata<TRow>[] = [
    {
      id: "name",
      name: "Name",
      cellRenderer: ({ row }) => (row.id === "a" ? <TextInput ref={editor} value="held" testID="editor" /> : row.name),
    },
  ]
  const Rows = () => {
    const [reversed, setReversed] = useState(false)
    reverse = () => setReversed((value) => !value)
    return <TableBody items={reversed ? [...items].reverse() : items} columns={metadata} />
  }
  await render(
    wrap(
      <Table>
        <TableHeader columns={metadata} />
        <Rows />
      </Table>,
    ),
  )
  const original = editor.current!
  const write = jest.spyOn(original, "setNativeProps")
  await act(reverse)
  expect(cells()[1]).toHaveTextContent("Beta")
  expect(editor.current).toBe(original)
  expect(screen.getByTestId("editor").props.value).toBe("held")
  expect(write).not.toHaveBeenCalled()
})
