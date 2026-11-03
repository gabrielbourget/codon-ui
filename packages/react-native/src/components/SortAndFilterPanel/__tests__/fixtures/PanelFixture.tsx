import { useEffect, useState } from "react"
import { ScrollView, View, type ViewStyle } from "react-native"

import {
  Button,
  NativeBackdropHost,
  NativeFloatingLayerHost,
  NativeOverlayProvider,
  NativeThemeProvider,
  Text,
  type TNativeBackdropAdapter,
} from "../../../.."
import type { TAvailableFilterCriteria } from "../../../Table/filterMetadata"
import type { TNativeQueryApplyRequest } from "../../controller"
import { SortAndFilterPanel } from "../../SortAndFilterPanel"

const sortCriteria = [
  { id: "name", name: "Name", queryKey: "events.name" },
  { id: "count", name: "Count", queryKey: "events.count" },
]
const filterCriteria: TAvailableFilterCriteria[] = [
  {
    id: "name",
    name: "Name",
    queryKey: "events.name",
    dataType: "text",
    allowedOperationCodes: ["like", "similar-to"],
  },
  {
    id: "count",
    name: "Count",
    queryKey: "events.count",
    dataType: "number",
    allowedOperationCodes: ["equal", "between"],
  },
  { id: "active", name: "Active", queryKey: "events.active", dataType: "boolean", allowedOperationCodes: ["equal"] },
  {
    id: "suggestion",
    name: "Suggestions",
    queryKey: "events.suggestion",
    dataType: "text",
    allowedOperationCodes: ["equal"],
    usesComboBoxInput: true,
    availableCriteriaArguments: [
      { id: "alpha", name: "Alpha" },
      { id: "beta", name: "Beta" },
    ],
  },
  {
    id: "unavailable",
    name: "Typeahead placeholders",
    queryKey: "events.unavailable",
    dataType: "text",
    allowedOperationCodes: ["equal", "in"],
    usesTypeAheadInput: true,
  },
  ...(["date", "date-time", "time"] as const).map((dataType) => ({
    id: dataType,
    name: dataType,
    queryKey: `events.${dataType}`,
    dataType,
    allowedOperationCodes: ["equal", "between"] as ("equal" | "between")[],
  })),
]
const confirmedQuery = (): TNativeQueryApplyRequest => ({
  sortInstructions: [
    { id: "count", criteriaID: "count", criteriaName: "Count", queryKey: "events.count", sortDirection: "Descending" },
    { id: "name", criteriaID: "name", criteriaName: "Name", queryKey: "events.name", sortDirection: "Ascending" },
  ],
  filterGroups: [
    {
      id: "count-group",
      criteriaID: "count",
      criteriaName: "Count",
      queryKey: "events.count",
      dataType: "number",
      joinOperator: "and",
      clauses: [{ id: "count-zero", operationCode: "equal", argument: 0 }],
    },
    {
      id: "active-group",
      criteriaID: "active",
      criteriaName: "Active",
      queryKey: "events.active",
      dataType: "boolean",
      joinOperator: "and",
      clauses: [{ id: "active-false", operationCode: "equal", argument: false }],
    },
  ],
})

const argumentQuery = (criterion: "suggestion" | "unavailable" | "name"): TNativeQueryApplyRequest => ({
  sortInstructions: [],
  filterGroups: [
    {
      id: `${criterion}-group`,
      criteriaID: criterion,
      criteriaName:
        criterion === "suggestion" ? "Suggestions" : criterion === "name" ? "Name" : "Typeahead placeholders",
      queryKey: `events.${criterion}`,
      dataType: "text",
      joinOperator: "and",
      clauses:
        criterion === "suggestion"
          ? [{ id: "suggestion-clause", operationCode: "equal", argument: "Alpha" }]
          : criterion === "name"
            ? [{ id: "name-clause", operationCode: "like", argument: "held" }]
            : [
                { id: "placeholder-scalar", operationCode: "equal", argument: "kept scalar" },
                { id: "placeholder-list", operationCode: "in", argument: ["kept", "list"] },
              ],
    },
  ],
})

const DELAYED_QUERY_ACTIONS = [
  { action: "replace-owner", label: "Replace owner after next open" },
  { action: "refresh-metadata", label: "Refresh metadata after next open" },
  { action: "unmount-panel", label: "Unmount panel after next open" },
] as const
type TDelayedQueryAction = (typeof DELAYED_QUERY_ACTIONS)[number]["action"]
type TQueryCallback = { type: "apply"; request: TNativeQueryApplyRequest } | { type: "open"; next: boolean }

