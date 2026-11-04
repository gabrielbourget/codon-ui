import { useRef, useState } from "react"
import { StyleSheet, View } from "react-native"

import {
  AVAILABLE_THEMING_ORDER_CODES,
  Button,
  Pagination,
  Text,
  type TNativeButtonProps,
  type TNativePaginationSubcomponent,
} from "@codon-ui/react-native"

const allGroups: readonly TNativePaginationSubcomponent[] = [
  "primary-controls",
  "page-counter",
  "page-input",
  "items-per-page",
]
const PAGER_CUSTOMIZATIONS = [
  ["separator", "Toggle pager separator styles"],
  ["first", "Toggle pager first button styles"],
  ["previous", "Toggle pager previous button styles"],
  ["next", "Toggle pager next button styles"],
  ["last", "Toggle pager last button styles"],
  ["page", "Toggle pager page button styles"],
  ["counter", "Toggle pager counter styles"],
  ["pageField", "Toggle pager page field styles"],
  ["sizeField", "Toggle pager size field styles"],
  ["sizeSelect", "Toggle pager size select styles"],
  ["overflow", "Toggle pager overflow button styles"],
] as const
type TPagerCustomization = (typeof PAGER_CUSTOMIZATIONS)[number][0]
type TPagerReceipt = { sequence: number; kind: "button" | "page" | "size"; data: unknown; receivedAt: number }

