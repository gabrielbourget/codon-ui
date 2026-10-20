import { act, screen, within } from "@testing-library/react-native"
import { useContext } from "react"
import { Platform } from "react-native"

import {
  fireEventWithNativeCollections as fireEvent,
  renderWithNativeCollections as render,
} from "../../../collection/__tests__/nativeReceipts"
import { NativeOverlayProvider, OverlayRegistryContext } from "../../../overlays/NativeOverlayProvider"

import QueryProbe from "./fixtures/QueryProbe"

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: jest.requireActual("react-native").View,
  SafeAreaView: jest.requireActual("react-native").View,
}))

const press = async (name: string) => fireEvent.press(screen.getByRole("button", { name }))
let appRestored: (() => boolean) | undefined
const RegistryProbe = () => {
  const registry = useContext(OverlayRegistryContext)
  appRestored = () => registry?.canRestore(null) ?? false
  return null
}
const snapshot = () => JSON.parse(screen.getByTestId("native-query-draft-proof").props.children as string)

it("keeps the probe's owner veto distinct from editable data through metadata and theme changes", async () => {
  await render(<QueryProbe />)
  expect(
    snapshot().confirmed.filterGroups.map((group: { clauses: { argument: unknown }[] }) => group.clauses[0].argument),
  ).toEqual([false, 0])
  await press("Add Count sort")
  await press("Add Active sort")
  await press("Move Count after Active")
  await press("Apply request")
  expect(snapshot().confirmed.sortInstructions).toEqual([])
  expect(snapshot().lastRequest.sortInstructions.map((item: { id: string }) => item.id)).toEqual(["active", "count"])
  await press("Refresh metadata")
  await press("Toggle theme")
  expect(snapshot().draft.sortInstructions.map((item: { id: string }) => item.id)).toEqual(["active", "count"])
  expect(snapshot().draft.filterGroups[0].criteriaName).toBe("Active refreshed")
  await press("Cancel to owner")
  expect(snapshot().draft.sortInstructions).toEqual([])
  expect(
    snapshot().draft.filterGroups.map((group: { clauses: { argument: unknown }[] }) => group.clauses[0].argument),
  ).toEqual([false, 0])
})

it("echoes an Apply only when enabled and restores that confirmed snapshot after Clear", async () => {
  await render(<QueryProbe />)
  await press("Toggle owner echo")
  await press("Add Count sort")
  await press("Apply request")
  expect(snapshot().confirmed.sortInstructions[0].id).toBe("count")
  await press("Clear draft")
  expect(snapshot().draft.filterGroups).toEqual([])
  await press("Cancel to owner")
  expect(snapshot().draft.sortInstructions[0].id).toBe("count")
  expect(snapshot().draft.filterGroups).toHaveLength(2)
  await press("Reset probe")
  expect(snapshot().confirmed.sortInstructions).toEqual([])
  expect(snapshot().lastRequest).toBeNull()
  expect(snapshot().draft.sortInstructions).toEqual([])
})

it("guards closed command requests and rehydrates on a later open", async () => {
  await render(<QueryProbe />)
  await press("Add Count sort")
  await press("Toggle open")
  const before = snapshot()
  await press("Add Active sort")
  await press("Clear draft")
  await press("Apply request")
  expect(snapshot()).toEqual(before)
  await press("Toggle open")
  expect(snapshot().draft.sortInstructions).toEqual([])
})

it("composes the actual Add Sort, row, header and footer controls with owner veto/echo", async () => {
  jest.replaceProperty(Platform, "OS", "ios")
  await render(
    <NativeOverlayProvider>
      <RegistryProbe />
      <QueryProbe />
    </NativeOverlayProvider>,
  )
  await press("Add Sort Criteria")
  const window = screen.getByTestId("select-window")
  const dismissed = window.props.onDismiss
  await fireEvent(window, "show")
  expect(appRestored?.()).toBe(false)
  await fireEvent.press(screen.getByRole("radio", { name: "Count" }))
  await act(() => dismissed())
  expect(appRestored?.()).toBe(true)
  expect(snapshot().draft.sortInstructions.map((item: { id: string }) => item.id)).toEqual(["count"])
  await fireEvent.press(within(screen.getByTestId("query-sort-entry")).getByRole("button", { name: "Sort Descending" }))
  await press("Apply")
  expect(snapshot().lastRequest.sortInstructions[0].sortDirection).toBe("Descending")
  expect(snapshot().confirmed.sortInstructions).toEqual([])
  await press("Close Sort and Filter Panel")
  expect(snapshot().draft.sortInstructions[0].sortDirection).toBe("Descending")
  await press("Toggle owner echo")
  await press("Apply")
  await press("Clear All")
  expect(snapshot().draft.sortInstructions).toEqual([])
  await press("Cancel")
  expect(snapshot().draft.sortInstructions[0].sortDirection).toBe("Descending")
  await press("Remove Count")
  expect(snapshot().draft.sortInstructions).toEqual([])
  expect(snapshot().confirmed.sortInstructions).toHaveLength(1)
})

it("keeps current control drafts and owner snapshots through theme/metadata refresh and resets the control scene", async () => {
  await render(<QueryProbe />)
  await press("Add Count sort")
  await press("Sort Descending")
  await press("Refresh metadata")
  await press("Toggle theme")
  expect(snapshot().draft.sortInstructions[0].sortDirection).toBe("Descending")
  expect(snapshot().confirmed.sortInstructions).toEqual([])
  await press("Toggle open")
  await press("Delete Sort Entry")
  await press("Apply")
  expect(snapshot().draft.sortInstructions).toHaveLength(1)
  expect(snapshot().lastRequest).toBeNull()
  await press("Reset probe")
  expect(screen.queryByTestId("query-sort-entry")).toBeNull()
  expect(screen.getByText("No sorting currently applied")).toBeOnTheScreen()
  expect(snapshot().draft.filterGroups).toHaveLength(2)
})

afterEach(() => jest.restoreAllMocks())
