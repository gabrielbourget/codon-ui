import { useState } from "react"
import { ScrollView, View, type ViewStyle } from "react-native"

import {
  SortAndFilterPanel,
  Button,
  NativeBackdropHost,
  NativeFloatingLayerHost,
  NativeOverlayProvider,
  NativeThemeProvider,
  Text,
  type TNativeBackdropAdapter,
} from "@codon-ui/react-native"
import type { AvailableFilterCriteria as TAvailableFilterCriteria } from "@codon-ui/react-native"
import type { ApplySortAndFilterParametersArgs as TNativeQueryApplyRequest } from "@codon-ui/react-native"

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
export const SortAndFilterPanelScene = ({ adapter }: { adapter?: TNativeBackdropAdapter } = {}) => {
  const [open, setOpen] = useState(false)
  const [echo, setEcho] = useState(false)
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
  const Root = adapter ? NativeBackdropHost : View
  return (
    <NativeThemeProvider mode={mode}>
      <NativeOverlayProvider backdropAdapter={adapter}>
        <Root style={{ flex: 1, transform: sourceTransform }}>
          <NativeFloatingLayerHost>
            <ScrollView contentContainerStyle={{ padding: 15, gap: 10 }}>
              <Text elementType="h1">Sort and Filter Panel</Text>
              <Button onPress={() => setOpen(true)}>Open query panel</Button>
              <Button onPress={() => setEcho((value) => !value)}>Toggle owner echo</Button>
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
              <Text testID="query-panel-owner">{JSON.stringify({ confirmed, requests, closeRequests, echo })}</Text>
            </ScrollView>
            <SortAndFilterPanel
              title="Events"
              isOpen={open}
              onOpenChange={(next) => {
                setCloseRequests((count) => count + 1)
                setOpen(next)
              }}
              overlayBlur={blur}
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
        </Root>
      </NativeOverlayProvider>
    </NativeThemeProvider>
  )
}