export const PaginationScene = () => {
  const [page, setPage] = useState(3),
    [size, setSize] = useState(10)
  const [echo, setEcho] = useState(true),
    [disabled, setDisabled] = useState(false)
  const [rtl, setRTL] = useState(false),
    [styled, setStyled] = useState(false),
    [orthogonal, setOrthogonal] = useState(false)
  const [groups, setGroups] = useState(true),
    [empty, setEmpty] = useState(false),
    [left, setLeft] = useState(true)
  const [order, setOrder] = useState(0),
    [requests, setRequests] = useState<string[]>([])
  const [held, setHeld] = useState(false),
    [popup, setPopup] = useState(false)
  const [observedText, setObservedText] = useState("")
  const [veto, setVeto] = useState(false)
  const [receipts, setReceipts] = useState<TPagerReceipt[]>([])
  const receiptSequence = useRef(0)
  const record = (kind: TPagerReceipt["kind"], data: unknown) => {
    const receipt = { sequence: ++receiptSequence.current, kind, data, receivedAt: Date.now() }
    setReceipts((values) => [...values, receipt])
  }
  const observeButton: NonNullable<TNativeButtonProps["onPress"]> = (event) => {
    const preventedBefore = event.isDefaultPrevented?.() ?? event.defaultPrevented
    if (veto) event.preventDefault()
    // Snapshot the original public event without persisting or retaining it. SDK proof stays separate.
    const native = event.nativeEvent
    record("button", {
      target: native.target,
      timestamp: "timestamp" in native ? native.timestamp : null,
      kind: "kind" in native ? native.kind : null,
      source: "source" in native ? native.source : null,
      observedAt: "observedAt" in native ? native.observedAt : null,
      preventedBefore: !!preventedBefore,
      preventedAfter: !!(event.isDefaultPrevented?.() ?? event.defaultPrevented),
    })
  }
  const [customizations, setCustomizations] = useState<readonly TPagerCustomization[]>([])
  const requestPage = (next: number) => {
    record("page", next)
    setRequests((values) => [...values, `page:${next}`])
    if (echo) setPage(next)
  }
  const requestSize = (next: number) => {
    record("size", next)
    setRequests((values) => [...values, `size:${next}`])
    if (echo) setSize(next)
  }
  const reset = () => {
    setPage(3)
    setSize(10)
    setEcho(true)
    setDisabled(false)
    setRTL(false)
    setStyled(false)
    setOrthogonal(false)
    setGroups(true)
    setEmpty(false)
    setLeft(true)
    setOrder(0)
    setRequests([])
    setHeld(false)
    setPopup(false)
    setObservedText("")
    setVeto(false)
    setReceipts([])
    receiptSequence.current = 0
    setCustomizations([])
  }
  return (
    <View style={{ gap: 12 }}>
      <Text elementType="h2">Pagination</Text>
      <Text testID="pagination-scene-state">
        Page: {page}. Size: {size}. Owner {echo ? "echoes" : "declines"}. Requests: {requests.join(", ") || "none"}.
        Last text event: {observedText || "empty"}.
      </Text>
      <Text testID="pagination-behavior-owner">
        {JSON.stringify({ page, size, echo, disabled, empty, rtl, groups, left, veto, requests })}
      </Text>
      <Button onPress={() => setEcho((value) => !value)}>Toggle pager echo</Button>
      <Button onPress={() => setVeto((value) => !value)}>Toggle pager action veto</Button>
      <Button onPress={() => setPage((value) => (value === 3 ? 8 : 3))}>Replace owner page</Button>
      <Button onPress={() => setDisabled((value) => !value)}>Toggle pager disabled</Button>
      <Button onPress={() => setRTL((value) => !value)}>Toggle pager RTL</Button>
      <Button onPress={() => setOrthogonal((value) => !value)}>Toggle pager geometry</Button>
      <Button onPress={() => setStyled((value) => !value)}>Toggle pager styles</Button>
      {PAGER_CUSTOMIZATIONS.map(([key, label]) => (
        <Button
          key={key}
          onPress={() =>
            setCustomizations((values) =>
              values.includes(key) ? values.filter((value) => value !== key) : [...values, key],
            )
          }
        >
          {label}
        </Button>
      ))}
      <Text testID="pagination-customization-state">Pager customizations: {customizations.join(", ") || "none"}.</Text>
      <Button onPress={() => setGroups((value) => !value)}>Toggle pager groups</Button>
      <Button onPress={() => setEmpty((value) => !value)}>Toggle pager empty data</Button>
      <Button onPress={() => setLeft((value) => !value)}>Toggle pager consolidation</Button>
      <Button onPress={() => setOrder((value) => (value + 1) % AVAILABLE_THEMING_ORDER_CODES.length)}>
        Next pager order
      </Button>
      <Button
        onPress={() => {
          setPage(1)
          setHeld(true)
          setPopup(true)
        }}
      >
        Show controlled pager popup
      </Button>
      <Button onPress={reset}>Reset pager</Button>
      <Text nativeID="pagination-scene-description">
        Page and size stay with the owner. The page-entry draft is submitted separately.
      </Text>
      <Pagination
        currentPage={page}
        setCurrentPage={requestPage}
        itemsPerPage={size}
        setItemsPerPage={requestSize}
        numberOfItems={empty ? 0 : 200}
        showWithOnePage
        chosenPaginationSubcomponents={groups ? allGroups : ["primary-controls"]}
        itemsPerPageOptions={[10, 20, 50]}
        maxVisiblePages={4}
        consolidationPlacement={left ? "left" : "right"}
        isDisabled={disabled}
        rtl={rtl}
        order={AVAILABLE_THEMING_ORDER_CODES[order]}
        geometry={orthogonal ? "orthogonal" : "rounded"}
        showFirstPageButton
        showLastPageButton
        aria-describedby="pagination-scene-description"
        labels={{
          root: { navigationAriaLabel: "Scene pagination" },
          primaryControls: { overflowButtonAriaLabel: "Show other pages" },
          itemsPerPage: { selectAriaLabel: "Page size" },
        }}
        customComponentStyles={styled ? { gap: 0, color: "purple" } : undefined}
        style={styled ? { color: "orange" } : undefined}
        customPageNumberInputProps={{ testID: "pagination-scene-input", onChangeText: setObservedText }}
        customItemsPerPageSelectProps={{ testID: "pagination-scene-size" }}
        customGeneralButtonProps={{ isDisabled: false, onPress: observeButton }}
        customClickPopoverProps={{
          ...(held ? { isOpen: popup } : {}),
          onOpenChange: (next) => {
            if (echo) setPopup(next)
          },
        }}
        customOptionsListStyles={styled ? { padding: 0 } : undefined}
        customSeparatorStyles={customizations.includes("separator") ? styles.separator : undefined}
        customFirstPageButtonStyles={customizations.includes("first") ? styles.first : undefined}
        customPrevButtonStyles={customizations.includes("previous") ? styles.previous : undefined}
        customNextButtonStyles={customizations.includes("next") ? styles.next : undefined}
        customLastPageButtonStyles={customizations.includes("last") ? styles.last : undefined}
        customPageNumberButtonStyles={customizations.includes("page") ? styles.page : undefined}
        customPageCounterStyles={customizations.includes("counter") ? styles.counter : undefined}
        customPageNumberInputFormFieldStyles={customizations.includes("pageField") ? styles.pageField : undefined}
        customItemsPerPageFormFieldStyles={customizations.includes("sizeField") ? styles.sizeField : undefined}
        customItemsPerPageSelectStyles={customizations.includes("sizeSelect") ? styles.sizeSelect : undefined}
        customClickPopoverTriggerButtonStyles={customizations.includes("overflow") ? styles.overflow : undefined}
      />
      <Text testID="pagination-behavior-callbacks">{JSON.stringify(receipts)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  separator: { width: 3, backgroundColor: "#087f8c" },
  first: { borderWidth: 2, borderColor: "#be123c" },
  previous: { borderWidth: 2, borderColor: "#d97706" },
  next: { borderWidth: 2, borderColor: "#166534" },
  last: { borderWidth: 2, borderColor: "#7c3aed" },
  page: { backgroundColor: "#d1fae5", borderWidth: 2, borderColor: "#166534" },
  counter: { padding: 7, borderWidth: 2, borderColor: "#7c3aed" },
  pageField: { padding: 8, borderWidth: 2, borderColor: "#087f8c" },
  sizeField: { padding: 9, borderWidth: 2, borderColor: "#d97706" },
  sizeSelect: { backgroundColor: "#fff2cc", borderWidth: 2, borderColor: "#166534" },
  overflow: { backgroundColor: "#ddeeff", borderWidth: 2, borderColor: "#174ea6" },
})
