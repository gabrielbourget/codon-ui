import { useState } from "react"
import { ScrollView } from "react-native"

import { Button, NativeFloatingLayerHost, NativeThemeProvider, Text } from "../../../.."
import { normalizeDraftToQueryFilterGroups } from "../../../Table/filterDraft"
import type { TAvailableFilterCriteria } from "../../../Table/filterMetadata"
import type { TTableFilterGroup } from "../../../Table/queryTypes"
import { useNativeQueryDraftController, type TNativeQueryApplyRequest } from "../../controller"

const criteria: TAvailableFilterCriteria[] = [
  {
    id: "active",
    name: "Active",
    queryKey: "events.active",
    dataType: "boolean",
    availableCriteriaArguments: [{ id: "", name: "False", argumentValue: false }],
  },
  {
    id: "count",
    name: "Count",
    queryKey: "events.count",
    dataType: "number",
    availableCriteriaArguments: [{ id: "zero", name: "Zero", argumentValue: 0 }],
  },
]
const applied: TTableFilterGroup[] = [
  {
    id: "active-group",
    criteriaID: "active",
    criteriaName: "Old active label",
    dataType: "boolean",
    joinOperator: "and",
    clauses: [{ id: "active-clause", operationCode: "equal", argument: false }],
  },
  {
    id: "count-group",
    criteriaID: "count",
    criteriaName: "Old count label",
    dataType: "number",
    joinOperator: "or",
    clauses: [{ id: "count-clause", operationCode: "greater-than-equal", argument: 0 }],
  },
]

const sortCriteria = [
  { id: "count", name: "Count", queryKey: "events.count" },
  { id: "active", name: "Active", queryKey: "events.active" },
]
const initialApplied = (): TNativeQueryApplyRequest => ({ sortInstructions: [], filterGroups: applied })

// Nonshipping controller probe. Full query controls, gestures and installed acceptance remain separate work.
const ControllerProbe = () => {
  const [confirmed, setConfirmed] = useState(initialApplied)
  const [echo, setEcho] = useState(false)
  const [isOpen, setOpen] = useState(true)
  const [mode, setMode] = useState<"light" | "dark">("light")
  const [metadata, setMetadata] = useState(criteria)
  const [lastRequest, setLastRequest] = useState<TNativeQueryApplyRequest | null>(null)
  const [closeRequests, setCloseRequests] = useState(0)
  const controller = useNativeQueryDraftController({
    isOpen,
    activeSorts: confirmed.sortInstructions,
    activeFilters: confirmed.filterGroups,
    possibleSortCriteria: sortCriteria,
    possibleFilterCriteria: metadata,
    applyPendingSortAndFilterChanges: (request) => {
      setLastRequest(request)
      if (echo) setConfirmed(request)
    },
    onOpenChange: () => setCloseRequests((count) => count + 1),
  })
  const reset = () => {
    setConfirmed(initialApplied())
    setEcho(false)
    setOpen(true)
    setMode("light")
    setMetadata(criteria)
    setLastRequest(null)
    setCloseRequests(0)
  }
  return (
    <NativeThemeProvider mode={mode}>
      <NativeFloatingLayerHost>
        <ScrollView>
          <Text>Private query controller probe</Text>
          <Text>
            Open {String(isOpen)}; echo {String(echo)}; close requests {closeRequests}
          </Text>
          <Button onPress={() => setEcho((value) => !value)}>Toggle owner echo</Button>
          <Button onPress={() => setOpen((value) => !value)}>Toggle open</Button>
          <Button onPress={() => setMode((value) => (value === "light" ? "dark" : "light"))}>Toggle theme</Button>
          <Button onPress={() => setMetadata(criteria.map((item) => ({ ...item, name: item.name + " refreshed" })))}>
            Refresh metadata
          </Button>
          <Button onPress={() => controller.addSort("count")}>Add Count sort</Button>
          <Button onPress={() => controller.addSort("active")}>Add Active sort</Button>
          <Button onPress={() => controller.reorderSort("count", "active", "after")}>Move Count after Active</Button>
          <Button onPress={() => controller.addFilter("count")}>Add Count clause</Button>
          <Button onPress={() => controller.setFilterJoin("count", "and")}>Join Count with and</Button>
          <Button onPress={controller.clear}>Clear draft</Button>
          <Button onPress={controller.apply}>Apply request</Button>
          <Button onPress={controller.cancel}>Cancel to owner</Button>
          <Button onPress={reset}>Reset probe</Button>
          <Text testID="native-query-draft-proof">
            {JSON.stringify({
              confirmed,
              draft: controller.draft,
              normalized: normalizeDraftToQueryFilterGroups(controller.draft.filterGroups),
              lastRequest,
            })}
          </Text>
        </ScrollView>
      </NativeFloatingLayerHost>
    </NativeThemeProvider>
  )
}
export default ControllerProbe
