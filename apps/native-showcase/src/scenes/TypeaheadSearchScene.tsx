import { useMemo, useRef, useState } from "react"
import { StyleSheet, View, type TextInput } from "react-native"

import {
  AVAILABLE_CORNER_GEOMETRY_CODES,
  AVAILABLE_TYPEAHEAD_SEARCH_STATUSES,
  Button,
  Text,
  TypeaheadSearch,
  useNativeTheme,
  type PartialTypeaheadSearchLabels,
  type TNativeTypeaheadSearchKey,
  type TNativeTypeaheadSearchRenderItemArgs,
} from "@codon-ui/react-native"

type TItem = { id: TNativeTypeaheadSearchKey; name: string }
const ITEMS: readonly TItem[] = [
  { id: 0, name: "Alpha wave" },
  { id: "0", name: "Beta drift" },
  { id: "", name: "Empty-key current" },
]
const MANY: readonly TItem[] = Array.from({ length: 200 }, (_, index) => ({
  id: index,
  name:
    index % 3 === 0
      ? `Result ${index} / résultat ${index}: a long caller-owned description for variable-height native rows and complete text reachability.`
      : `Result ${index} / résultat ${index}`,
}))
const getKey = (item: TItem) => item.id
const getText = (item: TItem) => item.name
const renderItem = (item: TItem, args: TNativeTypeaheadSearchRenderItemArgs) => (
  <Text>
    {item.name} | query {JSON.stringify(args.query)}
  </Text>
)
const FRENCH: PartialTypeaheadSearchLabels = {
  searchButtonAriaLabel: "Rechercher",
  resultsListAriaLabel: "Résultats de recherche",
  status: {
    idleMessage: "Saisissez votre recherche",
    minimumInputLengthMessage: ({ minimumInputLength }) => `Au moins ${minimumInputLength} caractères`,
    loadingMessage: "Recherche en cours",
    emptyListMessage: "Aucun résultat",
    errorMessage: "La recherche a échoué",
  },
}
const AFFORDANCES = ["default", "custom", "falsy", "bigint"] as const
const THRESHOLDS = [0, 2, 100] as const
const formatKey = (key: TNativeTypeaheadSearchKey | null | undefined) =>
  key === undefined ? "none" : key === null ? "null" : `${typeof key}:${JSON.stringify(key)}`

