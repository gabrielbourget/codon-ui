import { describe, expect, it } from "vitest"

import {
  computeNextTableSorts,
  getAllowedTableColumnFilterOperationCodes,
  normalizeTableColumns,
  TABLE_COLUMN_ROLE__STRUCTURAL,
  TABLE_STRUCTURAL_COLUMN_KIND__ACTION,
  TABLE_STRUCTURAL_COLUMN_KIND__SELECTION,
  TABLE_STRUCTURAL_COLUMN_POSITION__LEFT,
  TABLE_STRUCTURAL_COLUMN_POSITION__RIGHT,
  type TTableColumnMetadata,
} from "../helpers"
import {
  TABLE_FILTER_OPERATION_CODE__LIKE,
  TABLE_SORT_DIRECTION__ASCENDING,
  TABLE_SORT_DIRECTION__DESCENDING,
} from "../queryTypes"

type TTableHelperTestRow = {
  id: string
  name: string
  date: string
}

const buildColumns = (): TTableColumnMetadata<TTableHelperTestRow>[] => [
  {
    id: "name",
    name: "Name",
    filter: {
      enabled: true,
      criteriaID: "name",
      allowedOperationCodes: [TABLE_FILTER_OPERATION_CODE__LIKE],
    },
  },
  {
    id: "hidden-data",
    name: "Hidden Data",
    isHidden: true,
  },
  {
    id: "remove",
    role: TABLE_COLUMN_ROLE__STRUCTURAL,
    structuralKind: TABLE_STRUCTURAL_COLUMN_KIND__ACTION,
    structuralPosition: TABLE_STRUCTURAL_COLUMN_POSITION__RIGHT,
    width: 44,
    headerAriaLabel: "Remove row",
  },
  {
    id: "select",
    role: TABLE_COLUMN_ROLE__STRUCTURAL,
    structuralKind: TABLE_STRUCTURAL_COLUMN_KIND__SELECTION,
    structuralPosition: TABLE_STRUCTURAL_COLUMN_POSITION__LEFT,
    width: 30,
    headerAriaLabel: "Select row",
  },
  {
    id: "hidden-action",
    role: TABLE_COLUMN_ROLE__STRUCTURAL,
    structuralKind: TABLE_STRUCTURAL_COLUMN_KIND__ACTION,
    structuralPosition: TABLE_STRUCTURAL_COLUMN_POSITION__RIGHT,
    width: 52,
    headerAriaLabel: "Hidden action",
    isHidden: true,
  },
  {
    id: "date",
    name: "Date",
  },
]

describe("Table helper tests", () => {
  it("Normalizes data and structural columns into render regions.", () => {
    const normalizedColumns = normalizeTableColumns(buildColumns())

    expect(normalizedColumns.dataColumns.map((column) => column.id)).toEqual(["name", "date"])
    expect(normalizedColumns.leftStructuralColumns.map((column) => column.id)).toEqual(["select"])
    expect(normalizedColumns.rightStructuralColumns.map((column) => column.id)).toEqual(["remove"])
    expect(normalizedColumns.visibleColumns.map((column) => column.id)).toEqual(["select", "name", "date", "remove"])
  })

  it("Excludes hidden columns from structural width reservations.", () => {
    const normalizedColumns = normalizeTableColumns(buildColumns())

    expect(normalizedColumns.structuralColumns.map((column) => column.id)).toEqual(["remove", "select"])
    expect(normalizedColumns.reservedStructuralColumnWidthPx).toBe(74)
    expect(normalizedColumns.reservedStructuralColumnCount).toBe(2)
  })

  it("Reads filter operation capabilities from data columns only.", () => {
    const columns = buildColumns()
    const nameColumn = columns.find((column) => column.id === "name")
    const dateColumn = columns.find((column) => column.id === "date")
    const removeColumn = columns.find((column) => column.id === "remove")

    expect(nameColumn ? getAllowedTableColumnFilterOperationCodes(nameColumn) : []).toEqual([
      TABLE_FILTER_OPERATION_CODE__LIKE,
    ])
    expect(dateColumn ? getAllowedTableColumnFilterOperationCodes(dateColumn) : []).toEqual([])
    expect(removeColumn ? getAllowedTableColumnFilterOperationCodes(removeColumn) : []).toEqual([])
  })

  it("Cycles stacked sorts per column while preserving activation order.", () => {
    const columns: TTableColumnMetadata<TTableHelperTestRow>[] = [
      {
        id: "name",
        name: "Name",
        sort: { enabled: true, criteriaID: "name", queryKey: "name" },
      },
      {
        id: "date",
        name: "Date",
        sort: { enabled: true, criteriaID: "startDateTime", queryKey: "startDateTime" },
      },
    ]
    const nameColumn = columns[0]!
    const dateColumn = columns[1]!

    let activeSorts = computeNextTableSorts({
      activeSorts: [],
      column: nameColumn,
      mode: "multiple",
    })

    expect(activeSorts).toMatchObject([
      {
        criteriaID: "name",
        sortDirection: TABLE_SORT_DIRECTION__ASCENDING,
      },
    ])

    activeSorts = computeNextTableSorts({
      activeSorts,
      column: dateColumn,
      mode: "multiple",
    })

    expect(activeSorts).toMatchObject([
      {
        criteriaID: "name",
        sortDirection: TABLE_SORT_DIRECTION__ASCENDING,
      },
      {
        criteriaID: "startDateTime",
        sortDirection: TABLE_SORT_DIRECTION__ASCENDING,
      },
    ])

    activeSorts = computeNextTableSorts({
      activeSorts,
      column: dateColumn,
      mode: "multiple",
    })

    expect(activeSorts).toMatchObject([
      {
        criteriaID: "name",
        sortDirection: TABLE_SORT_DIRECTION__ASCENDING,
      },
      {
        criteriaID: "startDateTime",
        sortDirection: TABLE_SORT_DIRECTION__DESCENDING,
      },
    ])

    activeSorts = computeNextTableSorts({
      activeSorts,
      column: dateColumn,
      mode: "multiple",
    })

    expect(activeSorts).toMatchObject([
      {
        criteriaID: "name",
        sortDirection: TABLE_SORT_DIRECTION__ASCENDING,
      },
    ])
  })
})
