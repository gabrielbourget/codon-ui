import { screen, within } from "@testing-library/react-native"

import {
  fireEventWithNativeCollections as fireEvent,
  renderWithNativeCollections as render,
} from "../../../collection/__tests__/nativeReceipts"

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

it("composes numeric editor blanks with held Apply and confirmed Cancel", async () => {
  await render(<FilterControlProbe />)
  await select("filter-probe-status-clause", "Filter Criteria", "Amount")
  const row = screen.getByTestId("filter-probe-status-clause")
  await fireEvent.press(within(row).getByRole("button", { name: "Increase argument" }))
  expect(state().draft.filterGroups.at(-1).clauses[0].argument).toBe(0)
  await press("Apply filter draft")
  expect(state().lastRequest.filterGroups.at(-1).clauses[0].argument).toBe(0)
  const input = within(row).getByTestId("number-input-input")
  await fireEvent.changeText(input, "")
  await fireEvent(input, "endEditing", { nativeEvent: { text: "" } })
  expect(state().draft.filterGroups.at(-1).clauses[0].argument).toBeUndefined()
  await press("Apply filter draft")
  expect(state().lastRequest.filterGroups.some((group: { criteriaID: string }) => group.criteriaID === "amount")).toBe(
    false,
  )
  await press("Cancel filter draft")
  expect(state().draft.filterGroups[0].clauses[0].argument).toBe(false)
})
it("composes owned list edits without coercing previously confirmed values", async () => {
  await render(<FilterControlProbe />)
  const row = screen.getByTestId("filter-probe-names-clause")
  await fireEvent.changeText(within(row).getByLabelText("Filter Argument 0"), "Next")
  await fireEvent.press(within(row).getByRole("button", { name: "Add Filter Argument Entry" }))
  expect(state().draft.filterGroups[1].clauses[0].argument).toEqual(["Next", ""])
  await press("Refresh filter metadata")
  await press("Toggle filter theme")
  await press("Apply filter draft")
  expect(state().lastRequest.filterGroups[1].clauses[0].argument).toEqual(["Next"])
  expect(state().confirmed.filterGroups[1].clauses[0].argument).toEqual(["Alpha"])
})

it("composes the actual blank numeric Between factory through both owned bounds and Apply", async () => {
  await render(<FilterControlProbe />)
  await select("filter-probe-status-clause", "Filter Criteria", "Amount")
  await select("filter-probe-status-clause", "Filter Condition", "Between")
  expect(state().draft.filterGroups.at(-1).clauses[0].argument).toEqual(["", ""])
  const row = within(screen.getByTestId("filter-probe-status-clause"))
  expect(row.getAllByTestId("number-input-input").map((input) => input.props.value)).toEqual(["", ""])
  await fireEvent.press(row.getByRole("button", { name: "Increase minimum" }))
  expect(state().draft.filterGroups.at(-1).clauses[0].argument).toEqual([0, ""])
  await press("Apply filter draft")
  expect(state().lastRequest.filterGroups.some((group: { criteriaID: string }) => group.criteriaID === "amount")).toBe(
    false,
  )
  await fireEvent.press(row.getByRole("button", { name: "Increase maximum" }))
  await press("Apply filter draft")
  expect(state().lastRequest.filterGroups.at(-1).clauses[0].argument).toEqual([0, 0])
})

it("composes contained/similar argument labels through operation, metadata and theme changes", async () => {
  await render(<FilterControlProbe />)
  await select("filter-probe-names-clause", "Filter Condition", "Contains")
  const input = screen.getByLabelText("Filter Names by contained text")
  await fireEvent.changeText(input, "draft")
  expect(state().draft.filterGroups[1].clauses[0].argument).toBe("draft")
  await select("filter-probe-names-clause", "Filter Condition", "Similar to")
  expect(screen.getByLabelText("Filter Names by similar text")).toBe(input)
  expect(input).toHaveDisplayValue("")
  await fireEvent.changeText(input, "similar draft")
  await press("Refresh filter metadata")
  await press("Toggle filter theme")
  expect(screen.getByLabelText("Filter Names refreshed by similar text")).toBe(input)
  expect(input).toHaveDisplayValue("similar draft")
  await press("Apply filter draft")
  expect(state().lastRequest.filterGroups[1].clauses[0]).toMatchObject({
    operationCode: "similar-to",
    argument: "similar draft",
  })
  expect(state().confirmed.filterGroups[1].clauses[0].argument).toEqual(["Alpha"])
})

it("keeps the canonical typeahead placeholders explicit through actual criterion/operation changes", async () => {
  await render(<FilterControlProbe />)
  await select("filter-probe-status-clause", "Filter Criteria", "Search labels")
  expect(screen.getByTestId("filter-typeahead-placeholder")).toHaveTextContent(
    "placeholder: typeahead search not implemented yet",
  )
  await select("filter-probe-status-clause", "Filter Condition", "Included in")
  expect(screen.getByTestId("filter-multi-typeahead-placeholder")).toHaveTextContent(
    "placeholder: multi-typeahead search not implemented yet",
  )
  expect(state().draft.filterGroups.at(-1).clauses[0].argument).toEqual([])
  await press("Apply filter draft")
  expect(state().lastRequest.filterGroups.some((group: { criteriaID: string }) => group.criteriaID === "search")).toBe(
    false,
  )
})