export const TypeaheadSearchScene = () => {
  const [query, setQuery] = useState("")
  const [request, setRequest] = useState<string>()
  const [requests, setRequests] = useState(0)
  const [nativeText, setNativeText] = useState<string>()
  const [nativeSubmit, setNativeSubmit] = useState<string>()
  const [submitted, setSubmitted] = useState<string>()
  const [submits, setSubmits] = useState(0)
  const [selection, setSelection] = useState<TNativeTypeaheadSearchKey | null>()
  const [selections, setSelections] = useState(0)
  const [focusEvents, setFocusEvents] = useState(0)
  const [veto, setVeto] = useState(false)
  const [statusIndex, setStatusIndex] = useState(5)
  const [thresholdIndex, setThresholdIndex] = useState(0)
  const [geometryIndex, setGeometryIndex] = useState(1)
  const [affordanceIndex, setAffordanceIndex] = useState(0)
  const [disabled, setDisabled] = useState(false)
  const [custom, setCustom] = useState(false)
  const [customRows, setCustomRows] = useState(false)
  const [localized, setLocalized] = useState(false)
  const [empty, setEmpty] = useState(false)
  const [removed, setRemoved] = useState(false)
  const [reversed, setReversed] = useState(false)
  const [many, setMany] = useState(false)
  const [filter, setFilter] = useState(false)
  const [wrap, setWrap] = useState(true)
  const [zero, setZero] = useState(false)
  const [autoFocus, setAutoFocus] = useState(false)
  const [lifetime, setLifetime] = useState(0)
  const [frame, setFrame] = useState<{ width: number; height: number }>()
  const editor = useRef<TextInput>(null)
  const theme = useNativeTheme()
  const items = useMemo(() => {
    if (empty) return []
    let result = (many ? MANY : ITEMS).filter((item) => !removed || item.id !== 0)
    if (filter) result = result.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase()))
    if (reversed) result.reverse()
    return result
  }, [empty, many, removed, filter, query, reversed])
  const status = AVAILABLE_TYPEAHEAD_SEARCH_STATUSES[statusIndex]
  const affordance = AFFORDANCES[affordanceIndex]
  return (
    <View style={styles.scene}>
      <Text elementType="h2" variant="h3">
        Inline typeahead and caller-curated results
      </Text>
      <View style={styles.controls}>
        <Button onPress={() => setVeto((value) => !value)}>Toggle inline search veto</Button>
        <Button onPress={() => setQuery("")}>Clear inline search owner</Button>
        <Button onPress={() => setStatusIndex((value) => (value + 1) % AVAILABLE_TYPEAHEAD_SEARCH_STATUSES.length)}>
          Next inline search status
        </Button>
        <Button onPress={() => setThresholdIndex((value) => (value + 1) % THRESHOLDS.length)}>
          Next inline search threshold
        </Button>
        <Button onPress={() => setGeometryIndex((value) => (value + 1) % AVAILABLE_CORNER_GEOMETRY_CODES.length)}>
          Next inline search geometry
        </Button>
        <Button onPress={() => setAffordanceIndex((value) => (value + 1) % AFFORDANCES.length)}>
          Next inline search affordance
        </Button>
        <Button onPress={() => setDisabled((value) => !value)}>Toggle inline search disabled</Button>
        <Button onPress={() => setCustom((value) => !value)}>Toggle inline search styles</Button>
        <Button onPress={() => setCustomRows((value) => !value)}>Toggle inline search row rendering</Button>
        <Button onPress={() => setLocalized((value) => !value)}>Toggle inline search French labels</Button>
        <Button onPress={() => setEmpty((value) => !value)}>Toggle inline search empty items</Button>
        <Button onPress={() => setRemoved((value) => !value)}>Toggle inline search first item</Button>
        <Button onPress={() => setReversed((value) => !value)}>Reverse inline search items</Button>
        <Button onPress={() => setMany((value) => !value)}>Toggle inline search 200 items</Button>
        <Button onPress={() => setFilter((value) => !value)}>Toggle inline search host filter</Button>
        <Button onPress={() => setWrap((value) => !value)}>Toggle inline search focus wrap</Button>
        <Button onPress={() => setZero((value) => !value)}>Toggle inline search zero dimensions</Button>
        <Button onPress={() => setAutoFocus((value) => !value)}>Toggle inline search autofocus on restart</Button>
        <Button onPress={() => setLifetime((value) => value + 1)}>Restart inline search surface</Button>
      </View>
      <TypeaheadSearch
        key={lifetime}
        testID="inline-search-example"
        inputRef={editor}
        accessibilityLabel="Inline search input"
        inputValue={query}
        onInputChange={(next) => {
          setRequest(next)
          setRequests((value) => value + 1)
          if (!veto) setQuery(next)
        }}
        onSubmitQuery={(next) => {
          setSubmitted(next)
          setSubmits((value) => value + 1)
        }}
        onSelectionChange={(next) => {
          setSelection(next)
          setSelections((value) => value + 1)
        }}
        inputProps={{
          returnKeyType: "search",
          onChange: ({ nativeEvent }) => setNativeText(nativeEvent.text),
          onSubmitEditing: ({ nativeEvent }) => setNativeSubmit(nativeEvent.text),
          onFocus: () => setFocusEvents((value) => value + 1),
        }}
        status={status}
        minimumInputLength={THRESHOLDS[thresholdIndex]}
        items={items}
        getItemKey={getKey}
        getItemTextValue={getText}
        renderItem={customRows ? renderItem : undefined}
        labels={localized ? FRENCH : undefined}
        geometry={AVAILABLE_CORNER_GEOMETRY_CODES[geometryIndex]}
        shouldFocusWrap={wrap}
        shouldAutoFocusInput={autoFocus}
        isDisabled={disabled}
        SearchIcon={
          affordance === "custom" ? (
            <Text>Go</Text>
          ) : affordance === "falsy" ? (
            0
          ) : affordance === "bigint" ? (
            12n
          ) : undefined
        }
        LoadingIndicator={
          affordance === "custom" ? (
            <Text>Working</Text>
          ) : affordance === "falsy" ? (
            false
          ) : affordance === "bigint" ? (
            13n
          ) : undefined
        }
        customStyles={
          custom
            ? { padding: 6, borderWidth: 1, borderColor: theme.colors.controlBorder, color: theme.colors.foreground }
            : undefined
        }
        style={zero ? { width: 0, height: 0, padding: 0, borderWidth: 0 } : undefined}
        customInputRowStyles={custom ? { gap: 3 } : undefined}
        customInputStyles={custom ? { fontSize: 18, paddingLeft: 15 } : undefined}
        customSearchButtonStyles={custom ? { width: 35, height: 35 } : undefined}
        customResultsContainerStyles={custom ? { height: 240, minHeight: 0, maxHeight: 240 } : undefined}
        customResultsListStyles={custom ? { gap: 15, padding: 5 } : undefined}
        onLayout={({ nativeEvent: { layout } }) => {
          const width = Math.round(layout.width * 1000) / 1000
          const height = Math.round(layout.height * 1000) / 1000
          setFrame((current) => (current?.width === width && current.height === height ? current : { width, height }))
        }}
      />
      <Text testID="inline-search-state">
        Owner: {JSON.stringify(query)}. Request: {request === undefined ? "none" : JSON.stringify(request)}. Requests:{" "}
        {requests}. Submitted: {submitted === undefined ? "none" : JSON.stringify(submitted)}. Submits: {submits}.
        Selection: {formatKey(selection)}. Selection callbacks: {selections}. Veto: {String(veto)}. Status: {status}.
        Items: {items.length}. Threshold: {THRESHOLDS[thresholdIndex]}. Geometry:{" "}
        {AVAILABLE_CORNER_GEOMETRY_CODES[geometryIndex]}. Affordance: {affordance}. Disabled: {String(disabled)}.
        Custom: {String(custom)}. Custom rows: {String(customRows)}. French: {String(localized)}. Focus wrap:{" "}
        {String(wrap)}. Zero: {String(zero)}. Autofocus on restart: {String(autoFocus)}. Focus events: {focusEvents}.
        Lifetime: {lifetime}.
      </Text>
      <Text testID="inline-search-native">
        Last native text: {nativeText === undefined ? "none" : JSON.stringify(nativeText)}. Last native submit:{" "}
        {nativeSubmit === undefined ? "none" : JSON.stringify(nativeSubmit)}. Last root frame:{" "}
        {frame ? `${frame.width} x ${frame.height}` : "unmeasured"}.
      </Text>
      <Text testID="inline-search-content-end">
        Query/status/results are caller-owned. Selection belongs to the results lifetime. Native text and submit
        observations never overwrite the query. Installed first input, row activation, focus and complete
        viewport/profile acceptance remain separate checks.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({ scene: { gap: 10 }, controls: { flexDirection: "row", flexWrap: "wrap", gap: 8 } })
