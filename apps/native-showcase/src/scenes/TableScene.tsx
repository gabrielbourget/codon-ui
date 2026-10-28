import { useRef, useState } from "react"
import { ScrollView, View, type TextInput } from "react-native"

import {
  Button,
  Input,
  SortParameterList,
  Table,
  TableBody,
  TableHeader,
  Text,
  type SortParameter,
  type TableColumnMetadata,
  type TableFilterGroup,
  type TableSortInstruction,
} from "@codon-ui/react-native"

import { TableDragScene } from "./TableDragScene"

type TPerson = { id: string; name: string; active: boolean }
const people: TPerson[] = Array.from({ length: 20 }, (_, index) => ({
  id: `person-${index}`,
  name: `Person ${index + 1}`,
  active: index % 2 === 0,
}))
const initialParameters: SortParameter[] = [
  { ID: "name", name: "Name", sortDirection: "Ascending" },
  { ID: "active", name: "Active", sortDirection: "Descending" },
]

export const TableScene = () => {
  const editor = useRef<TextInput>(null)
  const [held, setHeld] = useState(false)
  const [empty, setEmpty] = useState(false)
  const [reversed, setReversed] = useState(false)
  const [sticky, setSticky] = useState(true)
  const [showDrag, setShowDrag] = useState(false)
  const [draft, setDraft] = useState("Original editor")
  const [selected, setSelected] = useState<"all" | Set<string | number>>(new Set())
  const [sorts, setSorts] = useState<TableSortInstruction[]>([])
  const [filters, setFilters] = useState<TableFilterGroup[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [widths, setWidths] = useState<Record<string, number>>({ name: 150, active: 100, draft: 190 })
  const [requests, setRequests] = useState<string[]>([])
  const [parameters, setParameters] = useState(initialParameters)
  const record = (kind: string, value: unknown) =>
    setRequests((previous) => [...previous, `${kind}:${JSON.stringify(value)}`])
  const columns: TableColumnMetadata<TPerson>[] = [
    {
      id: "name",
      name: "Name",
      isRowHeader: true,
      width: widths.name,
      sort: { enabled: true, criteriaID: "name" },
      filter: { enabled: true, criteriaID: "name", allowedOperationCodes: ["equal", "like", "not-equal"] },
    },
    { id: "active", name: "Active", width: widths.active },
    {
      id: "draft",
      name: "Original editor",
      width: widths.draft,
      cellRenderer: ({ row }) =>
        row.id === "person-0" ? (
          <Input ref={editor} accessibilityLabel="Original Table editor" value={draft} onChangeText={setDraft} />
        ) : (
          ""
        ),
    },
  ]
  return (
    <View style={{ gap: 10 }}>
      <Text elementType="h2">Table</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
        <Button onPress={() => setHeld((value) => !value)}>Toggle held Table owner</Button>
        <Button onPress={() => setEmpty((value) => !value)}>Toggle empty Table</Button>
        <Button onPress={() => setReversed((value) => !value)}>Reverse Table rows</Button>
        <Button onPress={() => setSticky((value) => !value)}>Toggle sticky Table header</Button>
        <Button onPress={() => setShowDrag((value) => !value)}>Toggle Table drag and drop</Button>
      </View>
      <Text>
        Owner holds requests: {String(held)}. Original editor value: {draft}
      </Text>
      <ScrollView horizontal style={{ maxHeight: 380 }}>
        <ScrollView style={{ width: 520, maxHeight: 360 }} nestedScrollEnabled>
          <Table
            accessibilityLabel="Public people Table"
            columns={columns}
            stickyHeader={sticky}
            zebra
            clickableRows
            selectionMode="multiple"
            selectedKeys={selected}
            onSelectionChange={(next) => {
              record("selection", next === "all" ? next : [...next])
              if (!held) setSelected(next)
            }}
            onRowAction={(key) => record("action", key)}
            columnResizing={{
              enabled: true,
              onColumnResize: (next) => {
                record("resize", next)
                if (!held) setWidths((previous) => ({ ...previous, [next.columnID]: next.width }))
              },
            }}
            queryControls={{
              sorting: {
                activeSorts: sorts,
                onSortChange: (next) => {
                  record("sort", next)
                  if (!held) setSorts(next)
                },
              },
              filtering: {
                mode: "popover",
                activeFilters: filters,
                onFiltersChange: (next) => {
                  record("filter", next)
                  if (!held) setFilters(next)
                },
              },
              pagination: {
                showIncrementButtonsWithOnePage: true,
                currentPage: page,
                itemsPerPage: pageSize,
                numberOfItems: 100,
                setCurrentPage: (next) => {
                  record("page", next)
                  if (!held) setPage(next)
                },
                setItemsPerPage: (next) => {
                  record("page-size", next)
                  if (!held) setPageSize(next)
                },
              },
            }}
          >
            <TableHeader columns={columns} />
            <TableBody
              items={empty ? [] : reversed ? [...people].reverse() : people}
              columns={columns}
              renderEmptyState={() => "No people"}
            />
          </Table>
        </ScrollView>
      </ScrollView>
      <Text testID="table-scene-owner">
        {JSON.stringify({
          selected: selected === "all" ? selected : [...selected],
          sorts,
          filters,
          page,
          pageSize,
          widths,
          requests,
        })}
      </Text>
      <Text elementType="h3">Standalone sort order</Text>
      <SortParameterList
        ariaLabel="Standalone public sort parameters"
        sortParameterList={parameters}
        onSortParameterListChange={(next) => {
          record("standalone-sort", next)
          if (!held) setParameters(next)
        }}
      />
      {showDrag && <TableDragScene />}
    </View>
  )
}
