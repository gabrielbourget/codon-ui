import { describe, expect, it } from "vitest"

import type { TQueryFilterClauseDraft, TQueryFilterGroupDraft } from "../../../Table/filterDraft"
import {
  FILTER_ARGUMENT_DATA_TYPE__NUMBER,
  FILTER_ARGUMENT_DATA_TYPE__TEXT,
  FILTER_ARGUMENT_TYPE__INPUT,
  FILTER_ARGUMENT_TYPE__MULTI_INPUT,
  FILTER_ARGUMENT_TYPE__MULTI_SELECT,
  FILTER_ARGUMENT_TYPE__RANGE,
  FILTER_ARGUMENT_TYPE__TYPEAHEAD_SEARCH,
  type TAvailableFilterCriteria,
} from "../../../Table/filterMetadata"
import {
  TABLE_FILTER_ARGUMENT_DATA_TYPE__DATE as QUERY_FILTER_ARGUMENT_DATA_TYPE__DATE,
  TABLE_FILTER_ARGUMENT_DATA_TYPE__DATETIME as QUERY_FILTER_ARGUMENT_DATA_TYPE__DATETIME,
  TABLE_FILTER_ARGUMENT_DATA_TYPE__NUMBER as QUERY_FILTER_ARGUMENT_DATA_TYPE__NUMBER,
  TABLE_FILTER_ARGUMENT_DATA_TYPE__TEXT as QUERY_FILTER_ARGUMENT_DATA_TYPE__TEXT,
  TABLE_FILTER_ARGUMENT_DATA_TYPE__TIME as QUERY_FILTER_ARGUMENT_DATA_TYPE__TIME,
  TABLE_FILTER_CONDITION_TYPE__LIST as FILTER_CONDITION_TYPE_CODE__LIST,
  TABLE_FILTER_CONDITION_TYPE__MULTI_SELECT as FILTER_CONDITION_TYPE_CODE__MULTI_SELECT,
  TABLE_FILTER_CONDITION_TYPE__RANGE as FILTER_CONDITION_TYPE_CODE__RANGE,
  TABLE_FILTER_JOIN_OPERATOR__AND as QUERY_FILTER_JOIN_OPERATOR__AND,
  TABLE_FILTER_OPERATION_CODE__BETWEEN as FILTERING_OPERATION_CODE__BETWEEN,
  TABLE_FILTER_OPERATION_CODE__EQUAL as FILTERING_OPERATION_CODE__EQUAL,
  TABLE_FILTER_OPERATION_CODE__IN as FILTERING_OPERATION_CODE__IN,
  TABLE_FILTER_OPERATION_CODE__LIKE as FILTERING_OPERATION_CODE__LIKE,
  TABLE_FILTER_OPERATION_CODE__NOT_IN as FILTERING_OPERATION_CODE__NOT_IN,
  TABLE_FILTER_OPERATION_CODE__SIMILAR_TO as FILTERING_OPERATION_CODE__SIMILAR_TO,
} from "../../../Table/queryTypes"
import {
  computeAvailableFilterConditionTypes,
  computeAvailableOperationCodeItems,
  computeFilterArgumentType,
  FILTERING_OPERATION_CODE_TO_LABEL,
} from "../helpers"

const textCriteria: TAvailableFilterCriteria = {
  id: "name",
  name: "Name",
  dataType: FILTER_ARGUMENT_DATA_TYPE__TEXT,
  allowedOperationCodes: [FILTERING_OPERATION_CODE__LIKE, FILTERING_OPERATION_CODE__EQUAL],
}

const numberCriteria: TAvailableFilterCriteria = {
  id: "duration",
  name: "Duration",
  dataType: FILTER_ARGUMENT_DATA_TYPE__NUMBER,
  allowedOperationCodes: [FILTERING_OPERATION_CODE__EQUAL, FILTERING_OPERATION_CODE__BETWEEN],
}

const makeGroup = (overrides: Partial<TQueryFilterGroupDraft> = {}): TQueryFilterGroupDraft => ({
  id: "g1",
  criteriaID: "name",
  criteriaName: "Name",
  dataType: QUERY_FILTER_ARGUMENT_DATA_TYPE__TEXT,
  joinOperator: QUERY_FILTER_JOIN_OPERATOR__AND,
  clauses: [],
  ...overrides,
})

