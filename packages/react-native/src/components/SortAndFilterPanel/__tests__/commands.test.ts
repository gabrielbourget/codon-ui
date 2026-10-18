import { createQueryFilterGroupDraftFromCriteria, type TQueryFilterGroupDraft } from "../../Table/filterDraft"
import type { TAvailableFilterCriteria, TAvailableSortCriteria } from "../../Table/filterMetadata"
import type { TTableSortInstruction } from "../../Table/queryTypes"
import {
  addFilter,
  addSort,
  availableSortCriteria,
  clearDraft,
  modifyFilterClause,
  modifySort,
  removeFilterClause,
  removeSort,
  reorderSort,
  setFilterJoin,
  setSortDirection,
} from "../commands"
import { rebaseFilterGroupDrafts } from "../hydration"

const freeze = <T>(value: T): T => {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}
const sort = (id: string): TTableSortInstruction => ({
  id,
  criteriaID: id,
  criteriaName: id,
  sortDirection: "Ascending",
})
const filter: TAvailableFilterCriteria = {
  id: "quantity",
  name: "Quantity",
  dataType: "number",
  allowedOperationCodes: ["equal", "between"],
}
const draftGroup = (): TQueryFilterGroupDraft => ({
  ...createQueryFilterGroupDraftFromCriteria(filter),
  clauses: [
    { id: "one", operationCode: "equal", argument: 0 },
    { id: "two", operationCode: "equal", argument: false },
    { id: "three", operationCode: "equal", argument: "" },
  ],
})

it("CAP.query-command.001/.002 adds current metadata and modifies in place without changing direction", () => {
  const criteria = freeze<TAvailableSortCriteria[]>([
    { id: "", name: "", queryKey: "", defaultDirection: "Descending" },
    { id: "b", name: "B" },
  ])
  const empty: TTableSortInstruction[] = freeze([])
  expect(addSort(empty, criteria, "missing")).toBe(empty)
  const added = freeze(addSort(empty, criteria, ""))
  expect(added[0]).toEqual({ id: "", criteriaID: "", criteriaName: "", queryKey: "", sortDirection: "Descending" })
  expect(addSort(added, criteria, "")).toBe(added)
  const changed = modifySort(added, criteria, "", "b")
  expect(changed[0]).toEqual({
    id: "b",
    criteriaID: "b",
    criteriaName: "B",
    queryKey: undefined,
    sortDirection: "Descending",
  })
  expect(added[0].id).toBe("")
  expect(modifySort(added, criteria, "missing", "b")).toBe(added)
  expect(modifySort(added, criteria, "", "missing")).toBe(added)
  const both = freeze([...added, sort("b")])
  expect(modifySort(both, criteria, "", "b")).toBe(both)
  expect(addSort([], criteria, "b")[0].sortDirection).toBe("Ascending")
})

it("CAP.query-command.003/.004/.009 preserves unchanged sort rows and caller metadata order", () => {
  const source = freeze([sort("a"), sort("b")])
  expect(setSortDirection(source, "missing", "Descending")).toBe(source)
  expect(setSortDirection(source, "a", "Ascending")).toBe(source)
  const changed = setSortDirection(source, "a", "Descending")
  expect(changed[0].sortDirection).toBe("Descending")
  expect(changed[1]).toBe(source[1])
  expect(removeSort(source, "missing")).toBe(source)
  expect(removeSort(source, "a")).toEqual([source[1]])
  const criteria = freeze(["c", "a", "d", "b"].map((id) => ({ id, name: id })))
  expect(availableSortCriteria(source, criteria)).toEqual([criteria[0], criteria[2]])
  expect(availableSortCriteria(source, criteria)[0]).toBe(criteria[0])
})

it.each([
  ["a", "a", "abcd", "abcd"],
  ["a", "b", "abcd", "bacd"],
  ["a", "c", "bacd", "bcad"],
  ["a", "d", "bcad", "bcda"],
  ["b", "a", "bacd", "abcd"],
  ["b", "b", "abcd", "abcd"],
  ["b", "c", "abcd", "acbd"],
  ["b", "d", "acbd", "acdb"],
  ["c", "a", "cabd", "acbd"],
  ["c", "b", "acbd", "abcd"],
  ["c", "c", "abcd", "abcd"],
  ["c", "d", "abcd", "abdc"],
  ["d", "a", "dabc", "adbc"],
  ["d", "b", "adbc", "abdc"],
  ["d", "c", "abdc", "abcd"],
  ["d", "d", "abcd", "abcd"],
])("CANON.query-controller.001 reorders %s relative to %s in both positions", (sourceID, targetID, before, after) => {
  const source = freeze(["a", "b", "c", "d"].map(sort))
  expect(
    reorderSort(source, sourceID, targetID, "before")
      .map((item) => item.id)
      .join(""),
  ).toBe(before)
  expect(
    reorderSort(source, sourceID, targetID, "after")
      .map((item) => item.id)
      .join(""),
  ).toBe(after)
  expect(source.map((item) => item.id)).toEqual(["a", "b", "c", "d"])
})

it("CANON.query-controller.001 rejects stale/empty membership and supports an empty ID", () => {
  const source = freeze([sort(""), sort("b")])
  expect(reorderSort(source, "missing", "b", "before")).toBe(source)
  expect(reorderSort(source, "", "missing", "after")).toBe(source)
  const empty = freeze<TTableSortInstruction[]>([])
  expect(reorderSort(empty, "a", "b", "before")).toBe(empty)
  expect(reorderSort(source, "", "b", "after")).toEqual([source[1], source[0]])
})

