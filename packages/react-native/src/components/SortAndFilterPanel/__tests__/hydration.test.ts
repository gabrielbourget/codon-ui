import type { TAvailableFilterCriteria } from "../../Table/filterMetadata"
import type { TTableFilterArgumentValue, TTableFilterGroup } from "../../Table/queryTypes"
import { buildFilterGroupDraftsFromQueryFilterGroups } from "../hydration"

const freeze = <T>(value: T): T => {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}
const group = (argument: TTableFilterArgumentValue): TTableFilterGroup => ({
  id: "applied-group",
  criteriaID: "status",
  criteriaName: "Old label",
  queryKey: "old.status",
  dataType: "number",
  joinOperator: "or",
  clauses: [{ id: "applied-clause", operationCode: "equal", argument }],
})
const criteria: TAvailableFilterCriteria = {
  id: "status",
  name: "Status",
  queryKey: "events.status",
  dataType: "text",
  allowedOperationCodes: ["equal"],
  usesSelectInput: true,
  availableCriteriaArguments: [{ id: "upcoming", name: "Upcoming", argumentValue: "scheduled" }],
}

it("CAP.query-draft.012 hydrates select-backed arguments from the applied snapshot using current criteria metadata", () => {
  const applied = freeze(group("scheduled"))
  const metadata = freeze(criteria)
  expect(buildFilterGroupDraftsFromQueryFilterGroups([applied], [metadata])).toEqual([
    {
      id: "applied-group",
      criteriaID: "status",
      criteriaName: "Status",
      queryKey: "events.status",
      dataType: "text",
      joinOperator: "or",
      usesTypeAheadInput: undefined,
      typeAheadInputOnChange: undefined,
      usesSelectInput: true,
      usesComboBoxInput: undefined,
      availableFilterArguments: [{ id: "upcoming", name: "Upcoming", argumentValue: "scheduled" }],
      clauses: [
        { id: "applied-clause", operationCode: "equal", argument: "scheduled", filterArgumentSelectedKey: "upcoming" },
      ],
    },
  ])
  expect(applied.criteriaName).toBe("Old label")
  expect(applied.queryKey).toBe("old.status")
  expect(applied.dataType).toBe("number")
})

it("CAP.query-draft.012 keeps callback/option identities and explicit false input hints without calling an editor callback", () => {
  const callback = jest.fn()
  const metadata = freeze<TAvailableFilterCriteria>({
    ...criteria,
    usesSelectInput: false,
    usesComboBoxInput: false,
    usesTypeAheadInput: false,
    typeAheadInputOnChange: callback,
  })
  const result = buildFilterGroupDraftsFromQueryFilterGroups([freeze(group("scheduled"))], [metadata])[0]
  expect(result).toMatchObject({ usesSelectInput: false, usesComboBoxInput: false, usesTypeAheadInput: false })
  expect(result.typeAheadInputOnChange).toBe(callback)
  expect(result.availableFilterArguments).toBe(metadata.availableCriteriaArguments)
  expect(callback).not.toHaveBeenCalled()
})

it.each([false, 0, "0", ""] as const)(
  "CAP.query-draft.012 preserves authoritative %p and the matching explicit empty option key",
  (argument) => {
    const metadata = freeze<TAvailableFilterCriteria>({
      ...criteria,
      availableCriteriaArguments: [{ id: "", name: "Matching argument", argumentValue: argument }],
    })
    const result = buildFilterGroupDraftsFromQueryFilterGroups([freeze(group(argument))], [metadata])[0]
    expect(result.clauses[0]).toMatchObject({ argument, filterArgumentSelectedKey: "" })
  },
)

it("CAP.query-draft.012 keeps numeric and string zero option values distinct", () => {
  const metadata = freeze<TAvailableFilterCriteria>({
    ...criteria,
    availableCriteriaArguments: [
      { id: "number", name: "Numeric zero", argumentValue: 0 },
      { id: "string", name: "String zero", argumentValue: "0" },
    ],
  })
  const result = buildFilterGroupDraftsFromQueryFilterGroups([group(0), group("0")], [metadata])
  expect(result.map((entry) => entry.clauses[0].filterArgumentSelectedKey)).toEqual(["number", "string"])
  expect(result.map((entry) => entry.clauses[0].argument)).toEqual([0, "0"])
})

