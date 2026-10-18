import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"

import { act, renderHook } from "@testing-library/react"
import { createRef, useState } from "react"
import { useListData } from "react-stately"
import { afterAll, expect, it, vi } from "vitest"

import {
  initState,
  useCalibratedComponent,
  type TSortAndFilterPanelProps,
  type TSortAndFilterPanelSortInstruction,
  type TSortAndFilterPanelState,
} from "../../../../packages/react/src/components/SortAndFilterPanel/helpers"

const instruction = (id: string): TSortAndFilterPanelSortInstruction => ({
  id,
  criteriaID: id,
  criteriaName: id,
  queryKey: `items.${id}`,
  sortDirection: "Ascending",
})
const possibleSortCriteria = ["a", "b", "c", "d"].map((id) => ({ id, name: id, queryKey: `items.${id}` }))
const possibleFilterCriteria: TSortAndFilterPanelProps["possibleFilterCriteria"] = [
  { id: "name", name: "Name", dataType: "text", allowedOperationCodes: ["like"] },
]
const report: Record<string, unknown> = {
  kind: "Canonical browser controller observations; no browser drag hit-testing or native execution",
  canonicalHelpersSHA256: createHash("sha256")
    .update(readFileSync("src/components/SortAndFilterPanel/helpers.ts"))
    .digest("hex"),
}
const useObservedController = (props: TSortAndFilterPanelProps, draggedID: string) => {
  const [state, setState] = useState<TSortAndFilterPanelState>(() => ({ ...initState, draggedID }))
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
const propsFor = (activeSorts: TSortAndFilterPanelSortInstruction[]): TSortAndFilterPanelProps => ({
  isOpen: true,
  onOpenChange: vi.fn(),
  possibleSortCriteria,
  possibleFilterCriteria,
  activeSorts,
  activeFilters: [],
  applyPendingSortAndFilterChanges: vi.fn(),
})

it("records each relative reorder outcome against the installed React Stately list operation", async () => {
  const cases: unknown[] = []
  for (const dragged of ["a", "b", "c", "d"])
    for (const target of ["a", "b", "c", "d"])
      for (const position of ["before", "after"] as const) {
        const applied = ["a", "b", "c", "d"].map(instruction)
        const props = propsFor(applied)
        const { result, unmount } = renderHook(() => ({
          ...useObservedController(props, dragged),
          reference: useListData({ initialItems: applied, getKey: (item) => item.id }),
        }))
        await act(() => {
          result.current.controls.onSortParameterDrop({
            keys: new Set([dragged]),
            dropOperation: "move",
            target: { type: "item", key: target, dropPosition: position },
          })
          if (position === "before") result.current.reference.moveBefore(target, new Set([dragged]))
          else result.current.reference.moveAfter(target, new Set([dragged]))
        })
        const observed = result.current.state.sortParameterList.map((item) => item.id)
        const reference = result.current.reference.items.map((item) => item.id)
        expect(applied.map((item) => item.id)).toEqual(["a", "b", "c", "d"])
        expect(observed).toEqual(reference)
        cases.push({
          dragged,
          target,
          position,
          observed,
          reference,
          agrees: JSON.stringify(observed) === JSON.stringify(reference),
        })
        unmount()
      }
  report.reorder = cases
  expect(cases).toHaveLength(32)
})

it("records Apply and Cancel while the owner retains applied props and declines closure", async () => {
  const applied: TSortAndFilterPanelSortInstruction[] = []
  const order: string[] = []
  const props = propsFor(applied)
  props.applyPendingSortAndFilterChanges = vi.fn(() => {
    order.push("apply")
  })
  props.onOpenChange = vi.fn(() => {
    order.push("close-request")
  })
  const close = () => props.onOpenChange(false)
  const { result, unmount } = renderHook(() => useObservedController(props, ""))
  await act(() => result.current.controls.onAddSortParameter("a"))
  await act(() => result.current.controls.onApplyPendingChanges(close))
  const afterApplyBaseline = result.current.state.previouslyAppliedSortParameterList.map((item) => item.id)
  await act(() => result.current.controls.onClearAllSortAndFilterParameters())
  await act(() => result.current.controls.onCancelPendingChanges(close))
  expect(applied).toEqual([])
  expect(afterApplyBaseline).toEqual([])
  expect(result.current.state.sortParameterList).toEqual([])
  expect(order).toEqual(["apply", "close-request", "close-request"])
  report.heldOwner = {
    ownerApplied: applied.map((item) => item.id),
    afterApplyBaseline,
    afterCancelDraft: result.current.state.sortParameterList.map((item) => item.id),
    open: props.isOpen,
    callbackOrder: order,
  }
  unmount()
})

it("records an equivalent metadata-array replacement during an uncommitted draft", async () => {
  const props = propsFor([])
  const { result, rerender, unmount } = renderHook(({ owner }) => useObservedController(owner, ""), {
    initialProps: { owner: props },
  })
  await act(() => result.current.controls.onAddSortParameter("a"))
  const before = result.current.state.sortParameterList.map((item) => item.id)
  await rerender({ owner: { ...props, possibleFilterCriteria: [...props.possibleFilterCriteria] } })
  expect(result.current.state.sortParameterList.map((item) => item.id)).toEqual(before)
  report.metadataReplacement = {
    before,
    after: result.current.state.sortParameterList.map((item) => item.id),
    ownerApplied: props.activeSorts,
  }
  unmount()
})

it("records clause order after editing a clause inside its existing criterion", async () => {
  const props = propsFor([])
  props.activeFilters = [
    {
      id: "group",
      criteriaID: "name",
      criteriaName: "Name",
      dataType: "text",
      joinOperator: "and",
      clauses: ["one", "two", "three"].map((id) => ({ id, operationCode: "like", argument: id })),
    },
  ]
  const { result, unmount } = renderHook(() => useObservedController(props, ""))
  const before = result.current.state.filterGroupDrafts[0].clauses.map((clause) => clause.id)
  await act(() =>
    result.current.controls.onModifyFilterClause({
      newCriteriaID: "name",
      updatedClause: { ...result.current.state.filterGroupDrafts[0].clauses[0], argument: "edited" },
    }),
  )
  expect(result.current.state.filterGroupDrafts[0].clauses.map((clause) => clause.id)).toEqual(before)
  report.clauseEditOrder = {
    before,
    after: result.current.state.filterGroupDrafts[0].clauses.map((clause) => clause.id),
  }
  unmount()
})

it("records stale membership requests without claiming a browser or native delivery verdict", async () => {
  const records = []
  for (const input of [
    { source: "missing", target: "c", items: ["a", "b", "c", "d"] },
    { source: "a", target: "missing", items: ["a", "b", "c", "d"] },
    { source: "a", target: "c", items: [] },
  ]) {
    const props = propsFor(input.items.map(instruction))
    const { result, unmount } = renderHook(() => useObservedController(props, input.source))
    try {
      await act(() =>
        result.current.controls.onSortParameterDrop({
          keys: new Set([input.source]),
          dropOperation: "move",
          target: { type: "item", key: input.target, dropPosition: "before" },
        }),
      )
      expect(result.current.state.sortParameterList.map((item) => item.id)).toEqual(input.items)
      records.push({ ...input, observed: result.current.state.sortParameterList.map((item) => item?.id ?? null) })
    } catch (error) {
      expect(error).toBeUndefined()
      records.push({
        ...input,
        error: error instanceof Error ? { name: error.name, message: error.message } : String(error),
      })
    }
    unmount()
  }
  report.staleMembership = records
})

afterAll(() => {
  const target = process.env.CODON_QUERY_CONTROLLER_ORACLE_OUTPUT
  if (!target?.startsWith("/private/tmp/codon-native-query-commands-"))
    throw new Error("Use a mutable task-owned /private/tmp oracle output")
  writeFileSync(target, JSON.stringify(report, null, 2) + "\n")
})