export const SortAndFilterPanelFixture = ({ adapter }: { adapter?: TNativeBackdropAdapter } = {}) => {
  const [open, setOpen] = useState(false)
  const [echo, setEcho] = useState(false)
  const [closeVetoesRemaining, setCloseVetoesRemaining] = useState(0)
  const [booleanToggle, setBooleanToggle] = useState(false)
  const [panelMounted, setPanelMounted] = useState(true)
  const [pendingAction, setPendingAction] = useState<TDelayedQueryAction | null>(null)
  const [callbacks, setCallbacks] = useState<TQueryCallback[]>([])
  const [hostEvents, setHostEvents] = useState<{ action: TDelayedQueryAction; at: number }[]>([])
  const [mode, setMode] = useState<"light" | "dark">("light")
  const [metadata, setMetadata] = useState(filterCriteria)
  const [confirmed, setConfirmed] = useState<TNativeQueryApplyRequest>({ sortInstructions: [], filterGroups: [] })
  const [requests, setRequests] = useState<TNativeQueryApplyRequest[]>([])
  const [closeRequests, setCloseRequests] = useState(0)
  const [blur, setBlur] = useState(!!adapter)
  const [sourcePose, setSourcePose] = useState(0)
  const sourceTransform: ViewStyle["transform"] =
    sourcePose === 0
      ? undefined
      : sourcePose === 1
        ? [{ scale: 0.85 }, { rotate: "8deg" }]
        : sourcePose === 2
          ? [{ perspective: 700 }, { rotateY: "18deg" }, { rotateZ: "6deg" }]
          : [{ scaleX: -1 }]
  useEffect(() => {
    if (!open || !panelMounted || pendingAction === null) return
    const timer = setTimeout(() => {
      setPendingAction(null)
      setHostEvents((previous) => [...previous, { action: pendingAction, at: Date.now() }])
      if (pendingAction === "replace-owner") {
        const replacement = confirmedQuery()
        replacement.filterGroups[0].clauses[0].argument = 7
        setConfirmed(replacement)
      } else if (pendingAction === "refresh-metadata")
        setMetadata(filterCriteria.map((criterion) => ({ ...criterion, name: criterion.name + " refreshed" })))
      else setPanelMounted(false)
    }, 3000)
    return () => clearTimeout(timer)
  }, [open, panelMounted, pendingAction])
  const reset = () => {
    setOpen(false)
    setEcho(false)
    setCloseVetoesRemaining(0)
    setBooleanToggle(false)
    setPanelMounted(true)
    setPendingAction(null)
    setCallbacks([])
    setHostEvents([])
    setMode("light")
    setMetadata(filterCriteria)
    setConfirmed({ sortInstructions: [], filterGroups: [] })
    setRequests([])
    setCloseRequests(0)
    setBlur(!!adapter)
    setSourcePose(0)
  }
  const Root = adapter ? NativeBackdropHost : View
  return (
    <NativeThemeProvider mode={mode}>
      <NativeOverlayProvider backdropAdapter={adapter}>
        <Root style={{ flex: 1, transform: sourceTransform }}>
          <NativeFloatingLayerHost>
            <ScrollView contentContainerStyle={{ padding: 15, gap: 10 }}>
              <Text elementType="h1">Sort and Filter Panel</Text>
              <Button isDisabled={!panelMounted} onPress={() => setOpen(true)}>
                Open query panel
              </Button>
              <Button onPress={() => setConfirmed(confirmedQuery())}>Load confirmed query</Button>
              <Button onPress={() => setConfirmed({ sortInstructions: [], filterGroups: [] })}>
                Clear confirmed query
              </Button>
              <Button onPress={() => setConfirmed(argumentQuery("name"))}>Load text argument</Button>
              <Button onPress={() => setConfirmed(argumentQuery("suggestion"))}>Load ComboBox argument</Button>
              <Button onPress={() => setConfirmed(argumentQuery("unavailable"))}>Load typeahead placeholders</Button>
              <Button onPress={() => setEcho((value) => !value)}>Toggle owner echo</Button>
              <Button onPress={() => setCloseVetoesRemaining(2)}>Veto next two closes</Button>
              <Button onPress={() => setBooleanToggle((value) => !value)}>Toggle Boolean editor</Button>
              {DELAYED_QUERY_ACTIONS.map(({ action, label }) => (
                <Button key={action} onPress={() => setPendingAction(action)}>
                  {label}
                </Button>
              ))}
              <Text>Queued owner action runs 3 seconds after opening the panel.</Text>
              <Button
                onPress={() => {
                  setOpen(false)
                  setPendingAction(null)
                  setPanelMounted(true)
                }}
              >
                Restore query panel
              </Button>
              <Button onPress={reset}>Reset query scene</Button>
              {adapter && <Button onPress={() => setBlur((value) => !value)}>Toggle configured query blur</Button>}
              {adapter && (
                <>
                  <Text>Backdrop source pose: {sourcePose}</Text>
                  <Button onPress={() => setSourcePose((value) => (value + 1) % 4)}>
                    Cycle query backdrop transform
                  </Button>
                </>
              )}
              <Button onPress={() => setMode((value) => (value === "light" ? "dark" : "light"))}>Toggle theme</Button>
              <Button
                onPress={() =>
                  setMetadata(
                    filterCriteria.map((criterion) => ({ ...criterion, name: criterion.name + " refreshed" })),
                  )
                }
              >
                Refresh filter metadata
              </Button>
              <Text testID="query-panel-owner">
                {JSON.stringify({
                  confirmed,
                  requests,
                  closeRequests,
                  echo,
                  callbacks,
                  open,
                  closeVetoesRemaining,
                  booleanToggle,
                  panelMounted,
                  pendingAction,
                  hostEvents,
                })}
              </Text>
            </ScrollView>
            {panelMounted && (
              <SortAndFilterPanel
                title="Events"
                isOpen={open}
                onOpenChange={(next) => {
                  setCloseRequests((count) => count + 1)
                  setCallbacks((previous) => [...previous, { type: "open", next }])
                  if (!next && closeVetoesRemaining > 0) setCloseVetoesRemaining((count) => count - 1)
                  else {
                    setOpen(next)
                    if (!next) setPendingAction(null)
                  }
                }}
                overlayBlur={blur}
                possibleSortCriteria={sortCriteria}
                possibleFilterCriteria={metadata}
                booleanArgumentComponent={booleanToggle ? "Toggle" : "Checkbox"}
                activeSorts={confirmed.sortInstructions}
                activeFilters={confirmed.filterGroups}
                applyPendingSortAndFilterChanges={(request) => {
                  setRequests((previous) => [...previous, request])
                  setCallbacks((previous) => [...previous, { type: "apply", request }])
                  if (echo) setConfirmed(request)
                }}
              />
            )}
          </NativeFloatingLayerHost>
        </Root>
      </NativeOverlayProvider>
    </NativeThemeProvider>
  )
}