it("CAP.query-draft.012 uses only exact option equality, retaining an unmatched draft and choosing no implicit first option", () => {
  const applied = freeze(group(" scheduled "))
  const result = buildFilterGroupDraftsFromQueryFilterGroups([applied], [freeze(criteria)])[0]
  expect(result.clauses[0]).toEqual({
    id: "applied-clause",
    operationCode: "equal",
    argument: " scheduled ",
    filterArgumentSelectedKey: null,
  })
  expect(applied.clauses[0].argument).toBe(" scheduled ")
})

it("CAP.query-draft.012 retains the canonical name fallback for null/omitted option metadata while preserving a null draft", () => {
  const metadata = freeze<TAvailableFilterCriteria>({
    ...criteria,
    availableCriteriaArguments: [
      { id: "omitted", name: "Name value" },
      { id: "null-option", name: "Null metadata fallback", argumentValue: null },
    ],
  })
  const result = buildFilterGroupDraftsFromQueryFilterGroups(
    [group("Name value"), group("Null metadata fallback"), group(null), group(undefined)],
    [metadata],
  )
  expect(result.map((entry) => entry.clauses[0].filterArgumentSelectedKey)).toEqual([
    "omitted",
    "null-option",
    null,
    null,
  ])
  expect(result[2].clauses[0].argument).toBeNull()
  expect(result[3].clauses[0].argument).toBeUndefined()
})

it("CAP.query-draft.012 preserves array identity and does not invent structural option matching", () => {
  const shared = [0, 1]
  const separate = [0, 1]
  const metadata = freeze<TAvailableFilterCriteria>({
    ...criteria,
    availableCriteriaArguments: [{ id: "shared-range", name: "Range", argumentValue: shared }],
  })
  const result = buildFilterGroupDraftsFromQueryFilterGroups(
    [freeze(group(shared)), freeze(group(separate))],
    [metadata],
  )
  expect(result[0].clauses[0].argument).toBe(shared)
  expect(result[0].clauses[0].filterArgumentSelectedKey).toBe("shared-range")
  expect(result[1].clauses[0].argument).toBe(separate)
  expect(result[1].clauses[0].filterArgumentSelectedKey).toBeNull()
})

it("CAP.query-draft.012 retains empty group/criterion/clause/query identities and every applied operation", () => {
  const applied = freeze<TTableFilterGroup>({
    ...group([0, 1]),
    id: "",
    criteriaID: "",
    clauses: [{ id: "", operationCode: "between", argument: [0, 1] }],
  })
  const metadata = freeze<TAvailableFilterCriteria>({
    ...criteria,
    id: "",
    name: "",
    queryKey: "",
    allowedOperationCodes: [],
  })
  const result = buildFilterGroupDraftsFromQueryFilterGroups([applied], [metadata])[0]
  expect(result).toMatchObject({
    id: "",
    criteriaID: "",
    criteriaName: "",
    queryKey: "",
    joinOperator: "or",
    clauses: [{ id: "", operationCode: "between", argument: [0, 1], filterArgumentSelectedKey: null }],
  })
})

it("CAP.query-draft.012 preserves unavailable applied owner data across metadata removal/relabel/reinsertion", () => {
  const applied = freeze([group("scheduled")])
  expect(buildFilterGroupDraftsFromQueryFilterGroups(applied, [])).toEqual([])
  expect(applied).toHaveLength(1)
  const first = buildFilterGroupDraftsFromQueryFilterGroups(applied, [freeze(criteria)])[0]
  const next = buildFilterGroupDraftsFromQueryFilterGroups(applied, [
    { ...criteria, name: "Nouveau statut", queryKey: "current.status", availableCriteriaArguments: [] },
  ])[0]
  expect(first.criteriaName).toBe("Status")
  expect(next).toMatchObject({
    criteriaName: "Nouveau statut",
    queryKey: "current.status",
    clauses: [{ argument: "scheduled", filterArgumentSelectedKey: null }],
  })
  expect(applied[0].criteriaName).toBe("Old label")
  expect(applied[0].clauses[0].argument).toBe("scheduled")
})
