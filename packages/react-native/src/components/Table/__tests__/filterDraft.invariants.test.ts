import {
  appendQueryFilterClauseDraftToGroup,
  computeFilterArgumentTypeFromOperationCode,
  computeInitialQueryFilterDraftArgument,
  computeNextQueryFilterClauseOperationCode,
  createQueryFilterClauseDraft,
  createQueryFilterGroupDraftFromCriteria,
  normalizeDraftToQueryFilterGroups,
  type TQueryFilterGroupDraft,
} from "../filterDraft"
import type { TAvailableFilterArgumentTypes, TAvailableFilterCriteria } from "../filterMetadata"
import {
  AVAILABLE_TABLE_FILTER_ARGUMENT_DATA_TYPES,
  AVAILABLE_TABLE_FILTER_OPERATION_CODES,
  type TTableFilterArgumentValue,
  type TTableFilterOperationCode,
} from "../queryTypes"

const freeze = <T>(value: T): T => {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}
const criteria: TAvailableFilterCriteria = {
  id: "quantity",
  name: "Quantity",
  queryKey: "stock.quantity",
  dataType: "number",
  allowedOperationCodes: ["equal", "between"],
}
const draft = (
  argument: TTableFilterArgumentValue,
  operationCode: TTableFilterOperationCode = "equal",
): TQueryFilterGroupDraft => ({
  id: "group",
  criteriaID: "quantity",
  criteriaName: "Quantity",
  queryKey: "stock.quantity",
  dataType: "number",
  joinOperator: "and",
  clauses: [{ id: "clause", operationCode, argument }],
})

it("CAP.query-draft.001 preserves source metadata, callbacks, options and explicit false hints", () => {
  const callback = jest.fn()
  const source = freeze<TAvailableFilterCriteria>({
    ...criteria,
    id: "",
    name: "",
    queryKey: "",
    usesSelectInput: false,
    usesComboBoxInput: false,
    usesTypeAheadInput: false,
    typeAheadInputOnChange: callback,
    availableCriteriaArguments: [
      { id: "", name: "Zero", argumentValue: 0 },
      { id: "false", name: "False", argumentValue: false },
    ],
  })
  const group = createQueryFilterGroupDraftFromCriteria(source)
  expect(group).toMatchObject({
    id: "",
    criteriaID: "",
    criteriaName: "",
    queryKey: "",
    usesSelectInput: false,
    usesComboBoxInput: false,
    usesTypeAheadInput: false,
  })
  expect(group.availableFilterArguments).toBe(source.availableCriteriaArguments)
  expect(group.availableFilterArguments).toEqual([
    { id: "", name: "Zero", argumentValue: 0 },
    { id: "false", name: "False", argumentValue: false },
  ])
  expect(group.typeAheadInputOnChange).toBe(callback)
  normalizeDraftToQueryFilterGroups(group)
  appendQueryFilterClauseDraftToGroup(group, { allowedOperationCodes: source.allowedOperationCodes })
  expect(callback).not.toHaveBeenCalled()
})

it("CAP.query-draft.002 allocates independent empty collection/range drafts without manufacturing a scalar", () => {
  expect(computeInitialQueryFilterDraftArgument()).toBeUndefined()
  expect(computeInitialQueryFilterDraftArgument("equal")).toBeUndefined()
  for (const operation of ["in", "not-in", "between"] as const) {
    const first = computeInitialQueryFilterDraftArgument(operation)
    const second = computeInitialQueryFilterDraftArgument(operation)
    expect(first).not.toBe(second)
    expect(first).toEqual(operation === "between" ? ["", ""] : [])
  }
})

it("CAP.query-draft.003 obeys the authored operation order and does not edit its readonly collections", () => {
  const allowedOperationCodes = freeze(["not-in", "like", "equal"] as const)
  const existingOperationCodes = freeze(["not-in", undefined] as const)
  expect(computeNextQueryFilterClauseOperationCode({ allowedOperationCodes, existingOperationCodes })).toBe("like")
  expect(
    computeNextQueryFilterClauseOperationCode({
      allowedOperationCodes,
      existingOperationCodes: ["not-in", "like", "equal", "equal"],
    }),
  ).toBe("not-in")
  expect(
    computeNextQueryFilterClauseOperationCode({
      allowedOperationCodes,
      existingOperationCodes: allowedOperationCodes,
      allowDuplicateOperationCodes: false,
    }),
  ).toBeUndefined()
  expect(allowedOperationCodes).toEqual(["not-in", "like", "equal"])
  expect(existingOperationCodes).toEqual(["not-in", undefined])
})

