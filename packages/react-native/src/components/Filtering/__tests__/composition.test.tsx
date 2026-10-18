import { fireEvent, render, screen, within } from "@testing-library/react-native"

import FilterControlProbe from "./fixtures/FilterControlProbe"

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: jest.requireActual("react-native").View,
  SafeAreaView: jest.requireActual("react-native").View,
}))
const state = () => JSON.parse(screen.getByTestId("native-filter-controls-proof").props.children as string)
const press = async (name: string) => fireEvent.press(screen.getByRole("button", { name }))
const select = async (row: string, field: string, option: string) => {
  await fireEvent.press(within(screen.getByTestId(row)).getByRole("button", { name: field }))
  await fireEvent.press(screen.getByRole("radio", { name: option }))
}

it("composes Select value requests with held/echoed owner snapshots and metadata/theme changes", async () => {
  await render(<FilterControlProbe />)
  await select("filter-probe-status-clause", "Filter Argument", "Zero")
  expect(state().draft.filterGroups[0].clauses[0]).toMatchObject({ argument: 0, filterArgumentSelectedKey: "zero" })
  expect(state().confirmed.filterGroups[0].clauses[0].argument).toBe(false)
  await press("Refresh filter metadata")
  await press("Toggle filter theme")
  await press("Apply filter draft")
  expect(state().lastRequest.filterGroups[0].clauses[0].argument).toBe(0)
  expect(state().confirmed.filterGroups[0].clauses[0].argument).toBe(false)
  await press("Cancel filter draft")
  expect(state().draft.filterGroups[0].clauses[0].argument).toBe(false)
  await select("filter-probe-status-clause", "Filter Argument", "Zero")
  await press("Toggle filter echo")
  await press("Apply filter draft")
  await press("Clear filter draft")
  await press("Cancel filter draft")
  expect(state().draft.filterGroups[0].clauses[0].argument).toBe(0)
})
it("composes condition changes and name-based multi-selection without optimistic applied ownership", async () => {
  await render(<FilterControlProbe />)
  await select("filter-probe-names-clause", "Filter Condition Type", "Multi-Select")
  expect(state().draft.filterGroups[1].clauses[0]).toMatchObject({ conditionType: "Multi-Select", argument: [] })
  await press("Show filter argument suggestions")
  await fireEvent.press(screen.getByRole("radio", { name: "Beta" }))
  expect(state().draft.filterGroups[1].clauses[0]).toMatchObject({
    argument: ["Beta"],
    filterArgumentSelectedKey: "beta",
  })
  await press("Apply filter draft")
  expect(state().lastRequest.filterGroups[1].clauses[0].argument).toEqual(["Beta"])
  expect(state().confirmed.filterGroups[1].clauses[0].argument).toEqual(["Alpha"])
  await press("Remove Beta")
  expect(state().draft.filterGroups[1].clauses[0].argument).toEqual([])
})
it("preserves clause identity through a criterion move and guards closed deletes before reset", async () => {
  await render(<FilterControlProbe />)
  await select("filter-probe-status-clause", "Filter Criteria", "Names")
  expect(state().draft.filterGroups).toHaveLength(1)
  expect(state().draft.filterGroups[0].clauses.map((item: { id: string }) => item.id)).toEqual([
    "names-clause",
    "status-clause",
  ])
  await press("Toggle filter open")
  await fireEvent.press(
    within(screen.getByTestId("filter-probe-status-clause")).getByRole("button", { name: "Delete Filter Entry" }),
  )
  expect(state().draft.filterGroups[0].clauses).toHaveLength(2)
  await press("Reset filter probe")
  expect(state().draft.filterGroups).toHaveLength(2)
  expect(state().lastRequest).toBeNull()
})
