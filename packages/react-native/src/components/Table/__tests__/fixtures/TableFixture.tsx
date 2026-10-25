import { useState, type Ref } from "react"
import { ScrollView, View, type TextInput } from "react-native"

import { Button, Input, NativeFloatingLayerHost, NativeOverlayProvider, NativeThemeProvider, Text } from "../../../.."
import type { TTableSortInstruction } from "../../queryTypes"
import type { TTableFilterGroup } from "../../queryTypes"
import { Table } from "../../Table"
import { TableBody } from "../../TableBody"
import { TableHeader } from "../../TableHeader"
import { TableRow } from "../../TableRow"
import type { TNativeTableColumnMetadata } from "../../types"

type TPerson = { id: string; name: string; active: boolean }
const people: TPerson[] = [
  { id: "a", name: "Alpha", active: false },
  { id: "b", name: "Beta", active: true },
]
export const TableFixture = ({ editorRef }: { editorRef?: Ref<TextInput> }) => {
  const [reversed, setReversed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [empty, setEmpty] = useState(false)
  const [dark, setDark] = useState(false)
  const [requests, setRequests] = useState<string[]>([])
  const [selected, setSelected] = useState<"all" | Set<string | number>>(new Set())
  const [holdSelection, setHoldSelection] = useState(false)
  const [selectionRequests, setSelectionRequests] = useState<string[]>([])
  const [actions, setActions] = useState<(string | number)[]>([])
  const [sorts, setSorts] = useState<TTableSortInstruction[]>([])
  const [sortRequests, setSortRequests] = useState<TTableSortInstruction[][]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [pageRequests, setPageRequests] = useState<number[]>([])
  const [holdQuery, setHoldQuery] = useState(false)
  const [filters, setFilters] = useState<TTableFilterGroup[]>([])
  const [filterRequests, setFilterRequests] = useState<TTableFilterGroup[][]>([])
  const [widths, setWidths] = useState<Record<string, number>>({ name: 110, active: 70 })
  const [resizeRequests, setResizeRequests] = useState<{ columnID: string; width: number }[]>([])
  const columns: TNativeTableColumnMetadata<TPerson>[] = [
    {
      id: "name",
      name: "Person",
      isRowHeader: true,
      width: widths.name,
      sort: { enabled: true, criteriaID: "person" },
      filter: { enabled: true, criteriaID: "person", allowedOperationCodes: ["equal", "like", "not-equal"] },
    },
    { id: "active", name: "Active", width: widths.active },
    {
      id: "draft",
      name: "Held draft",
      width: widths.draft,
      cellRenderer: ({ row }) =>
        row.id === "a" ? (
          <Input
            ref={editorRef}
            accessibilityLabel="Held table draft"
            testID="table-editor"
            value="held"
            onChangeText={(value) => setRequests((previous) => [...previous, value])}
          />
        ) : (
          "No draft"
        ),
    },
  ]
  return (
    <NativeThemeProvider mode={dark ? "dark" : "light"}>
      <NativeOverlayProvider>
        <NativeFloatingLayerHost>
          <ScrollView contentContainerStyle={{ padding: 15, gap: 10 }}>
            <Text elementType="h1">Private Table construction</Text>
            <Text>
              Inspect cells, loading, empty content and the held editor through row reorder and theme changes.
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
              <Button onPress={() => setReversed((value) => !value)}>Reverse rows</Button>
              <Button onPress={() => setLoading((value) => !value)}>Toggle loading</Button>
              <Button onPress={() => setEmpty((value) => !value)}>Toggle empty</Button>
              <Button onPress={() => setDark((value) => !value)}>Toggle theme</Button>
              <Button onPress={() => setHoldSelection((value) => !value)}>Toggle selection veto</Button>
              <Button onPress={() => setHoldQuery((value) => !value)}>Toggle query veto</Button>
            </View>
            <Table
              accessibilityLabel="People"
              hoverColor={dark ? "#444444" : "#ddeeff"}
              zebra
              zebraColor={dark ? "#333333" : "#eeeeee"}
              selectionMode="multiple"
              selectedKeys={selected}
              clickableRows
              onSelectionChange={(next) => {
                setSelectionRequests((previous) => [...previous, next === "all" ? "all" : JSON.stringify([...next])])
                if (!holdSelection) setSelected(next)
              }}
              onRowAction={(key) => setActions((previous) => [...previous, key])}
              columns={columns}
              columnResizing={{
                enabled: true,
                onColumnResize: (next) => {
                  setResizeRequests((previous) => [...previous, next])
                  if (!holdQuery) setWidths((previous) => ({ ...previous, [next.columnID]: next.width }))
                },
              }}
              queryControls={{
                sorting: {
                  activeSorts: sorts,
                  onSortChange: (next) => {
                    setSortRequests((previous) => [...previous, next])
                    if (!holdQuery) setSorts(next)
                  },
                },
                filtering: {
                  mode: "popover",
                  activeFilters: filters,
                  onFiltersChange: (next) => {
                    setFilterRequests((previous) => [...previous, next])
                    if (!holdQuery) setFilters(next)
                  },
                },
                pagination: {
                  showIncrementButtonsWithOnePage: true,
                  currentPage: page,
                  itemsPerPage: pageSize,
                  numberOfItems: 100,
                  setCurrentPage: (next) => {
                    setPageRequests((previous) => [...previous, next])
                    if (!holdQuery) setPage(next)
                  },
                  setItemsPerPage: (next) => {
                    if (!holdQuery) setPageSize(next)
                  },
                },
              }}
            >
              <TableHeader columns={columns} />
              <TableBody
                items={empty ? [] : reversed ? [...people].reverse() : people}
                columns={columns}
                renderEmptyState={() => "No people"}
                isLoading={loading}
                renderLoadingState={() => (
                  <TableRow id="loading" item={{ id: "loading", name: "Loading", active: false }} columns={columns} />
                )}
              />
            </Table>
            <Text testID="table-requests">{JSON.stringify(requests)}</Text>
            <Text testID="table-selection">{selected === "all" ? "all" : JSON.stringify([...selected])}</Text>
            <Text testID="table-selection-requests">{JSON.stringify(selectionRequests)}</Text>
            <Text testID="table-actions">{JSON.stringify(actions)}</Text>
            <Text testID="table-sorts">{JSON.stringify(sorts)}</Text>
            <Text testID="table-sort-requests">{JSON.stringify(sortRequests)}</Text>
            <Text testID="table-page">{page}</Text>
            <Text testID="table-page-requests">{JSON.stringify(pageRequests)}</Text>
            <Text testID="table-filters">{JSON.stringify(filters)}</Text>
            <Text testID="table-filter-requests">{JSON.stringify(filterRequests)}</Text>
            <Text testID="table-widths">{JSON.stringify(widths)}</Text>
            <Text testID="table-resize-requests">{JSON.stringify(resizeRequests)}</Text>
          </ScrollView>
        </NativeFloatingLayerHost>
      </NativeOverlayProvider>
    </NativeThemeProvider>
  )
}
