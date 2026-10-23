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
  const columns: TNativeTableColumnMetadata<TPerson>[] = [
    { id: "name", name: "Person", width: 110 },
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
          </View>
          <Table accessibilityLabel="People" zebra zebraColor={dark ? "#333333" : "#eeeeee"}>
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
        </ScrollView>
      </NativeFloatingLayerHost>
    </NativeThemeProvider>
  )
}