it("CAP.query-command.005 appends canonical operation order without normalizing retained raw values", () => {
  const source = freeze([draftGroup()])
  expect(addFilter(source, [filter], "missing")).toBe(source)
  const next = addFilter(source, [filter], "quantity")
  expect(next[0].clauses.at(-1)).toMatchObject({ operationCode: "between", argument: ["", ""] })
  expect(next[0].clauses.slice(0, 3)).toEqual(source[0].clauses)
  expect(next[0].clauses[0]).toBe(source[0].clauses[0])
  expect(addFilter(source, [{ ...filter, allowedOperationCodes: [] }], "quantity")).toBe(source)
  expect(addFilter([], [filter], "quantity")[0].clauses[0].operationCode).toBe("equal")
})

it("CAP.query-command.006/.007 removes only current clauses, cleans empty groups and changes the requested join", () => {
  const other = { ...draftGroup(), id: "other", criteriaID: "other", clauses: [{ id: "other-clause", argument: null }] }
  const source = freeze([draftGroup(), other])
  expect(removeFilterClause(source, "missing")).toBe(source)
  expect(removeFilterClause(source, "other-clause")).toEqual([source[0]])
  const removed = removeFilterClause(source, "two")
  expect(removed[0].clauses.map((item) => item.id)).toEqual(["one", "three"])
  expect(removed[1]).toBe(other)
  expect(setFilterJoin(source, "missing", "or")).toBe(source)
  expect(setFilterJoin(source, "quantity", "and")).toBe(source)
  const joined = setFilterJoin(source, "quantity", "or")
  expect(joined[0].joinOperator).toBe("or")
  expect(joined[0].clauses).toBe(source[0].clauses)
  expect(joined[1]).toBe(source[1])
})

it("CANON.query-controller.004 replaces a clause in place, and deliberately moves to the end of a current target", () => {
  const otherCriteria = { ...filter, id: "other" }
  const other = createQueryFilterGroupDraftFromCriteria(otherCriteria)
  const source = freeze([draftGroup(), other])
  const updatedClause = { ...source[0].clauses[0], argument: false }
  const edited = modifyFilterClause(source, [filter], { updatedClause, newCriteriaID: "quantity" })
  expect(edited[0].clauses.map((item) => item.id)).toEqual(["one", "two", "three"])
  expect(edited[0].clauses[0]).toBe(updatedClause)
  expect(edited[1]).toBe(other)
  expect(modifyFilterClause(source, [filter], { updatedClause: { id: "deleted" }, newCriteriaID: "quantity" })).toBe(
    source,
  )
  expect(modifyFilterClause(source, [filter], { updatedClause, newCriteriaID: "deleted" })).toBe(source)
  const moved = modifyFilterClause(source, [filter, otherCriteria], { updatedClause, newCriteriaID: "other" })
  expect(moved[0].clauses.map((item) => item.id)).toEqual(["two", "three"])
  expect(moved[1].clauses.at(-1)).toBe(updatedClause)
  const newGroup = modifyFilterClause([source[0]], [filter, otherCriteria], { updatedClause, newCriteriaID: "other" })
  expect(newGroup[1]).toMatchObject({ criteriaID: "other", clauses: [updatedClause] })
})

it("CANON.query-controller.003 rebases metadata without losing absent groups or raw drafts", () => {
  const callback = jest.fn()
  const source = freeze([draftGroup(), { ...draftGroup(), id: "absent", criteriaID: "absent" }])
  const options = [
    { id: "", name: "Zero", argumentValue: 0 },
    { id: "false", name: "False", argumentValue: false },
  ]
  const nextCriteria = {
    ...filter,
    name: "New",
    queryKey: "",
    usesSelectInput: false,
    typeAheadInputOnChange: callback,
    availableCriteriaArguments: options,
  }
  const rebased = rebaseFilterGroupDrafts(source, [nextCriteria])
  expect(rebased[0]).toMatchObject({
    id: source[0].id,
    criteriaName: "New",
    queryKey: "",
    usesSelectInput: false,
    clauses: [
      { id: "one", argument: 0, filterArgumentSelectedKey: "" },
      { id: "two", argument: false, filterArgumentSelectedKey: "false" },
      { id: "three", argument: "", filterArgumentSelectedKey: null },
    ],
  })
  expect(rebased[0].availableFilterArguments).toBe(options)
  expect(rebased[0].typeAheadInputOnChange).toBe(callback)
  expect(rebased[1]).toBe(source[1])
  expect(rebaseFilterGroupDrafts(rebased, [nextCriteria])).toBe(rebased)
  expect(rebaseFilterGroupDrafts(rebased, [])).toBe(rebased)
  expect(callback).not.toHaveBeenCalled()
})

it("CAP.query-command.008 clears local lists without editing applied or source drafts", () => {
  const source = freeze({ sortInstructions: [sort("a")], filterGroups: [draftGroup()] })
  expect(clearDraft(source)).toEqual({ sortInstructions: [], filterGroups: [] })
  expect(source.sortInstructions).toHaveLength(1)
  expect(source.filterGroups[0].clauses).toHaveLength(3)
  const empty = freeze({ sortInstructions: [], filterGroups: [] })
  expect(clearDraft(empty)).toBe(empty)
})