it("CAP.query-draft.004/.010 distinguishes an omitted list, an empty list and an explicit owner operation", () => {
  const source = freeze(createQueryFilterGroupDraftFromCriteria(criteria))
  const omitted = appendQueryFilterClauseDraftToGroup(source)
  expect(omitted.clauses.at(-1)?.operationCode).toBe("equal")
  expect(appendQueryFilterClauseDraftToGroup(source, { allowedOperationCodes: [] })).toBe(source)
  expect(
    appendQueryFilterClauseDraftToGroup(source, {
      allowedOperationCodes: ["equal"],
      allowDuplicateOperationCodes: false,
    }),
  ).toBe(source)
  const explicit = appendQueryFilterClauseDraftToGroup(source, {
    operationCode: "between",
    allowedOperationCodes: [],
    clauseID: "",
  })
  expect(explicit.clauses.at(-1)).toMatchObject({ id: "", operationCode: "between", argument: ["", ""] })
  expect(source.clauses).toHaveLength(1)
  expect(omitted.clauses[0]).toBe(source.clauses[0])
})

it("CAP.query-draft.005 keeps empty explicit identities, false/zero/null drafts and empty selected keys", () => {
  const group = createQueryFilterGroupDraftFromCriteria(criteria, {
    groupID: "",
    clauseID: "",
    operationCode: "between",
    joinOperator: "or",
  })
  expect(group).toMatchObject({ id: "", joinOperator: "or", clauses: [{ id: "", argument: ["", ""] }] })
  for (const argument of [false, 0, "", null] as const)
    expect(
      createQueryFilterClauseDraft({ id: "", operationCode: "between", argument, filterArgumentSelectedKey: "" }),
    ).toEqual({ id: "", operationCode: "between", conditionType: undefined, argument, filterArgumentSelectedKey: "" })
})

it("CAP.query-draft.005 skips every currently occupied generated identity after deletion", () => {
  const group = freeze<TQueryFilterGroupDraft>({
    ...draft(0),
    id: "",
    clauses: [
      { id: "-clause-3", operationCode: "equal", argument: 0 },
      { id: "-clause-4", operationCode: "equal", argument: 1 },
    ],
  })
  const appended = appendQueryFilterClauseDraftToGroup(group)
  expect(appended.clauses.map((clause) => clause.id)).toEqual(["-clause-3", "-clause-4", "-clause-5"])
  expect(group.clauses).toHaveLength(2)
})

it.each([false, 0, -1, "0", "false"] as const)(
  "CAP.query-draft.006 retains meaningful scalar %p without coercion",
  (argument) => {
    const source = freeze(draft(argument))
    expect(normalizeDraftToQueryFilterGroups(source)[0].clauses[0].argument).toBe(argument)
    expect(source.clauses[0].argument).toBe(argument)
  },
)

it.each([undefined, null, "", "  ", [], ["", "  "]])(
  "CAP.query-draft.007 omits incomplete %p only in the normalized output",
  (argument) => {
    const source = freeze(draft(argument as TTableFilterArgumentValue))
    expect(normalizeDraftToQueryFilterGroups(source)).toEqual([])
    expect(source.clauses).toHaveLength(1)
    expect(source.clauses[0].argument).toBe(argument)
  },
)

it("CAP.query-draft.006/.007 filters and trims list output without mutating the caller's draft arrays", () => {
  const source = freeze(draft(["  alpha  ", " ", "beta", ""], "in"))
  expect(normalizeDraftToQueryFilterGroups(source)[0].clauses[0].argument).toEqual(["alpha", "beta"])
  expect(source.clauses[0].argument).toEqual(["  alpha  ", " ", "beta", ""])
  const numeric = freeze(draft([0, -1, 2], "not-in"))
  expect(normalizeDraftToQueryFilterGroups(numeric)[0].clauses[0].argument).toEqual([0, -1, 2])
})

it("CAP.query-draft.008 preserves zero bounds, trims string bounds and keeps the canonical two-bound projection", () => {
  expect(normalizeDraftToQueryFilterGroups(freeze(draft([0, 2, 3], "between")))[0].clauses[0].argument).toEqual([0, 2])
  expect(normalizeDraftToQueryFilterGroups(freeze(draft([" 0 ", " 2 "], "between")))[0].clauses[0].argument).toEqual([
    "0",
    "2",
  ])
  expect(normalizeDraftToQueryFilterGroups(freeze(draft([0], "between")))).toEqual([])
  expect(normalizeDraftToQueryFilterGroups(freeze(draft(["", "2"], "between")))).toEqual([])
})

