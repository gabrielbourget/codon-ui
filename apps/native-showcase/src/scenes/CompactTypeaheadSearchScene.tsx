import { useState } from "react"
import { View } from "react-native"

import { CompactTypeaheadSearch, Text, type TNativeCompactTypeaheadKey } from "@codon-ui/react-native"

const ITEMS = [
  { id: 0, name: "Alpha numeric" },
  { id: "0", name: "Alpha string" },
  { id: "beta", name: "Beta current" },
]
const describeKey = (key: TNativeCompactTypeaheadKey | null) => `${typeof key}:${JSON.stringify(key)}`

export const CompactTypeaheadSearchScene = () => {
  const [query, setQuery] = useState("")
  const [selection, setSelection] = useState<TNativeCompactTypeaheadKey | null>(null)
  const [open, setOpen] = useState(false)
  const [events, setEvents] = useState<string[]>([])
  const record = (event: string) => setEvents((current) => [...current.slice(-7), event])

  return (
    <View style={{ gap: 10 }}>
      <Text elementType="h2">Compact typeahead search</Text>
      <Text>Search Alpha or Beta and choose a result. Numeric and string zero are distinct item keys.</Text>
      <Text testID="compact-search-state">
        Query: {JSON.stringify(query)}. Selection: {describeKey(selection)}. Open: {String(open)}.
      </Text>
      <Text testID="compact-search-events">Callbacks: {events.length ? events.join(" | ") : "none"}</Text>
      <CompactTypeaheadSearch
        accessibilityLabel="Compact showcase search"
        items={ITEMS.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase()))}
        getItemKey={(item) => item.id}
        getItemTextValue={(item) => item.name}
        inputValue={query}
        value={selection}
        isOpen={open}
        minimumInputLength={0}
        onInputChange={(value) => {
          record(`query:${JSON.stringify(value)}`)
          setQuery(value)
        }}
        onChange={(value) => {
          record(`selection:${describeKey(value)}`)
          setSelection(value)
        }}
        onOpenChange={(value) => {
          record(`open:${String(value)}`)
          setOpen(value)
        }}
      />
    </View>
  )
}