const makeClause = (overrides: Partial<TQueryFilterClauseDraft> = {}): TQueryFilterClauseDraft => ({
  id: "c1",
  ...overrides,
})

describe("FILTERING_OPERATION_CODE_TO_LABEL", () => {
  it("maps every canonical operation code to a non-empty label.", () => {
    for (const label of Object.values(FILTERING_OPERATION_CODE_TO_LABEL)) {
      expect(label.length).toBeGreaterThan(0)
    }
  })
})

describe("computeAvailableOperationCodeItems", () => {
  it("returns label-mapped items for the criteria's allowed operation codes.", () => {
    const items = computeAvailableOperationCodeItems([textCriteria, numberCriteria], "name")

    expect(items).toEqual([
      { id: FILTERING_OPERATION_CODE__LIKE, name: "Contains" },
      { id: FILTERING_OPERATION_CODE__EQUAL, name: "Equal to" },
    ])
  })

  it("returns the Similar to label for fuzzy-capable operation metadata.", () => {
    const items = computeAvailableOperationCodeItems(
      [
        {
          id: "name",
          name: "Name",
          dataType: FILTER_ARGUMENT_DATA_TYPE__TEXT,
          allowedOperationCodes: [FILTERING_OPERATION_CODE__SIMILAR_TO],
        },
      ],
      "name",
    )

    expect(items).toEqual([{ id: FILTERING_OPERATION_CODE__SIMILAR_TO, name: "Similar to" }])
  })

  it("returns items for a different criteria when given its id.", () => {
    const items = computeAvailableOperationCodeItems([textCriteria, numberCriteria], "duration")

    expect(items).toEqual([
      { id: FILTERING_OPERATION_CODE__EQUAL, name: "Equal to" },
      { id: FILTERING_OPERATION_CODE__BETWEEN, name: "Between" },
    ])
  })

  it("uses provided operation labels when available.", () => {
    const items = computeAvailableOperationCodeItems([textCriteria], "name", {
      [FILTERING_OPERATION_CODE__LIKE]: "Contient",
      [FILTERING_OPERATION_CODE__EQUAL]: "Egal a",
    })

    expect(items).toEqual([
      { id: FILTERING_OPERATION_CODE__LIKE, name: "Contient" },
      { id: FILTERING_OPERATION_CODE__EQUAL, name: "Egal a" },
    ])
  })

  it("returns an empty array when criteriaID is not found.", () => {
    const items = computeAvailableOperationCodeItems([textCriteria], "unknown-id")
    expect(items).toEqual([])
  })

  it("returns an empty array when the criteria has no allowedOperationCodes.", () => {
    const bare: TAvailableFilterCriteria = {
      id: "x",
      name: "X",
      dataType: FILTER_ARGUMENT_DATA_TYPE__TEXT,
    }
    const items = computeAvailableOperationCodeItems([bare], "x")

    expect(items).toEqual([])
  })
})

describe("computeAvailableFilterConditionTypes", () => {
  it("returns all condition types for text data type.", () => {
    const types = computeAvailableFilterConditionTypes(QUERY_FILTER_ARGUMENT_DATA_TYPE__TEXT)
    const names = types.map((type) => type.name)

    expect(names).toContain(FILTER_CONDITION_TYPE_CODE__MULTI_SELECT)
    expect(names).toContain(FILTER_CONDITION_TYPE_CODE__LIST)
    expect(names).toContain(FILTER_CONDITION_TYPE_CODE__RANGE)
  })

  it("returns all condition types for number data type.", () => {
    const types = computeAvailableFilterConditionTypes(QUERY_FILTER_ARGUMENT_DATA_TYPE__NUMBER)

    expect(types.map((type) => type.name)).toContain(FILTER_CONDITION_TYPE_CODE__MULTI_SELECT)
  })

  it("excludes MULTI_SELECT for date data type.", () => {
    const types = computeAvailableFilterConditionTypes(QUERY_FILTER_ARGUMENT_DATA_TYPE__DATE)

    expect(types.map((type) => type.name)).not.toContain(FILTER_CONDITION_TYPE_CODE__MULTI_SELECT)
  })

  it("excludes MULTI_SELECT for datetime data type.", () => {
    const types = computeAvailableFilterConditionTypes(QUERY_FILTER_ARGUMENT_DATA_TYPE__DATETIME)

    expect(types.map((type) => type.name)).not.toContain(FILTER_CONDITION_TYPE_CODE__MULTI_SELECT)
  })

  it("excludes MULTI_SELECT for time data type.", () => {
    const types = computeAvailableFilterConditionTypes(QUERY_FILTER_ARGUMENT_DATA_TYPE__TIME)

    expect(types.map((type) => type.name)).not.toContain(FILTER_CONDITION_TYPE_CODE__MULTI_SELECT)
  })

  it("still includes LIST and RANGE for date data type.", () => {
    const types = computeAvailableFilterConditionTypes(QUERY_FILTER_ARGUMENT_DATA_TYPE__DATE)
    const names = types.map((type) => type.name)

    expect(names).toContain(FILTER_CONDITION_TYPE_CODE__LIST)
    expect(names).toContain(FILTER_CONDITION_TYPE_CODE__RANGE)
  })
})