it("CAP.query-draft.008 preserves canonical permissive scalar representations without imposing an input validator", () => {
  expect(normalizeDraftToQueryFilterGroups(draft(0, "between"))[0].clauses[0].argument).toBe(0)
  expect(normalizeDraftToQueryFilterGroups(draft(" alpha ", "in"))[0].clauses[0].argument).toBe("alpha")
})

const scalarDispatch: Record<TTableFilterOperationCode, TAvailableFilterArgumentTypes | undefined> = {
  "greater-than": "Input",
  "greater-than-equal": "Input",
  "less-than": "Input",
  "less-than-equal": "Input",
  equal: "Input",
  like: "Input",
  "similar-to": "Input",
  in: "Multi Input",
  between: "Range",
  "not-greater-than": "Input",
  "not-greater-than-equal": "Input",
  "not-less-than": "Input",
  "not-less-than-equal": "Input",
  "not-equal": "Input",
  "not-like": "Input",
  "not-in": "Multi Input",
}
const booleanDispatch: Record<TTableFilterOperationCode, TAvailableFilterArgumentTypes | undefined> = {
  "greater-than": undefined,
  "greater-than-equal": undefined,
  "less-than": undefined,
  "less-than-equal": undefined,
  equal: "Boolean",
  like: undefined,
  "similar-to": undefined,
  in: undefined,
  between: undefined,
  "not-greater-than": undefined,
  "not-greater-than-equal": undefined,
  "not-less-than": undefined,
  "not-less-than-equal": undefined,
  "not-equal": "Boolean",
  "not-like": undefined,
  "not-in": undefined,
}
it.each(AVAILABLE_TABLE_FILTER_ARGUMENT_DATA_TYPES)(
  "CAP.query-draft.009 maps all sixteen %s operations including unsupported cells",
  (dataType) => {
    const expected = dataType === "boolean" ? booleanDispatch : scalarDispatch
    expect(Object.keys(expected)).toEqual([...AVAILABLE_TABLE_FILTER_OPERATION_CODES])
    for (const operationCode of AVAILABLE_TABLE_FILTER_OPERATION_CODES)
      expect(computeFilterArgumentTypeFromOperationCode({ dataType, operationCode })).toBe(expected[operationCode])
    expect(computeFilterArgumentTypeFromOperationCode({ dataType })).toBeUndefined()
  },
)

it("CAP.query-draft.009 keeps text hint and condition precedence without changing other data types", () => {
  const hints = { usesTypeAheadInput: true, usesSelectInput: true, usesComboBoxInput: true }
  expect(computeFilterArgumentTypeFromOperationCode({ dataType: "text", operationCode: "equal", ...hints })).toBe(
    "Typeahead Search",
  )
  expect(
    computeFilterArgumentTypeFromOperationCode({
      dataType: "text",
      operationCode: "equal",
      ...hints,
      usesTypeAheadInput: false,
    }),
  ).toBe("Select")
  expect(
    computeFilterArgumentTypeFromOperationCode({
      dataType: "text",
      operationCode: "equal",
      ...hints,
      usesTypeAheadInput: false,
      usesSelectInput: false,
    }),
  ).toBe("Combo Box")
  expect(computeFilterArgumentTypeFromOperationCode({ dataType: "text", operationCode: "not-in", ...hints })).toBe(
    "Multi-Typeahead Search",
  )
  expect(
    computeFilterArgumentTypeFromOperationCode({
      dataType: "text",
      operationCode: "not-in",
      conditionType: "Multi-Select",
      ...hints,
    }),
  ).toBe("Multi Select")
  expect(
    computeFilterArgumentTypeFromOperationCode({
      dataType: "text",
      operationCode: "in",
      conditionType: "Range",
      ...hints,
    }),
  ).toBe("Range")
  expect(
    computeFilterArgumentTypeFromOperationCode({
      dataType: "text",
      operationCode: "between",
      conditionType: "Multi-Select",
      ...hints,
    }),
  ).toBe("Range")
  expect(computeFilterArgumentTypeFromOperationCode({ dataType: "number", operationCode: "equal", ...hints })).toBe(
    "Input",
  )
  expect(
    computeFilterArgumentTypeFromOperationCode({
      dataType: "date-time",
      operationCode: "in",
      conditionType: "Multi-Select",
      ...hints,
    }),
  ).toBe("Multi Input")
  expect(computeFilterArgumentTypeFromOperationCode({ dataType: "boolean", operationCode: "equal", ...hints })).toBe(
    "Boolean",
  )
})
