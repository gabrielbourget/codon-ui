import { useRef, useState } from "react"
import { findNodeHandle, TextInput, View } from "react-native"

import { Button, Text, useNativeTheme } from "@codon-ui/react-native"

import { TagComboBox } from "../../../../packages/react-native/src/components/TagComboBox/TagComboBox"
import type { TNativeTagComboBoxChangeDetails } from "../../../../packages/react-native/src/components/TagComboBox/types"

type TItem = { id: string | number; label: string }
const ITEMS: TItem[] = [
  { id: 0, label: "Number zero" },
  { id: "0", label: "String zero" },
  { id: "", label: "Empty key" },
  { id: "last", label: "Dernière étiquette" },
]
const keyLabel = (key: TItem["id"]) => `${typeof key}:${JSON.stringify(key)}`
const itemLabels = (items: readonly TItem[]) => items.map((item) => keyLabel(item.id)).join(", ") || "empty"

// Exercises the private composition; incomplete inherited contracts remain in the family ledger.
export const TagComboBoxScene = () => {
  const theme = useNativeTheme()
  const [items, setItems] = useState(ITEMS)
  const [selected, setSelected] = useState<TItem[]>([])
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [vetoSelection, setVetoSelection] = useState(false)
  const [vetoInput, setVetoInput] = useState(false)
  const [vetoOpen, setVetoOpen] = useState(false)
  const [disabled, setDisabled] = useState(false)
  const [readOnly, setReadOnly] = useState(false)
  const [custom, setCustom] = useState(false)
  const [large, setLarge] = useState(false)
  const [requests, setRequests] = useState<string[]>([])
  const [draft, setDraft] = useState("")
  const [textEvents, setTextEvents] = useState(0)
  const [refs, setRefs] = useState("unmeasured")
  const root = useRef<View>(null)
  const input = useRef<TextInput>(null)
  const editor = useRef<TextInput>(null)
  const firstRefs = useRef(new Map<string, View | TextInput>())
  const scenario = useRef<{ selections: number; closes: number } | null>(null)
  const record = (request: string) => setRequests((current) => [...current.slice(-11), request])
  const requestSelection = (next: TItem[], details: TNativeTagComboBoxChangeDetails<TItem>) => {
    if (scenario.current && details.action === "add") scenario.current.selections++
    record(`${details.action}:${itemLabels(details.changedItems)}`)
    if (scenario.current ? scenario.current.selections > 2 : !vetoSelection) setSelected(next)
  }
  const inspectRefs = () => {
    const targets = [
      ["root", root.current],
      ["input", input.current],
      ["editor", editor.current],
    ] as const
    setRefs(
      targets
        .map(([name, target]) => {
          if (target && !firstRefs.current.has(name)) firstRefs.current.set(name, target)
          const identity = target ? (target === firstRefs.current.get(name) ? "same" : "replaced") : "absent"
          return `${name}=${findNodeHandle(target) ?? "unresolved"}/${identity}`
        })
        .join("; "),
    )
  }
  return (
    <View style={{ gap: 12 }}>
      <Text elementType="h2" variant="h3">
        TagComboBox
      </Text>
      <Text testID="tag-combo-owner-state">
        Selected: {itemLabels(selected)}. Query: {JSON.stringify(query)}. Open: {String(open)}. Selection:{" "}
        {scenario.current ? "veto two, echo third" : vetoSelection ? "veto" : "echo"}. Input:{" "}
        {scenario.current ? "held until third selection" : vetoInput ? "veto" : "echo"}. Popup:{" "}
        {scenario.current ? "veto two close requests" : vetoOpen ? "veto" : "echo"}.
      </Text>
      <Text testID="tag-combo-owner-requests">Requests: {requests.join(" → ") || "none"}.</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Button
          onPress={() => {
            scenario.current = { selections: 0, closes: 0 }
            setSelected([])
            setQuery("held query")
            setVetoSelection(false)
            setVetoInput(false)
            setVetoOpen(false)
            setOpen(true)
          }}
        >
          Run two-veto tag-combo selection
        </Button>
        <Button onPress={() => setVetoSelection((value) => !value)}>Toggle tag-combo selection veto</Button>
        <Button onPress={() => setVetoInput((value) => !value)}>Toggle tag-combo input veto</Button>
        <Button onPress={() => setVetoOpen((value) => !value)}>Toggle tag-combo popup veto</Button>
        <Button onPress={() => setOpen((value) => !value)}>Toggle tag-combo owner open</Button>
        <Button onPress={() => setDisabled((value) => !value)}>Toggle tag-combo disabled</Button>
        <Button onPress={() => setReadOnly((value) => !value)}>Toggle tag-combo read only</Button>
        <Button onPress={() => setCustom((value) => !value)}>Toggle tag-combo styles</Button>
        <Button onPress={() => setLarge((value) => !value)}>Toggle tag-combo text size</Button>
        <Button onPress={() => setSelected([ITEMS[0]])}>Set tag-combo number zero</Button>
        <Button onPress={() => setSelected([ITEMS[1]])}>Set tag-combo string zero</Button>
        <Button onPress={() => setSelected([])}>Clear tag-combo selection</Button>
        <Button onPress={() => setQuery("held query")}>Set tag-combo owner query</Button>
        <Button onPress={() => setItems((current) => [...current].reverse())}>Reverse tag-combo items</Button>
        <Button onPress={() => setItems([])}>Clear tag-combo items</Button>
        <Button onPress={() => setItems(ITEMS)}>Restore tag-combo items</Button>
        <Button onPress={inspectRefs}>Inspect tag-combo refs</Button>
      </View>
      <TextInput
        ref={editor}
        testID="tag-combo-owner-editor"
        accessibilityLabel="Draft before tag combo box"
        value={draft}
        onChangeText={(value) => {
          setDraft(value)
          setTextEvents((count) => count + 1)
        }}
        style={{ color: theme.colors.foreground, borderWidth: 1, borderColor: theme.colors.controlBorder, padding: 8 }}
      />
      <TagComboBox
        ref={root}
        inputRef={input}
        inputProps={{ onFocus: inspectRefs }}
        items={items}
        selectedItems={selected}
        getItemKey={(item) => item.id}
        getItemTextValue={(item) => item.label}
        onSelectedItemsChange={requestSelection}
        inputValue={query}
        onInputChange={(value) => {
          record(`input:${JSON.stringify(value)}`)
          if (scenario.current ? scenario.current.selections > 2 : !vetoInput) setQuery(value)
        }}
        isOpen={open}
        onOpenChange={(value) => {
          record(`open:${String(value)}`)
          if (scenario.current && !value) {
            if (++scenario.current.closes > 2) {
              setOpen(false)
              scenario.current = null
            }
          } else if (!vetoOpen) setOpen(value)
        }}
        isDisabled={disabled}
        isReadOnly={readOnly}
        accessibilityLabel="Owner-controlled tag choices"
        textSize={large ? "large" : "medium"}
        maxWidth="100%"
        customStyles={custom ? { borderWidth: 2, borderColor: theme.colors.focusRing, padding: 8 } : undefined}
        customTagStyles={custom ? { padding: 12 } : undefined}
        customComboBoxStyles={custom ? { backgroundColor: theme.colors.background } : undefined}
        customComboBoxProps={{ onInputChange: (value) => record(`nested-input:${JSON.stringify(value)}`) }}
      />
      <Button onPress={() => editor.current?.focus()}>Focus original tag-combo draft editor</Button>
      <TextInput
        accessibilityLabel="Draft after tag combo box"
        style={{ color: theme.colors.foreground, borderWidth: 1, borderColor: theme.colors.controlBorder, padding: 8 }}
      />
      <Text testID="tag-combo-owner-editor-state">
        Text events: {textEvents}. Refs: {refs}.
      </Text>
    </View>
  )
}
