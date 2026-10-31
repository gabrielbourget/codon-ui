import { act, renderHook } from "@testing-library/react"
import { createRef, useState } from "react"
import { describe, expect, it, vi } from "vitest"

import type { TQueryFilterGroupDraft } from "../../Table/filterDraft"
import type { TTableFilterGroup } from "../../Table/queryTypes"
import {
  initState,
  rebaseFilterGroupDrafts,
  useCalibratedComponent,
  type TSortAndFilterPanelProps,
  type TSortAndFilterPanelSortInstruction,
} from "../helpers"

const sort = (id: string): TSortAndFilterPanelSortInstruction => ({
  id,
  criteriaID: id,
  criteriaName: id,
  sortDirection: "Ascending",
})
const criteria: TSortAndFilterPanelProps["possibleFilterCriteria"] = [
  { id: "name", name: "Name", dataType: "text", allowedOperationCodes: ["like"] },
]
const owner = (): TSortAndFilterPanelProps => ({
  isOpen: true,
  onOpenChange: vi.fn(),
  possibleSortCriteria: ["a", "b", "c", "d"].map((id) => ({ id, name: id })),
  possibleFilterCriteria: criteria,
  activeSorts: [],
  activeFilters: [],
  applyPendingSortAndFilterChanges: vi.fn(),
})
const useController = (props: TSortAndFilterPanelProps, draggedID = "a") => {
  const [state, setState] = useState(() => ({ ...initState, draggedID }))
  const [sortRef] = useState(() => createRef<HTMLDivElement>())
  const [filterRef] = useState(() => createRef<HTMLDivElement>())
  const controls = useCalibratedComponent({
    props,
    state,
    setState,
    selectNewSortCriteriaRef: sortRef,
    selectNewFilterCriteriaRef: filterRef,
  })
  return { state, controls }
}
const group = (): TQueryFilterGroupDraft & TTableFilterGroup => ({
  id: "group",
  criteriaID: "name",
  criteriaName: "Name",
  dataType: "text",
  joinOperator: "or",
  clauses: ["one", "two", "three"].map((id) => ({
    id,
    operationCode: "like",
    argument: id,
    filterArgumentSelectedKey: null,
  })),
})