describe("computeFilterArgumentType", () => {
  it("returns Input for a scalar text equal clause.", () => {
    const group = makeGroup()
    const clause = makeClause({ operationCode: FILTERING_OPERATION_CODE__EQUAL })

    expect(computeFilterArgumentType(group, clause)).toBe(FILTER_ARGUMENT_TYPE__INPUT)
  })

  it("returns Typeahead Search when usesTypeAheadInput is set on the group.", () => {
    const group = makeGroup({ usesTypeAheadInput: true })
    const clause = makeClause({ operationCode: FILTERING_OPERATION_CODE__EQUAL })

    expect(computeFilterArgumentType(group, clause)).toBe(FILTER_ARGUMENT_TYPE__TYPEAHEAD_SEARCH)
  })

  it("returns Multi Input for IN on a number criteria.", () => {
    const group = makeGroup({ dataType: QUERY_FILTER_ARGUMENT_DATA_TYPE__NUMBER })
    const clause = makeClause({ operationCode: FILTERING_OPERATION_CODE__IN })

    expect(computeFilterArgumentType(group, clause)).toBe(FILTER_ARGUMENT_TYPE__MULTI_INPUT)
  })

  it("returns Multi Select for IN with MULTI_SELECT conditionType on text.", () => {
    const group = makeGroup()
    const clause = makeClause({
      operationCode: FILTERING_OPERATION_CODE__IN,
      conditionType: FILTER_CONDITION_TYPE_CODE__MULTI_SELECT,
    })

    expect(computeFilterArgumentType(group, clause)).toBe(FILTER_ARGUMENT_TYPE__MULTI_SELECT)
  })

  it("returns Range for BETWEEN on a number criteria.", () => {
    const group = makeGroup({ dataType: QUERY_FILTER_ARGUMENT_DATA_TYPE__NUMBER })
    const clause = makeClause({ operationCode: FILTERING_OPERATION_CODE__BETWEEN })

    expect(computeFilterArgumentType(group, clause)).toBe(FILTER_ARGUMENT_TYPE__RANGE)
  })

  it("returns Multi Input for IN on a date criteria.", () => {
    const group = makeGroup({ dataType: QUERY_FILTER_ARGUMENT_DATA_TYPE__DATE })
    const clause = makeClause({ operationCode: FILTERING_OPERATION_CODE__IN })

    expect(computeFilterArgumentType(group, clause)).toBe(FILTER_ARGUMENT_TYPE__MULTI_INPUT)
  })

  it("returns Multi Input for NOT_IN on a date criteria.", () => {
    const group = makeGroup({ dataType: QUERY_FILTER_ARGUMENT_DATA_TYPE__DATE })
    const clause = makeClause({ operationCode: FILTERING_OPERATION_CODE__NOT_IN })

    expect(computeFilterArgumentType(group, clause)).toBe(FILTER_ARGUMENT_TYPE__MULTI_INPUT)
  })

  it("returns undefined when no operationCode is set.", () => {
    const group = makeGroup()
    const clause = makeClause()

    expect(computeFilterArgumentType(group, clause)).toBeUndefined()
  })
})
