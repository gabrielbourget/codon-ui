import { act, renderHook } from "@testing-library/react-native"

import type { TTableSortInstruction } from "../../Table/queryTypes"
import { useNativeQueryDraftController, type TNativeQueryControllerProps } from "../controller"

const sort = (id: string): TTableSortInstruction => ({
  id,
  criteriaID: id,
  criteriaName: id,
  sortDirection: "Ascending",
})
const owner = (): TNativeQueryControllerProps => ({
  isOpen: true,
  activeSorts: [],
  activeFilters: [],
  possibleSortCriteria: ["a", "b", "c"].map((id) => ({ id, name: id })),
  possibleFilterCriteria: [
    { id: "amount", name: "Amount", dataType: "number", allowedOperationCodes: ["equal", "between"] },
  ],
  applyPendingSortAndFilterChanges: jest.fn(),
  onOpenChange: jest.fn(),
})

it("CANON.query-controller.002 leaves a held owner's empty snapshots unconfirmed through repeated Apply/Cancel", async () => {
  const props = owner()
  const trace: string[] = []
  props.applyPendingSortAndFilterChanges = jest.fn(() => {
    trace.push("apply")
  })
  props.onOpenChange = jest.fn(() => {
    trace.push("close")
  })
  const { result } = await renderHook(useNativeQueryDraftController, { initialProps: props })
  await act(() => result.current.addSort("a"))
  await act(() => result.current.apply())
  await act(() => result.current.apply())
  expect(result.current.draft.sortInstructions.map((item) => item.id)).toEqual(["a"])
  expect(props.activeSorts).toEqual([])
  await act(() => result.current.clear())
  await act(() => result.current.cancel())
  expect(result.current.draft.sortInstructions).toBe(props.activeSorts)
  expect(result.current.draft.filterGroups).toEqual([])
  expect(trace).toEqual(["apply", "close", "apply", "close", "close"])
})

it("hydrates actual owner echoes and restores the latest confirmed sort/filter snapshots", async () => {
  const props = owner()
  const { result, rerender } = await renderHook(useNativeQueryDraftController, { initialProps: props })
  await act(() => result.current.addSort("a"))
  const next: TNativeQueryControllerProps = {
    ...props,
    activeSorts: [sort("b")],
    activeFilters: [
      {
        id: "group",
        criteriaID: "amount",
        criteriaName: "Old",
        dataType: "number",
        joinOperator: "or",
        clauses: [{ id: "clause", operationCode: "equal", argument: 0 }],
      },
    ],
  }
  await rerender(next)
  expect(result.current.draft.sortInstructions).toBe(next.activeSorts)
  await act(() => {
    result.current.clear()
    result.current.addSort("c")
  })
  await act(() => result.current.cancel())
  expect(result.current.draft.sortInstructions).toBe(next.activeSorts)
  expect(result.current.draft.filterGroups[0]).toMatchObject({
    id: "group",
    criteriaName: "Amount",
    joinOperator: "or",
    clauses: [{ id: "clause", argument: 0 }],
  })
  await rerender({ ...next, activeSorts: [], activeFilters: [] })
  expect(result.current.draft).toEqual({ sortInstructions: [], filterGroups: [] })
})

it("keeps omitted applied props as the stable empty baseline rather than adopting local edits", async () => {
  const props = { ...owner(), activeSorts: undefined, activeFilters: undefined }
  const { result, rerender } = await renderHook(useNativeQueryDraftController, { initialProps: props })
  await act(() => result.current.addSort("a"))
  await rerender({ ...props })
  expect(result.current.draft.sortInstructions.map((item) => item.id)).toEqual(["a"])
  await act(() => result.current.apply())
  await act(() => result.current.cancel())
  expect(result.current.draft).toEqual({ sortInstructions: [], filterGroups: [] })
})

it("CANON.query-controller.003 preserves dirty sorts/raw clauses through metadata replacement/removal/reinsertion", async () => {
  const props = owner()
  const { result, rerender } = await renderHook(useNativeQueryDraftController, { initialProps: props })
  await act(() => {
    result.current.addSort("a")
    result.current.addFilter("amount")
  })
  const first = result.current.draft.filterGroups[0].clauses[0]
  await act(() =>
    result.current.modifyFilterClause({ newCriteriaID: "amount", updatedClause: { ...first, argument: false } }),
  )
  const nextCriteria = [
    {
      ...props.possibleFilterCriteria[0],
      name: "Renamed",
      availableCriteriaArguments: [{ id: "", name: "False", argumentValue: false }],
    },
  ]
  await rerender({ ...props, possibleFilterCriteria: nextCriteria })
  expect(result.current.draft.sortInstructions.map((item) => item.id)).toEqual(["a"])
  expect(result.current.draft.filterGroups[0]).toMatchObject({
    criteriaName: "Renamed",
    clauses: [{ id: first.id, argument: false, filterArgumentSelectedKey: "" }],
  })
  const preserved = result.current.draft
  await rerender({ ...props, possibleFilterCriteria: [] })
  expect(result.current.draft).toBe(preserved)
  await rerender({ ...props, possibleFilterCriteria: nextCriteria })
  expect(result.current.draft).toBe(preserved)
})

