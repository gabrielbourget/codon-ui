import { createNativeCollectionSnapshot } from "../../../collection/snapshot"
import {
  createNativeTableBodyModel,
  createNativeTableHeaderModel,
  createNativeTableRowModel,
  nativeTableItem,
  type TNativeTableModelOptions,
} from "../model"
import { NativeTableCollection } from "../state/TableCollection"

const options: TNativeTableModelOptions = {
  mode: "none",
  behavior: null,
  draggingEnabled: false,
  sortingEnabled: false,
  resizingEnabled: false,
  roundedRadius: 8,
}

it("constructs complete ordered membership without executing a visible content callback", () => {
  const cellRenderer = jest.fn(() => "visible only")
  const columns = [{ id: "name", name: "Name", isRowHeader: true, cellRenderer }]
  const first = { id: 0, name: "First" },
    second = { id: "", name: "Second" }
  const model = [
    createNativeTableHeaderModel({ columns }, options),
    createNativeTableBodyModel({ items: [first, second], columns }, options),
  ]
  const table = new NativeTableCollection(createNativeCollectionSnapshot(model))
  expect(table.rows.map((row) => row.key)).toEqual([0, ""])
  expect(table.rows[0].value).toBe(first)
  expect(table.columns.map((column) => column.key)).toEqual(["name"])
  expect([...table.getChildren(0)].map((cell) => cell.key)).toEqual(["number:0:name"])
  expect(cellRenderer).not.toHaveBeenCalled()
})

it("requires stable row identity and uses explicit loading rows as the complete body model", () => {
  const columns = [{ id: "name", name: "Name", isRowHeader: true }]
  expect(() => createNativeTableRowModel({ item: { name: "Missing" }, columns }, options)).toThrow("stable id")
  const loading = createNativeTableRowModel({ id: "loading", item: { name: "Loading" }, columns }, options)
  const body = createNativeTableBodyModel(
    { isLoading: true, items: [{ id: "hidden", name: "Hidden" }], columns },
    options,
    [loading],
  )
  const table = new NativeTableCollection(
    createNativeCollectionSnapshot([createNativeTableHeaderModel({ columns }, options), body]),
  )
  expect(table.rows.map((row) => row.key)).toEqual(["loading"])
  expect(table.getItem("hidden")).toBeNull()
})

it("preserves explicit spanning-cell metadata in custom receiver models", () => {
  const columns = ["one", "two", "three"].map((id) => ({ id, name: id, isRowHeader: id === "one" }))
  const cells = [
    nativeTableItem("span", "cell", { colSpan: 2 }, () => <></>),
    nativeTableItem("last", "cell", {}, () => <></>),
  ]
  const body = nativeTableItem("body", "tablebody", {}, () => <></>, [
    nativeTableItem("row", "item", {}, () => <></>, cells),
  ])
  const table = new NativeTableCollection(
    createNativeCollectionSnapshot([createNativeTableHeaderModel({ columns }, options), body]),
  )
  expect(table.getItem("span")!.colSpan).toBe(2)
  expect(table.getItem("last")!.colIndex).toBe(2)
})
