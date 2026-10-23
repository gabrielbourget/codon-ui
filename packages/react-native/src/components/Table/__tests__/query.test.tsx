import "../../../collection/__tests__/nativeReceipts"

import { cleanup, userEvent, within } from "@testing-library/react-native"

import {
  actWithNativeCollections as act,
  renderWithNativeCollections as render,
  screen,
} from "../../../collection/__tests__/nativeReceipts"
import { NativeFloatingLayerHost } from "../../../overlays/floating/NativeFloatingLayerHost"
import { NativeFloatingWindowContext } from "../../../overlays/floating/scope"
import { NativeOverlayProvider } from "../../../overlays/NativeOverlayProvider"
import { NativeThemeProvider } from "../../../theme"
import type { TNativePaginationProps } from "../../Pagination/types"
import {
  TABLE_SORT_DIRECTION__ASCENDING,
  TABLE_SORT_DIRECTION__DESCENDING,
  type TTableSortInstruction,
} from "../queryTypes"
import { Table } from "../Table"
import { TableBody } from "../TableBody"
import { TableHeader } from "../TableHeader"
import type { TNativeTableColumnMetadata, TNativeTableProps } from "../types"

beforeEach(() => jest.useFakeTimers())
afterEach(async () => {
  await cleanup()
  jest.clearAllTimers()
  jest.useRealTimers()
})
type TRow = { id: string; name: string; age: number }
const items = [
  { id: "a", name: "Alpha", age: 2 },
  { id: "b", name: "Beta", age: 1 },
]
const columns = [
  { id: "name", name: "Name", isRowHeader: true, sort: { enabled: true, criteriaID: "person", queryKey: "user.name" } },
  { id: "age", name: "Age", sort: { enabled: true, criteriaID: "age" } },
] satisfies TNativeTableColumnMetadata<TRow>[]
const node = (
  props: TNativeTableProps<TRow>,
  header: TNativeTableColumnMetadata<TRow>[] = columns,
  windowActive = () => true,
) => (
  <NativeThemeProvider>
    <NativeOverlayProvider>
      <NativeFloatingLayerHost>
        <NativeFloatingWindowContext.Provider value={windowActive}>
          <Table accessibilityLabel="Rows" columns={columns} {...props}>
            <TableHeader columns={header} />
            <TableBody items={items} columns={columns} />
          </Table>
        </NativeFloatingWindowContext.Provider>
      </NativeFloatingLayerHost>
    </NativeOverlayProvider>
  </NativeThemeProvider>
)
const press = async (target: Parameters<ReturnType<typeof userEvent.setup>["press"]>[0]) => {
  await userEvent.setup().press(target)
  await act(() => {})
}
const sorted = (criteriaID: string, descending = false): TTableSortInstruction => ({
  id: `sort-${criteriaID}`,
  criteriaID,
  criteriaName: criteriaID === "person" ? "Name" : "Age",
  queryKey: criteriaID === "person" ? "user.name" : undefined,
  sortDirection: descending ? TABLE_SORT_DIRECTION__DESCENDING : TABLE_SORT_DIRECTION__ASCENDING,
})
it("repeats held sort requests and cycles only after the owner echoes without sorting rows", async () => {
  const changed = jest.fn(),
    held: TTableSortInstruction[] = []
  const renderNode = (activeSorts = held) =>
    node({ queryControls: { sorting: { activeSorts, onSortChange: changed } } })
  const view = await render(renderNode())
  await press(screen.getByRole("button", { name: "Name" }))
  await press(screen.getByRole("button", { name: "Name" }))
  expect(changed.mock.calls).toEqual([[[sorted("person")]], [[sorted("person")]]])
  expect(held).toEqual([])
  await view.rerender(renderNode(changed.mock.calls[1][0]))
  await press(screen.getByRole("button", { name: "Name" }))
  expect(changed).toHaveBeenLastCalledWith([sorted("person", true)])
  await view.rerender(renderNode(changed.mock.calls[2][0]))
  await press(screen.getByRole("button", { name: "Name" }))
  expect(changed).toHaveBeenLastCalledWith([])
  const rendered = screen.getAllByText(/^(Alpha|Beta)$/)
  expect(rendered[0]).toHaveTextContent("Alpha")
  expect(rendered[1]).toHaveTextContent("Beta")
})
it("preserves stacked priority and shows secondary icons while only the first sort owns the header value", async () => {
  const changed = jest.fn()
  const renderNode = (activeSorts: TTableSortInstruction[]) =>
    node({ queryControls: { sorting: { activeSorts, mode: "multiple", onSortChange: changed } } })
  const view = await render(renderNode([sorted("person"), sorted("age")]))
  expect(screen.getAllByTestId("query-ascending-glyph", { includeHiddenElements: true })).toHaveLength(2)
  expect(screen.getByRole("columnheader", { name: "Name" }).props.accessibilityValue).toEqual({ text: "ascending" })
  expect(screen.getByRole("columnheader", { name: "Age" }).props.accessibilityValue).toEqual({ text: "none" })
  await press(screen.getByRole("button", { name: "Age" }))
  expect(changed).toHaveBeenLastCalledWith([sorted("person"), sorted("age", true)])
  await view.rerender(renderNode([sorted("person", true), sorted("age")]))
  await press(screen.getByRole("button", { name: "Name" }))
  expect(changed).toHaveBeenLastCalledWith([sorted("age")])
  await view.rerender(renderNode(changed.mock.calls[1][0]))
  expect(screen.getByRole("columnheader", { name: "Age" }).props.accessibilityValue).toEqual({ text: "ascending" })
})
it("keeps inner header metadata separate from the root header press bridge, including omitted root columns", async () => {
  const changed = jest.fn()
  const root = [{ ...columns[0], name: "Root name", sort: { enabled: true, criteriaID: "root" } }, columns[1]]
  const renderNode = (rootColumns: TNativeTableColumnMetadata<TRow>[] | undefined) =>
    node({ columns: rootColumns, queryControls: { sorting: { activeSorts: [], onSortChange: changed } } })
  const view = await render(renderNode(root))
  await press(screen.getByRole("columnheader", { name: "Name" }))
  expect(changed).toHaveBeenLastCalledWith([
    {
      id: "sort-root",
      criteriaID: "root",
      criteriaName: "Root name",
      queryKey: undefined,
      sortDirection: TABLE_SORT_DIRECTION__ASCENDING,
    },
  ])
  await press(screen.getByRole("button", { name: "Name" }))
  expect(changed).toHaveBeenLastCalledWith([sorted("person")])
  expect(changed).toHaveBeenCalledTimes(2)
  await view.rerender(renderNode(undefined))
  await press(screen.getByRole("columnheader", { name: "Name" }))
  expect(changed).toHaveBeenCalledTimes(2)
  await press(screen.getByRole("button", { name: "Name" }))
  expect(changed).toHaveBeenCalledTimes(3)
})
it("retains empty-criterion callback identity and explicit false icons", async () => {
  const changed = jest.fn(),
    active = [sorted("person")]
  const view = await render(
    node({ queryControls: { sorting: { activeSorts: active, icons: { ascending: false }, onSortChange: changed } } }),
  )
  expect(screen.queryByTestId("query-ascending-glyph", { includeHiddenElements: true })).toBeNull()
  await view.rerender(
    node({ queryControls: { sorting: { activeSorts: active, icons: { ascending: 0 }, onSortChange: changed } } }),
  )
  expect(screen.getByText("0", { includeHiddenElements: true })).toBeOnTheScreen()
  expect(screen.queryByTestId("query-ascending-glyph", { includeHiddenElements: true })).toBeNull()
  await view.rerender(
    node({ queryControls: { sorting: { activeSorts: active, onSortChange: changed } } }, [
      { ...columns[0], sort: { enabled: true, criteriaID: "" } },
    ]),
  )
  await press(screen.getByRole("button", { name: "Name" }))
  expect(changed).toHaveBeenLastCalledWith(active)
  expect(changed.mock.calls[0][0]).toBe(active)
})
it("rejects sort requests after the original physical window becomes inactive", async () => {
  const changed = jest.fn()
  let active = true
  await render(node({ queryControls: { sorting: { activeSorts: [], onSortChange: changed } } }, columns, () => active))
  active = false
  await press(screen.getByRole("button", { name: "Name" }))
  expect(changed).not.toHaveBeenCalled()
})
it("composes pagination defaults outside the grid and preserves held page ownership and caller overrides", async () => {
  const page = jest.fn(),
    size = jest.fn()
  const pagination: TNativePaginationProps = {
    currentPage: 1,
    itemsPerPage: 10,
    numberOfItems: 100,
    setCurrentPage: page,
    setItemsPerPage: size,
  }
  const view = await render(node({ queryControls: { pagination } }))
  expect(screen.getByTestId("items-per-page")).toBeOnTheScreen()
  expect(screen.getByTestId("primary-controls")).toBeOnTheScreen()
  expect(screen.queryByTestId("page-counter")).toBeNull()
  expect(within(screen.getByTestId("table")).queryByTestId("pagination")).toBeNull()
  expect(screen.queryByRole("button", { name: "Next Page" })).toBeNull()
  await press(screen.getByRole("button", { name: "Go To Page 10" }))
  await press(screen.getByRole("button", { name: "Go To Page 10" }))
  expect(page.mock.calls).toEqual([[10], [10]])
  expect(size).not.toHaveBeenCalled()
  await view.rerender(
    node({
      queryControls: { pagination: { ...pagination, currentPage: 2, chosenPaginationSubcomponents: ["page-counter"] } },
    }),
  )
  expect(screen.queryByTestId("items-per-page")).toBeNull()
  expect(screen.queryByTestId("primary-controls")).toBeNull()
  expect(screen.getByTestId("page-counter")).toBeOnTheScreen()
})
it("lets explicit undefined pagination groups override the Table defaults", async () => {
  await render(
    node({
      queryControls: {
        pagination: {
          currentPage: 1,
          itemsPerPage: 10,
          numberOfItems: 1,
          setCurrentPage: () => {},
          setItemsPerPage: () => {},
          chosenPaginationSubcomponents: undefined,
          showWithOnePage: true,
        },
      },
    }),
  )
  expect(screen.queryByTestId("items-per-page")).toBeNull()
  expect(screen.getByTestId("primary-controls")).toBeOnTheScreen()
  expect(screen.queryByRole("button", { name: "Next Page" })).toBeNull()
})
