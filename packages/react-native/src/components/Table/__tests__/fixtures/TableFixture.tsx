import { useState, type Ref } from "react"
import { ScrollView, View, type TextInput } from "react-native"

import { Button, Input, NativeFloatingLayerHost, NativeThemeProvider, Text } from "../../../.."
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
  const columns: TNativeTableColumnMetadata<TPerson>[] = [
    { id: "name", name: "Person", isRowHeader: true, width: 110 },
    { id: "active", name: "Active", width: 70 },
    {
      id: "draft",
      name: "Held draft",
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
      <NativeFloatingLayerHost>
        <ScrollView contentContainerStyle={{ padding: 15, gap: 10 }}>
          <Text elementType="h1">Private Table construction</Text>
          <Text>Inspect cells, loading, empty content and the held editor through row reorder and theme changes.</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
            <Button onPress={() => setReversed((value) => !value)}>Reverse rows</Button>
            <Button onPress={() => setLoading((value) => !value)}>Toggle loading</Button>
            <Button onPress={() => setEmpty((value) => !value)}>Toggle empty</Button>
            <Button onPress={() => setDark((value) => !value)}>Toggle theme</Button>
            <Button onPress={() => setHoldSelection((value) => !value)}>Toggle selection veto</Button>
          </View>
          <Table
            accessibilityLabel="People"
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
        </ScrollView>
      </NativeFloatingLayerHost>
    </NativeThemeProvider>
  )
}
