import { useState } from "react"
import { ScrollView } from "react-native"

import { Button, NativeFloatingLayerHost, NativeOverlayProvider, NativeThemeProvider, Text } from "../../../.."
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
  ...(["date", "date-time", "time"] as const).map((dataType) => ({
    id: dataType,
    name: dataType,
    queryKey: `events.${dataType}`,
    dataType,
    allowedOperationCodes: ["equal", "between"] as ("equal" | "between")[],
  })),
]
export const SortAndFilterPanelFixture = () => {
  const [open, setOpen] = useState(false)
  const [echo, setEcho] = useState(false)
  const [mode, setMode] = useState<"light" | "dark">("light")
  const [metadata, setMetadata] = useState(filterCriteria)
  const [confirmed, setConfirmed] = useState<TNativeQueryApplyRequest>({ sortInstructions: [], filterGroups: [] })
  const [requests, setRequests] = useState<TNativeQueryApplyRequest[]>([])
  const [closeRequests, setCloseRequests] = useState(0)
  return (
    <NativeThemeProvider mode={mode}>
      <NativeOverlayProvider>
        <NativeFloatingLayerHost>
          <ScrollView contentContainerStyle={{ padding: 15, gap: 10 }}>
            <Text elementType="h1">Sort and Filter Panel</Text>
            <Button onPress={() => setOpen(true)}>Open query panel</Button>
            <Button onPress={() => setEcho((value) => !value)}>Toggle owner echo</Button>
            <Button onPress={() => setMode((value) => (value === "light" ? "dark" : "light"))}>Toggle theme</Button>
            <Button
              onPress={() =>
                setMetadata(filterCriteria.map((criterion) => ({ ...criterion, name: criterion.name + " refreshed" })))
              }
            >
              Refresh filter metadata
            </Button>
            <Text testID="query-panel-owner">{JSON.stringify({ confirmed, requests, closeRequests, echo })}</Text>
          </ScrollView>
          <SortAndFilterPanel
            title="Events"
            isOpen={open}
            onOpenChange={(next) => {
              setCloseRequests((count) => count + 1)
              setOpen(next)
            }}
            overlayBlur={false}
            possibleSortCriteria={sortCriteria}
            possibleFilterCriteria={metadata}
            activeSorts={confirmed.sortInstructions}
            activeFilters={confirmed.filterGroups}
            applyPendingSortAndFilterChanges={(request) => {
              setRequests((previous) => [...previous, request])
              if (echo) setConfirmed(request)
            }}
          />
        </NativeFloatingLayerHost>
      </NativeOverlayProvider>
    </NativeThemeProvider>
  )
}