describe("owner-confirmed query drafts", () => {
  it.each([
    ["a", "c", "before", ["b", "a", "c", "d"]],
    ["a", "c", "after", ["b", "c", "a", "d"]],
    ["d", "b", "before", ["a", "d", "b", "c"]],
    ["d", "b", "after", ["a", "b", "d", "c"]],
    ["a", "a", "after", ["a", "b", "c", "d"]],
    ["missing", "b", "before", ["a", "b", "c", "d"]],
    ["a", "missing", "after", ["a", "b", "c", "d"]],
  ] as const)("moves %s %s %s using current membership", async (source, target, position, expected) => {
    const props = owner()
    props.activeSorts = ["a", "b", "c", "d"].map(sort)
    Object.freeze(props.activeSorts)
    const { result } = renderHook(() => useController(props, source))
    await act(() =>
      result.current.controls.onSortParameterDrop({
        keys: new Set([source]),
        dropOperation: "move",
        target: { type: "item", key: target, dropPosition: position },
      }),
    )
    expect(result.current.state.sortParameterList.map((item) => item.id)).toEqual(expected)
    expect(props.activeSorts.map((item) => item.id)).toEqual(["a", "b", "c", "d"])
  })

  it("ignores an empty-list drop and an unsupported on-item position", async () => {
    const props = owner()
    const { result } = renderHook(() => useController(props))
    await act(() =>
      result.current.controls.onSortParameterDrop({
        keys: new Set(["a"]),
        dropOperation: "move",
        target: { type: "item", key: "b", dropPosition: "on" },
      }),
    )
    expect(result.current.state.sortParameterList).toEqual([])
  })

  it("does not confirm Apply when the owner holds empty snapshots and vetoes closure", async () => {
    const props = owner()
    const trace: string[] = []
    props.applyPendingSortAndFilterChanges = vi.fn(() => {
      trace.push("apply")
    })
    const close = vi.fn(() => {
      trace.push("close")
    })
    const { result } = renderHook(() => useController(props))
    await act(() => result.current.controls.onAddSortParameter("a"))
    await act(() => result.current.controls.onApplyPendingChanges(close))
    expect(result.current.state.previouslyAppliedSortParameterList).toBe(props.activeSorts)
    expect(result.current.state.sortParameterList.map((item) => item.id)).toEqual(["a"])
    await act(() => result.current.controls.onCancelPendingChanges(close))
    expect(result.current.state.sortParameterList).toBe(props.activeSorts)
    expect(trace).toEqual(["apply", "close", "close"])
  })

  it("uses the latest owner echo for Cancel, including a later empty snapshot", async () => {
    const props = owner()
    const { result, rerender } = renderHook(({ current }) => useController(current), {
      initialProps: { current: props },
    })
    await act(() => result.current.controls.onAddSortParameter("a"))
    const echoed = { ...props, activeSorts: [sort("b")] }
    rerender({ current: echoed })
    expect(result.current.state.sortParameterList).toBe(echoed.activeSorts)
    await act(() => result.current.controls.onAddSortParameter("c"))
    await act(() => result.current.controls.onCancelPendingChanges(vi.fn()))
    expect(result.current.state.sortParameterList).toBe(echoed.activeSorts)
    rerender({ current: { ...echoed, activeSorts: [] } })
    expect(result.current.state.sortParameterList).toEqual([])
  })

  it("preserves thrown Apply ordering and does not request closure", async () => {
    const props = owner()
    const error = new Error("owner rejected")
    props.applyPendingSortAndFilterChanges = () => {
      throw error
    }
    const close = vi.fn()
    const { result } = renderHook(() => useController(props))
    expect(() => result.current.controls.onApplyPendingChanges(close)).toThrow(error)
    expect(close).not.toHaveBeenCalled()
  })

  it("keeps pending sort and raw clause drafts through metadata-only replacement", async () => {
    const props = owner()
    props.activeFilters = [group()]
    const { result, rerender } = renderHook(({ current }) => useController(current), {
      initialProps: { current: props },
    })
    await act(() => result.current.controls.onAddSortParameter("a"))
    await act(() =>
      result.current.controls.onModifyFilterClause({
        newCriteriaID: "name",
        updatedClause: { ...result.current.state.filterGroupDrafts[0].clauses[0], argument: 0 },
      }),
    )
    const nextCriteria = [
      { ...criteria[0], name: "Renamed", availableCriteriaArguments: [{ id: "", name: "Zero", argumentValue: 0 }] },
    ]
    rerender({ current: { ...props, possibleFilterCriteria: nextCriteria } })
    expect(result.current.state.sortParameterList.map((item) => item.id)).toEqual(["a"])
    expect(result.current.state.filterGroupDrafts[0]).toMatchObject({
      id: "group",
      criteriaName: "Renamed",
      joinOperator: "or",
      clauses: [{ id: "one", argument: 0, filterArgumentSelectedKey: "" }, { id: "two" }, { id: "three" }],
    })
    expect(result.current.state.filterGroupDrafts[0].availableFilterArguments).toBe(
      nextCriteria[0].availableCriteriaArguments,
    )
    expect(props.activeFilters?.[0].clauses[0].argument).toBe("one")
  })

  it("replaces same-criterion clauses in place and appends deliberate criterion moves", async () => {
    const props = owner()
    props.activeFilters = [group()]
    props.possibleFilterCriteria = [...criteria, { ...criteria[0], id: "other" }]
    const { result } = renderHook(() => useController(props))
    const clause = { ...result.current.state.filterGroupDrafts[0].clauses[0], argument: "edited" }
    await act(() => result.current.controls.onModifyFilterClause({ newCriteriaID: "name", updatedClause: clause }))
    expect(result.current.state.filterGroupDrafts[0].clauses.map((item) => item.id)).toEqual(["one", "two", "three"])
    await act(() => result.current.controls.onModifyFilterClause({ newCriteriaID: "other", updatedClause: clause }))
    expect(result.current.state.filterGroupDrafts.map((item) => item.clauses.map((item) => item.id))).toEqual([
      ["two", "three"],
      ["one"],
    ])
    const unchanged = result.current.state.filterGroupDrafts
    await act(() =>
      result.current.controls.onModifyFilterClause({
        newCriteriaID: "name",
        updatedClause: { id: "deleted", argument: false },
      }),
    )
    await act(() => result.current.controls.onModifyFilterClause({ newCriteriaID: "deleted", updatedClause: clause }))
    expect(result.current.state.filterGroupDrafts).toBe(unchanged)
  })

  it("keeps unavailable groups and raw false/zero/empty/null metadata drafts without normalization", () => {
    const source: TQueryFilterGroupDraft = group()
    source.clauses = [false, 0, "", null].map((argument, index) => ({
      id: String(index),
      argument,
      filterArgumentSelectedKey: null,
    }))
    const missing = { ...group(), criteriaID: "missing" }
    const input = [source, missing]
    expect(rebaseFilterGroupDrafts(input, criteria)).toBe(input)
    const result = rebaseFilterGroupDrafts(input, [{ ...criteria[0], name: "New" }])
    expect(result[0].clauses).toBe(source.clauses)
    expect(result[1]).toBe(missing)
    expect(result[0].clauses.map((item) => item.argument)).toEqual([false, 0, "", null])
  })
})
