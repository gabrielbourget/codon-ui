import { normalizeDraftToQueryFilterGroups, type TQueryFilterGroupDraft } from "../filterDraft"
import type { TTableFilterDraftArgumentValue, TTableFilterOperationCode } from "../queryTypes"

const group = (
  argument: TTableFilterDraftArgumentValue,
  operationCode: TTableFilterOperationCode = "equal",
): TQueryFilterGroupDraft => ({
  id: "group",
  criteriaID: "criterion",
  criteriaName: "Numbers",
  dataType: "number",
  joinOperator: "and",
  clauses: [{ id: "clause", operationCode, argument }],
})
it.each([NaN, Infinity, -Infinity, null, undefined, " "])("omits incomplete/non-finite scalar %s", (argument) => {
  expect(normalizeDraftToQueryFilterGroups(group(argument))).toEqual([])
})
it.each([0, -3, false, " value "])("preserves a meaningful scalar %s", (argument) => {
  expect(normalizeDraftToQueryFilterGroups(group(argument))[0].clauses[0].argument).toEqual(
    typeof argument === "string" ? "value" : argument,
  )
})
it("normalizes mixed arrays without changing the raw draft or reordering values", () => {
  const argument = [" a ", NaN, 0, Infinity, null, undefined, "", -2, " b "]
  Object.freeze(argument)
  const draft = group(argument, "in")
  expect(normalizeDraftToQueryFilterGroups(draft)[0].clauses[0].argument).toEqual(["a", 0, -2, "b"])
  expect(draft.clauses[0].argument).toBe(argument)
  expect(argument).toEqual([" a ", NaN, 0, Infinity, null, undefined, "", -2, " b "])
})
it.each([[undefined, 1], [0, null], [NaN, 1], [0, Infinity], [], [0]])(
  "omits incomplete between bounds %p",
  (...argument) => {
    expect(normalizeDraftToQueryFilterGroups(group(argument, "between"))).toEqual([])
  },
)
it("preserves complete mixed between bounds and ignores extra entries as before", () => {
  expect(normalizeDraftToQueryFilterGroups(group([0, " upper ", 8], "between"))[0].clauses[0].argument).toEqual([
    0,
    "upper",
  ])
})
