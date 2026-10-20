import { fireEvent, render, screen } from "@testing-library/react-native"

import QueryProbe from "./fixtures/QueryProbe"

const press = async (name: string) => fireEvent.press(screen.getByRole("button", { name }))
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
