import type { TQueryFilterGroupDraft } from "../../Table/filterDraft"
import { getFilterClauseFormFieldIds } from "../metadata"

const group: TQueryFilterGroupDraft = {
  id: "group:1",
  criteriaID: "criterion",
  criteriaName: "Criterion",
  dataType: "date",
  joinOperator: "and",
  clauses: [
    { id: "clause:1", operationCode: "between" },
    { id: "clause:2", operationCode: "equal" },
  ],
}
const order = (draft: TQueryFilterGroupDraft) =>
  draft.clauses.flatMap((clause) => getFilterClauseFormFieldIds(draft, clause))

it("uses stable group/clause identities while order follows the explicit clause model", () => {
  const original = order(group)
  expect(original).toEqual([
    '["filter-argument","group:1","clause:1","minimum"]',
    '["filter-argument","group:1","clause:1","maximum"]',
    '["filter-argument","group:1","clause:2","value"]',
  ])
  expect(order({ ...group, clauses: [...group.clauses].reverse() })).toEqual([original[2], original[0], original[1]])
  expect(order({ ...group, clauses: [group.clauses[1]] })).toEqual([original[2]])
  expect(order({ ...group, id: "group%3A1" })).not.toEqual(original)
})
it("declares only the query editor for text multi-select and retires it when metadata changes", () => {
  const selected = {
    ...group,
    dataType: "text" as const,
    usesSelectInput: true,
    clauses: [{ id: "options", operationCode: "in" as const, conditionType: "Multi-Select" as const }],
  }
  expect(order(selected)).toEqual(['["filter-argument","group:1","options","query"]'])
  expect(order({ ...selected, clauses: [{ ...selected.clauses[0], conditionType: "List" }] })).toEqual([])
})
it.each(["text", "number", "boolean"] as const)(
  "does not declare ordinary %s editors as registered fields",
  (dataType) => {
    expect(order({ ...group, dataType })).toEqual([])
  },
)
it("keeps ordinary Select, standalone ComboBox, list and unsupported kinds out of the field order", () => {
  for (const metadata of [{ usesSelectInput: true }, { usesComboBoxInput: true }, { usesTypeAheadInput: true }])
    expect(order({ ...group, ...metadata, dataType: "text" })).toEqual([])
  expect(order({ ...group, clauses: [{ id: "a", operationCode: "in" }, { id: "b" }] })).toEqual([])
})
