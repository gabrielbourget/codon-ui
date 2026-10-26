import { useCallback, useContext, useLayoutEffect, useRef, useState, type Ref, type RefObject } from "react"
import { ScrollView, View, type TextInput } from "react-native"

import {
  Button,
  Input,
  NativeFloatingLayerHost,
  NativeFocusView,
  NativeOverlayProvider,
  NativeThemeProvider,
  Text,
} from "../../../.."
import { NativeTableStateContext } from "../../context"
import type { TTableSortInstruction } from "../../queryTypes"
import type { TTableFilterGroup } from "../../queryTypes"
import type { TNativeTableState } from "../../state/useTableState"
import { Table } from "../../Table"
import { TableBody } from "../../TableBody"
import { TableHeader } from "../../TableHeader"
import { TableRow } from "../../TableRow"
import type {
  TNativeTableColumnMetadata,
  TNativeTableHeaderProps,
  TNativeTableBodyProps,
  TNativeTableProps,
} from "../../types"

import { TableCellFixture } from "./TableCellFixture"

type TPerson = { id: string; name: string; active: boolean }
const people: TPerson[] = [
  { id: "a", name: "Alpha", active: false },
  { id: "b", name: "Beta", active: true },
]
const StateCapture = ({ target }: { target: RefObject<TNativeTableState<object> | null> }) => {
  const state = useContext(NativeTableStateContext)
  useLayoutEffect(() => {
    target.current = state
    return () => {
      if (target.current === state) target.current = null
    }
  }, [state, target])
  return null
}
const renderBody: NonNullable<TNativeTableBodyProps<TPerson>["render"]> = (props, state) => (
  <View {...props} style={[props.style, { opacity: state.isEmpty ? 0.85 : 1 }]} />
)
export const TableFixture = ({ editorRef, tableRef }: { editorRef?: Ref<TextInput>; tableRef?: Ref<View> }) => {
  const [customRoot, setCustomRoot] = useState(false)
  const [largeText, setLargeText] = useState(false)
  const renderRoot = useCallback<NonNullable<TNativeTableProps["render"]>>(
    (props, values) => <NativeFocusView {...props} style={[props.style, { opacity: values.isFocused ? 1 : 0.98 }]} />,
    [],
  )
  const tableState = useRef<TNativeTableState<object> | null>(null)
  const [stateSummary, setStateSummary] = useState("No state snapshot")
  const [expanded, setExpanded] = useState<Set<string | number>>(new Set())
  const [expansionRequests, setExpansionRequests] = useState<(string | number)[][]>([])
  const renderHeader = useCallback<NonNullable<TNativeTableHeaderProps<TPerson>["render"]>>(
    (props, state) => (
      <View {...props} style={[props.style, { opacity: state.isHovered ? 0.85 : 1 }]}>
        <StateCapture target={tableState} />
        {props.children}
      </View>
    ),
    [],
  )
  const inspectState = () => {
    const state = tableState.current
    if (state)
      setStateSummary(
        JSON.stringify({
          columns: state.collection.columns.map((node) => node.key),
          rows: state.collection.rows.map((node) => node.key),
          selected: [...state.selectionManager.selectedKeys],
          expanded: [...state.expandedKeys],
          navigationDisabled: state.isKeyboardNavigationDisabled,
          first: state.collection.getFirstKey(),
          treeColumn: state.treeColumn,
        }),
      )
  }
  const [headerHovered, setHeaderHovered] = useState(false)
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
              <Button onPress={() => setCustomRoot((value) => !value)}>Toggle root renderer</Button>
              <Button onPress={() => setLargeText((value) => !value)}>Toggle table typography</Button>
              <Button onPress={() => setReversed((value) => !value)}>Reverse rows</Button>
              <Button onPress={() => setLoading((value) => !value)}>Toggle loading</Button>
              <Button onPress={() => setEmpty((value) => !value)}>Toggle empty</Button>
              <Button onPress={() => setDark((value) => !value)}>Toggle theme</Button>
              <Button onPress={() => setHoldSelection((value) => !value)}>Toggle selection veto</Button>
              <Button onPress={() => setHoldQuery((value) => !value)}>Toggle query veto</Button>
              <Button onPress={() => tableState.current?.selectionManager.selectAll()}>Programmatic select all</Button>
              <Button onPress={() => tableState.current?.selectionManager.clearSelection()}>
                Programmatic clear selection
              </Button>
              <Button onPress={() => tableState.current?.toggleKey("a")}>Toggle Alpha expansion</Button>
              <Button
                onPress={() => {
                  const state = tableState.current
                  state?.setKeyboardNavigationDisabled(!state.isKeyboardNavigationDisabled)
                }}
              >
                Toggle table navigation
              </Button>
              <Button onPress={() => tableState.current?.sort("name", "descending")}>Programmatic Person sort</Button>
              <Button onPress={inspectState}>Inspect Table state</Button>
            </View>
            <Table
              ref={tableRef}
              render={customRoot ? renderRoot : undefined}
              customStyles={largeText ? { fontSize: 20 } : undefined}
              accessibilityLabel="People"
              hoverColor={dark ? "#444444" : "#ddeeff"}
              zebra
              zebraColor={dark ? "#333333" : "#eeeeee"}
              selectionMode="multiple"
              selectedKeys={selected}
              expandedKeys={expanded}
              treeColumn="name"
              onExpandedChange={(next) => {
                setExpansionRequests((previous) => [...previous, [...next]])
                if (!holdQuery) setExpanded(next)
              }}
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
              <TableHeader
                testID="table-header"
                columns={columns}
                onHoverChange={setHeaderHovered}
                render={renderHeader}
              />
              <TableBody
                testID="table-body"
                render={renderBody}
                items={empty ? [] : reversed ? [...people].reverse() : people}
                columns={columns}
                renderEmptyState={() => "No people"}
                isLoading={loading}
                renderLoadingState={() => (
                  <TableRow id="loading" item={{ id: "loading", name: "Loading", active: false }} columns={columns} />
                )}
              />
            </Table>
            <Text testID="table-state-proof">{stateSummary}</Text>
            <Text testID="table-expansion-requests">{JSON.stringify(expansionRequests)}</Text>
            <Text testID="table-requests">{JSON.stringify(requests)}</Text>
            <Text testID="table-header-hover">{String(headerHovered)}</Text>
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
            <TableCellFixture />
          </ScrollView>
        </NativeFloatingLayerHost>
      </NativeOverlayProvider>
    </NativeThemeProvider>
  )
}
