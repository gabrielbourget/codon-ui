import { useState, type Ref } from "react"
import { ScrollView, View } from "react-native"

import { Button, NativeFloatingLayerHost, NativeThemeProvider, Text } from "../../../.."
import { CompactTypeaheadSearch } from "../../CompactTypeaheadSearch"
import type { TNativeCompactTypeaheadKey } from "../../types"

const ITEMS = [
  { id: 0, name: "Alpha numeric" },
  { id: "0", name: "Alpha string" },
  { id: "", name: "Alpha empty" },
]
const describe = (key: TNativeCompactTypeaheadKey | null) => `${typeof key}:${JSON.stringify(key)}`
export const CompactTypeaheadFixture = ({ hostRef }: { hostRef?: Ref<View> }) => {
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<TNativeCompactTypeaheadKey | null>(null)
  const [open, setOpen] = useState(false)
  const [holdQuery, setHoldQuery] = useState(false)
  const [holdValue, setHoldValue] = useState(false)
  const [loading, setLoading] = useState(false)
  const [minimum, setMinimum] = useState(2)
  const [custom, setCustom] = useState(false)
  const [dark, setDark] = useState(false)
  const [rtl, setRTL] = useState(false)
  const [events, setEvents] = useState<string[]>([])
  const record = (message: string) => setEvents((current) => [...current.slice(-11), message])
  const results = query.trim().length >= minimum ? ITEMS : []
  return (
    <NativeThemeProvider mode={dark ? "dark" : "light"}>
      <NativeFloatingLayerHost ref={hostRef} testID="host">
        <ScrollView contentContainerStyle={{ padding: 15, gap: 10 }}>
          <Text elementType="h1">Private CompactTypeaheadSearch fixture</Text>
          <Text>Type Alpha to inspect parent-curated typed keys, owner vetoes, status panels and native focus.</Text>
          <Text testID="compact-fixture-state">
            Query {JSON.stringify(query)}. Value {describe(selected)}. Open {String(open)}. Minimum {minimum}. Loading{" "}
            {String(loading)}.
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
            <Button onPress={() => setHoldQuery((current) => !current)}>Toggle query veto</Button>
            <Button onPress={() => setHoldValue((current) => !current)}>Toggle selection veto</Button>
            <Button onPress={() => setLoading((current) => !current)}>Toggle loading</Button>
            <Button onPress={() => setMinimum((current) => (current === 0 ? 2 : 0))}>Toggle zero minimum</Button>
            <Button onPress={() => setCustom((current) => !current)}>Toggle custom slots</Button>
            <Button onPress={() => setDark((current) => !current)}>Toggle theme</Button>
            <Button onPress={() => setRTL((current) => !current)}>Toggle RTL</Button>
            <Button
              onPress={() => {
                setQuery("")
                setSelected(null)
                setOpen(false)
              }}
            >
              Reset search
            </Button>
          </View>
          <CompactTypeaheadSearch
            accessibilityLabel="Compact search"
            items={results}
            inputValue={query}
            value={selected}
            isOpen={open}
            minimumInputLength={minimum}
            isLoading={loading}
            rtl={rtl}
            getItemKey={(item) => item.id}
            onInputChange={(text) => {
              record(`query:${JSON.stringify(text)}`)
              if (!holdQuery) setQuery(text)
            }}
            onChange={(key) => {
              record(`select:${describe(key)}`)
              if (!holdValue) {
                setSelected(key)
                setQuery("")
              }
            }}
            onOpenChange={(next) => {
              record(`open:${next}`)
              setOpen(next)
            }}
            labels={
              custom
                ? {
                    inputButtonGroupAriaLabel: "Localized controls",
                    searchButtonAriaLabel: "Run search",
                    suggestionsListAriaLabel: "Curated results",
                    status: {
                      minimumInputLengthMessage: ({ minimumInputLength }) => `Need ${minimumInputLength}`,
                      loadingMessage: "Searching parent results",
                    },
                  }
                : undefined
            }
            customStyles={custom ? { marginTop: 3 } : undefined}
            customInputButtonGroupStyles={custom ? { borderWidth: 2 } : undefined}
            customInputStyles={custom ? { color: "#a66b00" } : undefined}
            customButtonStyles={custom ? { borderRadius: 0 } : undefined}
            customOptionsListStyles={custom ? { padding: 7 } : undefined}
            renderItem={(item, args) => (
              <Text
                testID={`compact-result-${typeof item.id}-${item.id}`}
              >{`${item.name} | ${args.query} | ${describe(args.itemKey)}`}</Text>
            )}
          />
          <Text testID="compact-fixture-events">{events.join("\n") || "No requests"}</Text>
        </ScrollView>
      </NativeFloatingLayerHost>
    </NativeThemeProvider>
  )
}
