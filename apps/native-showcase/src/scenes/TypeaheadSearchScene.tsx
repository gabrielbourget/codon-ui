import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { findNodeHandle, StyleSheet, View, type TextInput } from "react-native"

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
const REFRESHED: readonly TItem[] = ITEMS.map((item) => ({ ...item, name: `${item.name} refreshed` }))
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
const AFFORDANCES = ["default", "custom", "falsy", "bigint", "empty", "null"] as const
const THRESHOLDS = [0, 2, 100] as const
const formatKey = (key: TNativeTypeaheadSearchKey | null | undefined) =>
  key === undefined ? "none" : key === null ? "null" : `${typeof key}:${JSON.stringify(key)}`

export const TypeaheadSearchScene = () => {
  const [query, setQuery] = useState("")
  const [callbacks, setCallbacks] = useState<{ type: string; value: string | number | null }[]>([])
  const [refEvents, setRefEvents] = useState<{ id: number; attached: boolean }[]>([])
  const refIDs = useRef(new WeakMap<TextInput, number>())
  const refSequence = useRef(0)
  const lastRefID = useRef(0)
  const [callerRef, setCallerRef] = useState(true)
  const [surfaceMounted, setSurfaceMounted] = useState(true)
  const [refreshed, setRefreshed] = useState(false)
  const [replacementPending, setReplacementPending] = useState(false)
  const replacement = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [hostEvents, setHostEvents] = useState<string[]>([])
  const record = (type: string, value: string | number | null) =>
    setCallbacks((current) => [...current, { type, value }])
  const [request, setRequest] = useState<string>()
  const [requests, setRequests] = useState(0)
  const [nativeText, setNativeText] = useState<string>()
  const [nativeTarget, setNativeTarget] = useState<number>()
  const [refTarget, setRefTarget] = useState<number | null>()
  const [nativeChanges, setNativeChanges] = useState(0)
  const [nativeSelection, setNativeSelection] = useState<{ start: number; end: number }>()
  const [nativeKey, setNativeKey] = useState<string>()
  const [nativeEndText, setNativeEndText] = useState<string>()
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
  const bindEditor = useCallback((original: TextInput | null) => {
    editor.current = original
    if (original) {
      let id = refIDs.current.get(original)
      if (id === undefined) {
        id = ++refSequence.current
        refIDs.current.set(original, id)
      }
      lastRefID.current = id
    }
    setRefEvents((current) => [...current, { id: lastRefID.current, attached: original !== null }])
  }, [])
  useEffect(
    () => () => {
      if (replacement.current !== null) clearTimeout(replacement.current)
      replacement.current = null
    },
    [lifetime, surfaceMounted],
  )
  const retireReplacement = () => {
    if (replacement.current !== null) {
      clearTimeout(replacement.current)
      replacement.current = null
      setReplacementPending(false)
      setHostEvents((current) => [...current, "replacement-cancelled"])
    }
  }
  const queueReplacement = () => {
    retireReplacement()
    setReplacementPending(true)
    setHostEvents((current) => [...current, "replacement-queued"])
    replacement.current = setTimeout(() => {
      replacement.current = null
      setReplacementPending(false)
      setRefreshed((current) => !current)
      setHostEvents((current) => [...current, "replacement-completed"])
    }, 3000)
  }
  const theme = useNativeTheme()
  const items = useMemo(() => {
    if (empty) return []
    let result = (many ? MANY : refreshed ? REFRESHED : ITEMS).filter((item) => !removed || item.id !== 0)
    if (filter) result = result.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase()))
    if (reversed) result.reverse()
    return result
  }, [empty, many, refreshed, removed, filter, query, reversed])
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
        <Button
          onPress={() => {
            if (request !== undefined) setQuery(request)
          }}
        >
          Echo latest inline search request
        </Button>
        <Button onPress={() => setQuery("  owner  ")}>Set inline search owner whitespace</Button>
        <Button onPress={queueReplacement}>Queue inline search replacement</Button>
        <Button
          onPress={() => {
            retireReplacement()
            setSurfaceMounted((value) => !value)
          }}
        >
          Toggle inline search surface
        </Button>
        <Button onPress={() => setCallerRef((value) => !value)}>Toggle inline search caller ref</Button>
        <Button onPress={() => editor.current?.focus()}>Focus original inline search input</Button>
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
        <Button
          onPress={() => {
            retireReplacement()
            setLifetime((value) => value + 1)
          }}
        >
          Restart inline search surface
        </Button>
      </View>
      <Button onPress={() => setHostEvents((current) => [...current, "before-boundary"])}>
        Before inline search focus boundary
      </Button>
      {surfaceMounted && (
        <TypeaheadSearch
          key={lifetime}
          testID="inline-search-example"
          inputRef={callerRef ? bindEditor : undefined}
          accessibilityLabel="Inline search input"
          inputValue={query}
          onInputChange={(next) => {
            record("input", next)
            setRequest(next)
            setRequests((value) => value + 1)
            if (!veto) setQuery(next)
          }}
          onSubmitQuery={(next) => {
            record("submit", next)
            setSubmitted(next)
            setSubmits((value) => value + 1)
          }}
          onSelectionChange={(next) => {
            record("selection", next)
            setSelection(next)
            setSelections((value) => value + 1)
          }}
          inputProps={{
            returnKeyType: "search",
            onChange: ({ nativeEvent }) => {
              setNativeText(nativeEvent.text)
              setNativeTarget(nativeEvent.target)
              setRefTarget(editor.current ? findNodeHandle(editor.current) : null)
              setNativeChanges((value) => value + 1)
            },
            onSelectionChange: ({ nativeEvent }) => setNativeSelection(nativeEvent.selection),
            onKeyPress: ({ nativeEvent }) => setNativeKey(nativeEvent.key),
            onEndEditing: ({ nativeEvent }) => setNativeEndText(nativeEvent.text),
            onSubmitEditing: ({ nativeEvent }) => {
              record("native-submit", nativeEvent.text)
              setNativeSubmit(nativeEvent.text)
            },
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
            affordance === "empty" ? (
              ""
            ) : affordance === "null" ? null : affordance === "custom" ? (
              <Text>Go</Text>
            ) : affordance === "falsy" ? (
              0
            ) : affordance === "bigint" ? (
              12n
            ) : undefined
          }
          LoadingIndicator={
            affordance === "empty" ? (
              ""
            ) : affordance === "null" ? null : affordance === "custom" ? (
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
      )}
      <Button onPress={() => setHostEvents((current) => [...current, "after-boundary"])}>
        After inline search focus boundary
      </Button>
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
        {frame ? `${frame.width} x ${frame.height}` : "unmeasured"}. Native changes: {nativeChanges}. Last selection:{" "}
        {nativeSelection ? `${nativeSelection.start}:${nativeSelection.end}` : "none"}. Last native key:{" "}
        {nativeKey === undefined ? "none" : JSON.stringify(nativeKey)}. Last native end text:{" "}
        {nativeEndText === undefined ? "none" : JSON.stringify(nativeEndText)}.
      </Text>
      <Text testID="inline-search-owner-json">
        {JSON.stringify({
          query,
          request: request === undefined ? null : request,
          requestDefined: request !== undefined,
          requests,
          submitted: submitted === undefined ? null : submitted,
          submitDefined: submitted !== undefined,
          submits,
          selection: selection === undefined ? null : selection,
          selectionDefined: selection !== undefined,
          selections,
          callbacks,
          refEvents,
          surfaceMounted,
          callerRef,
          lifetime,
          replacementPending,
          refreshed,
          hostEvents,
          status,
          itemKeys: items.map(getKey),
          veto,
          disabled,
          nativeText: nativeText ?? null,
          nativeChanges,
          nativeTarget: nativeTarget ?? null,
          refTarget: refTarget ?? null,
          nativeSubmit: nativeSubmit ?? null,
          nativeEndText: nativeEndText ?? null,
          nativeSelection: nativeSelection ?? null,
          nativeKey: nativeKey ?? null,
          focusEvents,
        })}
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
