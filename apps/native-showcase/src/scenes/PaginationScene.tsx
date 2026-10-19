import { useState } from "react"
import { View } from "react-native"

import {
  AVAILABLE_THEMING_ORDER_CODES,
  Button,
  Pagination,
  Text,
  type TNativePaginationSubcomponent,
} from "@codon-ui/react-native"

const allGroups: readonly TNativePaginationSubcomponent[] = [
  "primary-controls",
  "page-counter",
  "page-input",
  "items-per-page",
]
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
  const requestPage = (next: number) => {
    setRequests((values) => [...values, `page:${next}`])
    if (echo) setPage(next)
  }
  const requestSize = (next: number) => {
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
  }
  return (
    <View style={{ gap: 12 }}>
      <Text elementType="h2">Pagination</Text>
      <Text testID="pagination-scene-state">
        Page: {page}. Size: {size}. Owner {echo ? "echoes" : "declines"}. Requests: {requests.join(", ") || "none"}.
        Last text event: {observedText || "empty"}.
      </Text>
      <Button onPress={() => setEcho((value) => !value)}>Toggle pager echo</Button>
      <Button onPress={() => setPage((value) => (value === 3 ? 8 : 3))}>Replace owner page</Button>
      <Button onPress={() => setDisabled((value) => !value)}>Toggle pager disabled</Button>
      <Button onPress={() => setRTL((value) => !value)}>Toggle pager RTL</Button>
      <Button onPress={() => setOrthogonal((value) => !value)}>Toggle pager geometry</Button>
      <Button onPress={() => setStyled((value) => !value)}>Toggle pager styles</Button>
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
        customClickPopoverProps={{
          ...(held ? { isOpen: popup } : {}),
          onOpenChange: (next) => {
            if (echo) setPopup(next)
          },
        }}
        customOptionsListStyles={styled ? { padding: 0 } : undefined}
      />
    </View>
  )
}