it("composes batched current-entity commands without losing earlier edits", async () => {
  const { result } = await renderHook(useNativeQueryDraftController, { initialProps: owner() })
  await act(() => {
    result.current.addSort("a")
    result.current.addSort("b")
    result.current.addSort("a")
    result.current.setSortDirection("a", "Descending")
    result.current.reorderSort("a", "b", "after")
    result.current.addFilter("amount")
    result.current.addFilter("amount")
    result.current.setFilterJoin("amount", "or")
  })
  expect(result.current.draft.sortInstructions.map((item) => [item.id, item.sortDirection])).toEqual([
    ["b", "Ascending"],
    ["a", "Descending"],
  ])
  expect(result.current.draft.filterGroups[0]).toMatchObject({
    joinOperator: "or",
    clauses: [{ operationCode: "equal" }, { operationCode: "between" }],
  })
  expect(result.current.availableSortCriteria.map((item) => item.id)).toEqual(["c"])
  await act(() => result.current.modifySort("b", "c"))
  await act(() => result.current.removeSort("a"))
  const clauseID = result.current.draft.filterGroups[0].clauses[0].id
  await act(() => result.current.removeFilterClause(clauseID))
  expect(result.current.draft.sortInstructions.map((item) => item.id)).toEqual(["c"])
  expect(result.current.draft.filterGroups[0].clauses).toHaveLength(1)
})

it("normalizes only the Apply payload, retaining incomplete drafts and false/zero values", async () => {
  const props = owner()
  const { result } = await renderHook(useNativeQueryDraftController, { initialProps: props })
  await act(() => result.current.addFilter("amount"))
  const first = result.current.draft.filterGroups[0].clauses[0]
  await act(() => {
    result.current.modifyFilterClause({ newCriteriaID: "amount", updatedClause: { ...first, argument: 0 } })
    result.current.addFilter("amount")
  })
  const before = result.current.draft
  await act(() => result.current.apply())
  expect(props.applyPendingSortAndFilterChanges).toHaveBeenCalledWith({
    sortInstructions: [],
    filterGroups: [
      {
        id: "amount",
        criteriaID: "amount",
        criteriaName: "Amount",
        queryKey: undefined,
        dataType: "number",
        joinOperator: "and",
        clauses: [{ id: first.id, operationCode: "equal", argument: 0 }],
      },
    ],
  })
  expect(result.current.draft).toBe(before)
  expect(result.current.draft.filterGroups[0].clauses[1].argument).toEqual(["", ""])
})

it("uses current callbacks/metadata from retained controls rather than their originating render", async () => {
  const props = owner()
  const { result, rerender } = await renderHook(useNativeQueryDraftController, { initialProps: props })
  const retained = result.current
  const next = {
    ...props,
    possibleSortCriteria: [{ id: "current", name: "Current" }],
    applyPendingSortAndFilterChanges: jest.fn(),
    onOpenChange: jest.fn(),
  }
  await rerender(next)
  await act(() => retained.addSort("a"))
  await act(() => retained.addSort("current"))
  await act(() => retained.apply())
  expect(next.applyPendingSortAndFilterChanges).toHaveBeenCalledWith({
    sortInstructions: [expect.objectContaining({ id: "current" })],
    filterGroups: [],
  })
  expect(next.onOpenChange).toHaveBeenCalledWith(false)
  expect(props.applyPendingSortAndFilterChanges).not.toHaveBeenCalled()
  expect(props.onOpenChange).not.toHaveBeenCalled()
})

it("does not request closure after Apply throws", async () => {
  const props = owner()
  const error = new Error("owner rejection")
  props.applyPendingSortAndFilterChanges = () => {
    throw error
  }
  const { result } = await renderHook(useNativeQueryDraftController, { initialProps: props })
  expect(() => result.current.apply()).toThrow(error)
  expect(props.onOpenChange).not.toHaveBeenCalled()
})

it("rechecks scope after Apply before requesting closure", async () => {
  const props = owner()
  let active = true
  props.canAct = () => active
  props.applyPendingSortAndFilterChanges = jest.fn(() => {
    active = false
  })
  const { result } = await renderHook(useNativeQueryDraftController, { initialProps: props })
  await act(() => result.current.apply())
  expect(props.applyPendingSortAndFilterChanges).toHaveBeenCalledTimes(1)
  expect(props.onOpenChange).not.toHaveBeenCalled()
})

it.each(["closed", "inactive", "unmounted"] as const)(
  "rejects retained commands and requests while %s",
  async (condition) => {
    const props = owner()
    const { result, rerender, unmount } = await renderHook(useNativeQueryDraftController, { initialProps: props })
    const retained = result.current
    if (condition === "closed") await rerender({ ...props, isOpen: false })
    else if (condition === "inactive") await rerender({ ...props, canAct: () => false })
    else await unmount()
    await act(() => {
      retained.addSort("a")
      retained.clear()
      retained.cancel()
      retained.apply()
    })
    expect(props.applyPendingSortAndFilterChanges).not.toHaveBeenCalled()
    expect(props.onOpenChange).not.toHaveBeenCalled()
    if (condition !== "unmounted") expect(result.current.draft).toBe(retained.draft)
  },
)

it("rehydrates owner snapshots when a vetoed draft is closed and later reopened", async () => {
  const props = owner()
  const { result, rerender } = await renderHook(useNativeQueryDraftController, { initialProps: props })
  await act(() => result.current.addSort("a"))
  await rerender({ ...props, isOpen: false })
  await rerender(props)
  expect(result.current.draft.sortInstructions).toBe(props.activeSorts)
})
