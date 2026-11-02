import { useCallback, useEffect, useRef, useState } from "react"
import { View, type TextInput } from "react-native"

import { Button, ComboBox, Text, useNativeTheme, type TNativeComboBoxKey } from "@codon-ui/react-native"

type TItem = { key: TNativeComboBoxKey; text: string }
const ITEMS: readonly TItem[] = [
  { key: 0, text: "Numeric zero" },
  { key: "0", text: "String zero" },
  { key: "", text: "Empty key" },
  { key: "blocked", text: "Disabled choice" },
]
const RETURNED_ITEMS = [ITEMS[1]!, ITEMS[2]!, ITEMS[0]!, ITEMS[3]!].map((item) => ({
  ...item,
  text: `Returned ${item.text.toLowerCase()}`,
}))
const formatKey = (key: TNativeComboBoxKey | null) => `${typeof key}:${JSON.stringify(key)}`

export const ComboBoxScene = () => {
  const theme = useNativeTheme()
  const [query, setQuery] = useState("")
  const [selection, setSelection] = useState<TNativeComboBoxKey | null>(0)
  const [open, setOpen] = useState(false)
  const [queryVeto, setQueryVeto] = useState(false)
  const [selectionVeto, setSelectionVeto] = useState(false)
  const [openVeto, setOpenVeto] = useState(false)
  const [disabled, setDisabled] = useState(false)
  const [readOnly, setReadOnly] = useState(false)
  const [items, setItems] = useState(ITEMS)
  const [pending, setPending] = useState(false)
  const [requests, setRequests] = useState<{
    query: string[]
    selection: (TNativeComboBoxKey | null)[]
    open: boolean[]
  }>({ query: [], selection: [], open: [] })
  const [native, setNative] = useState<{
    changes: number
    text?: string
    eventCount?: number
    selection?: { start: number; end: number }
    submit?: string
    end?: string
  }>({ changes: 0 })
  const root = useRef<View | null>(null)
  const editor = useRef<TextInput | null>(null)
  const [refs, setRefs] = useState({ rootAttached: false, editorAttached: false, rootMounts: 0, editorMounts: 0 })
  const bindRoot = useCallback((node: View | null) => {
    if (root.current === node) return
    root.current = node
    setRefs((current) => ({ ...current, rootAttached: node !== null, rootMounts: current.rootMounts + (node ? 1 : 0) }))
  }, [])
  const bindEditor = useCallback((node: TextInput | null) => {
    if (editor.current === node) return
    editor.current = node
    setRefs((current) => ({
      ...current,
      editorAttached: node !== null,
      editorMounts: current.editorMounts + (node ? 1 : 0),
    }))
  }, [])
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const replaceItems = () => {
    clearTimeout(timer.current)
    setPending(true)
    timer.current = setTimeout(() => {
      timer.current = undefined
      setItems(RETURNED_ITEMS)
      setPending(false)
    }, 125)
  }
  const reset = () => {
    clearTimeout(timer.current)
    timer.current = undefined
    setItems(ITEMS)
    setPending(false)
    setQuery("")
    setSelection(0)
    setOpen(false)
    setQueryVeto(false)
    setSelectionVeto(false)
    setOpenVeto(false)
    setDisabled(false)
    setReadOnly(false)
    setRequests({ query: [], selection: [], open: [] })
    setNative({ changes: 0 })
  }
  return (
    <View style={{ gap: 10 }}>
      <Text elementType="h2" variant="h3">
        Public ComboBox
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Button onPress={() => setQueryVeto((value) => !value)}>Toggle ComboBox query veto</Button>
        <Button onPress={() => setSelectionVeto((value) => !value)}>Toggle ComboBox selection veto</Button>
        <Button onPress={() => setOpenVeto((value) => !value)}>Toggle ComboBox open veto</Button>
        <Button onPress={() => setDisabled((value) => !value)}>Toggle ComboBox disabled</Button>
        <Button onPress={() => setReadOnly((value) => !value)}>Toggle ComboBox read-only</Button>
        <Button onPress={() => setOpen(true)}>Open ComboBox from owner</Button>
        <Button onPress={replaceItems} isDisabled={pending}>
          Replace ComboBox items after 125 ms
        </Button>
        <Button onPress={reset}>Reset ComboBox scene</Button>
      </View>
      <ComboBox
        ref={bindRoot}
        inputRef={bindEditor}
        testID="public-combo-example"
        accessibilityLabel="Choose typed item"
        inputLabel="Public ComboBox query"
        closeLabel="Close public ComboBox"
        items={items}
        getKey={(item) => item.key}
        getTextValue={(item) => item.text}
        disabledKeys={["blocked"]}
        value={selection}
        inputValue={query}
        isOpen={open}
        isDisabled={disabled}
        isReadOnly={readOnly}
        onInputChange={(next) => {
          setRequests((current) => ({ ...current, query: [...current.query, next] }))
          if (!queryVeto) setQuery(next)
        }}
        onChange={(next) => {
          setRequests((current) => ({ ...current, selection: [...current.selection, next] }))
          if (!selectionVeto) setSelection(next)
        }}
        onOpenChange={(next) => {
          setRequests((current) => ({ ...current, open: [...current.open, next] }))
          if (!openVeto) setOpen(next)
        }}
        inputProps={{
          returnKeyType: "search",
          onChange: ({ nativeEvent }) =>
            setNative((current) => ({
              ...current,
              changes: current.changes + 1,
              text: nativeEvent.text,
              eventCount: nativeEvent.eventCount,
            })),
          onSelectionChange: ({ nativeEvent }) =>
            setNative((current) => ({ ...current, selection: nativeEvent.selection })),
          onSubmitEditing: ({ nativeEvent }) => setNative((current) => ({ ...current, submit: nativeEvent.text })),
          onEndEditing: ({ nativeEvent }) => setNative((current) => ({ ...current, end: nativeEvent.text })),
        }}
        customStyles={{ width: "100%", borderColor: theme.colors.controlBorder }}
      />
      <Text testID="public-combo-state">
        Query: {JSON.stringify(query)}. Selection: {formatKey(selection)}. Open: {String(open)}. Query veto:{" "}
        {String(queryVeto)}. Selection veto: {String(selectionVeto)}. Open veto: {String(openVeto)}. Disabled:{" "}
        {String(disabled)}. Read-only: {String(readOnly)}. Pending: {String(pending)}. Theme: {theme.mode}.
      </Text>
      <Text testID="public-combo-requests">
        Query requests: {JSON.stringify(requests.query)}. Selection requests: {JSON.stringify(requests.selection)}. Open
        requests: {JSON.stringify(requests.open)}.
      </Text>
      <Text testID="public-combo-native">
        Changes: {native.changes}. Text: {JSON.stringify(native.text) ?? "none"}. Event count:{" "}
        {native.eventCount ?? "none"}. Selection:{" "}
        {native.selection ? `${native.selection.start}:${native.selection.end}` : "none"}. Submit:{" "}
        {JSON.stringify(native.submit) ?? "none"}. End: {JSON.stringify(native.end) ?? "none"}.
      </Text>
      <Text testID="public-combo-refs">
        Root attached: {String(refs.rootAttached)}. Editor attached: {String(refs.editorAttached)}. Root mounts:{" "}
        {refs.rootMounts}. Editor mounts: {refs.editorMounts}.
      </Text>
      <Text>
        Configure owners before opening the modal. Native observations never replace the owner query. Installed input,
        keyboard, focus and accessibility qualification remain separate checks.
      </Text>
    </View>
  )
}
