import { describe, expect, it } from "vitest"

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
import {
  FILTER_ARGUMENT_TYPE__BOOLEAN,
  FILTER_ARGUMENT_TYPE__INPUT,
  FILTER_ARGUMENT_TYPE__MULTI_INPUT,
  FILTER_ARGUMENT_TYPE__MULTI_SELECT,
  FILTER_ARGUMENT_TYPE__RANGE,
  FILTER_ARGUMENT_TYPE__SELECT,
  type TAvailableFilterCriteria,
} from "../filterMetadata"
import {
  TABLE_FILTER_ARGUMENT_DATA_TYPE__BOOLEAN as QUERY_FILTER_ARGUMENT_DATA_TYPE__BOOLEAN,
  TABLE_FILTER_ARGUMENT_DATA_TYPE__DATE as QUERY_FILTER_ARGUMENT_DATA_TYPE__DATE,
  TABLE_FILTER_ARGUMENT_DATA_TYPE__TEXT as QUERY_FILTER_ARGUMENT_DATA_TYPE__TEXT,
  TABLE_FILTER_CONDITION_TYPE__MULTI_SELECT as FILTER_CONDITION_TYPE_CODE__MULTI_SELECT,
  TABLE_FILTER_CONDITION_TYPE__RANGE as FILTER_CONDITION_TYPE_CODE__RANGE,
  TABLE_FILTER_JOIN_OPERATOR__AND as QUERY_FILTER_JOIN_OPERATOR__AND,
  TABLE_FILTER_JOIN_OPERATOR__OR as QUERY_FILTER_JOIN_OPERATOR__OR,
  TABLE_FILTER_OPERATION_CODE__BETWEEN as FILTERING_OPERATION_CODE__BETWEEN,
  TABLE_FILTER_OPERATION_CODE__EQUAL as FILTERING_OPERATION_CODE__EQUAL,
  TABLE_FILTER_OPERATION_CODE__GREATER_THAN_EQUAL as FILTERING_OPERATION_CODE__GREATER_THAN_EQUAL,
  TABLE_FILTER_OPERATION_CODE__IN as FILTERING_OPERATION_CODE__IN,
  TABLE_FILTER_OPERATION_CODE__LESS_THAN_EQUAL as FILTERING_OPERATION_CODE__LESS_THAN_EQUAL,
  TABLE_FILTER_OPERATION_CODE__LIKE as FILTERING_OPERATION_CODE__LIKE,
} from "../queryTypes"

describe("filterDraft Utils", () => {
  it("Creates filter group drafts from criteria metadata.", () => {
    const statusCriteria: TAvailableFilterCriteria = {
      id: "status",
      name: "Status",
      queryKey: "events.status",
      dataType: QUERY_FILTER_ARGUMENT_DATA_TYPE__TEXT,
      allowedOperationCodes: [FILTERING_OPERATION_CODE__EQUAL],
      usesSelectInput: true,
      availableCriteriaArguments: [
        {
          id: "upcoming",
          name: "Upcoming",
        },
      ],
    }

    expect(
      createQueryFilterGroupDraftFromCriteria(statusCriteria, {
        groupID: "status-group",
        clauseID: "status-clause",
      }),
    ).toEqual({
      id: "status-group",
      criteriaID: "status",
      criteriaName: "Status",
      queryKey: "events.status",
      dataType: QUERY_FILTER_ARGUMENT_DATA_TYPE__TEXT,
      joinOperator: QUERY_FILTER_JOIN_OPERATOR__AND,
      usesTypeAheadInput: undefined,
      typeAheadInputOnChange: undefined,
      usesSelectInput: true,
      usesComboBoxInput: undefined,
      availableFilterArguments: [
        {
          id: "upcoming",
          name: "Upcoming",
        },
      ],
      clauses: [
        {
          id: "status-clause",
          operationCode: FILTERING_OPERATION_CODE__EQUAL,
          conditionType: undefined,
          argument: undefined,
          filterArgumentSelectedKey: null,
        },
      ],
    })
  })

  it("Computes initial draft argument shape from operation code.", () => {
    expect(computeInitialQueryFilterDraftArgument(FILTERING_OPERATION_CODE__EQUAL)).toBeUndefined()
    expect(computeInitialQueryFilterDraftArgument(FILTERING_OPERATION_CODE__IN)).toEqual([])
    expect(computeInitialQueryFilterDraftArgument(FILTERING_OPERATION_CODE__BETWEEN)).toEqual(["", ""])
  })

  it("Computes the next operation code from allowed operations.", () => {
    const allowedOperationCodes = [FILTERING_OPERATION_CODE__EQUAL, FILTERING_OPERATION_CODE__IN] as const

    expect(computeNextQueryFilterClauseOperationCode({ allowedOperationCodes })).toBe(FILTERING_OPERATION_CODE__EQUAL)
    expect(
      computeNextQueryFilterClauseOperationCode({
        allowedOperationCodes,
        existingOperationCodes: [FILTERING_OPERATION_CODE__EQUAL],
      }),
    ).toBe(FILTERING_OPERATION_CODE__IN)
    expect(
      computeNextQueryFilterClauseOperationCode({
        allowedOperationCodes,
        existingOperationCodes: allowedOperationCodes,
      }),
    ).toBe(FILTERING_OPERATION_CODE__EQUAL)
    expect(
      computeNextQueryFilterClauseOperationCode({
        allowDuplicateOperationCodes: false,
        allowedOperationCodes,
        existingOperationCodes: allowedOperationCodes,
      }),
    ).toBeUndefined()
    expect(computeNextQueryFilterClauseOperationCode({ allowedOperationCodes: [] })).toBeUndefined()
  })

  it("Creates and appends filter clause drafts without mutating the source group.", () => {
    const dateCriteria: TAvailableFilterCriteria = {
      id: "startDateTime",
      name: "Date",
      dataType: QUERY_FILTER_ARGUMENT_DATA_TYPE__DATE,
      allowedOperationCodes: [FILTERING_OPERATION_CODE__GREATER_THAN_EQUAL],
    }
    const group = createQueryFilterGroupDraftFromCriteria(dateCriteria, {
      groupID: "date-group",
      clauseID: "date-clause-1",
    })
    const appendedGroup = appendQueryFilterClauseDraftToGroup(group, {
      clauseID: "date-clause-2",
      operationCode: FILTERING_OPERATION_CODE__LESS_THAN_EQUAL,
    })

    expect(group.clauses).toHaveLength(1)
    expect(appendedGroup.clauses).toEqual([
      createQueryFilterClauseDraft({
        id: "date-clause-1",
        operationCode: FILTERING_OPERATION_CODE__GREATER_THAN_EQUAL,
      }),
      createQueryFilterClauseDraft({
        id: "date-clause-2",
        operationCode: FILTERING_OPERATION_CODE__LESS_THAN_EQUAL,
      }),
    ])
  })

  it("Appends filter clause drafts with the next allowed operation when no operation is supplied.", () => {
    const textCriteria: TAvailableFilterCriteria = {
      id: "status",
      name: "Status",
      dataType: QUERY_FILTER_ARGUMENT_DATA_TYPE__TEXT,
      allowedOperationCodes: [FILTERING_OPERATION_CODE__EQUAL, FILTERING_OPERATION_CODE__IN],
    }
    const group = createQueryFilterGroupDraftFromCriteria(textCriteria, {
      groupID: "status-group",
      clauseID: "status-clause-1",
    })

    expect(
      appendQueryFilterClauseDraftToGroup(group, {
        allowedOperationCodes: textCriteria.allowedOperationCodes,
        clauseID: "status-clause-2",
      }).clauses,
    ).toEqual([
      createQueryFilterClauseDraft({
        id: "status-clause-1",
        operationCode: FILTERING_OPERATION_CODE__EQUAL,
      }),
      createQueryFilterClauseDraft({
        id: "status-clause-2",
        operationCode: FILTERING_OPERATION_CODE__IN,
      }),
    ])
  })

  it("Generates deterministic fallback clause ids without reusing deleted clause positions.", () => {
    const textCriteria: TAvailableFilterCriteria = {
      id: "name",
      name: "Name",
      dataType: QUERY_FILTER_ARGUMENT_DATA_TYPE__TEXT,
      allowedOperationCodes: [FILTERING_OPERATION_CODE__LIKE],
    }
    const group = createQueryFilterGroupDraftFromCriteria(textCriteria)
    const secondClauseGroup = appendQueryFilterClauseDraftToGroup(group, {
      allowedOperationCodes: textCriteria.allowedOperationCodes,
    })
    const groupWithDeletedFirstClause = {
      ...secondClauseGroup,
      clauses: secondClauseGroup.clauses.filter((clause) => clause.id !== "name-clause-1"),
    }

    expect(
      appendQueryFilterClauseDraftToGroup(groupWithDeletedFirstClause, {
        allowedOperationCodes: textCriteria.allowedOperationCodes,
      }).clauses.map((clause) => clause.id),
    ).toEqual(["name-clause-2", "name-clause-3"])
  })

  it("Appends duplicate operation codes only when duplicate operation codes are allowed.", () => {
    const textCriteria: TAvailableFilterCriteria = {
      id: "status",
      name: "Status",
      dataType: QUERY_FILTER_ARGUMENT_DATA_TYPE__TEXT,
      allowedOperationCodes: [FILTERING_OPERATION_CODE__EQUAL],
    }
    const group = createQueryFilterGroupDraftFromCriteria(textCriteria, {
      groupID: "status-group",
      clauseID: "status-clause-1",
    })

    expect(
      appendQueryFilterClauseDraftToGroup(group, {
        allowDuplicateOperationCodes: true,
        allowedOperationCodes: textCriteria.allowedOperationCodes,
        clauseID: "status-clause-2",
      }).clauses.at(-1),
    ).toEqual(
      createQueryFilterClauseDraft({
        id: "status-clause-2",
        operationCode: FILTERING_OPERATION_CODE__EQUAL,
      }),
    )
    expect(
      appendQueryFilterClauseDraftToGroup(group, {
        allowDuplicateOperationCodes: false,
        allowedOperationCodes: textCriteria.allowedOperationCodes,
        clauseID: "status-clause-2",
      }).clauses,
    ).toEqual(group.clauses)
  })

  it("Normalizes complete draft clauses into query filter groups.", () => {
    const drafts: TQueryFilterGroupDraft[] = [
      {
        id: "status",
        criteriaID: "status",
        criteriaName: "Status",
        queryKey: "events.status",
        dataType: QUERY_FILTER_ARGUMENT_DATA_TYPE__TEXT,
        joinOperator: QUERY_FILTER_JOIN_OPERATOR__OR,
        clauses: [
          {
            id: "status-1",
            operationCode: FILTERING_OPERATION_CODE__EQUAL,
            argument: " Upcoming ",
            conditionType: FILTER_CONDITION_TYPE_CODE__MULTI_SELECT,
            filterArgumentSelectedKey: "upcoming",
          },
          {
            id: "status-2",
            operationCode: FILTERING_OPERATION_CODE__IN,
            argument: ["Announced", ""],
          },
        ],
      },
    ]

    expect(normalizeDraftToQueryFilterGroups(drafts[0])).toEqual([
      {
        id: "status",
        criteriaID: "status",
        criteriaName: "Status",
        queryKey: "events.status",
        dataType: QUERY_FILTER_ARGUMENT_DATA_TYPE__TEXT,
        joinOperator: QUERY_FILTER_JOIN_OPERATOR__OR,
        clauses: [
          {
            id: "status-1",
            operationCode: FILTERING_OPERATION_CODE__EQUAL,
            argument: "Upcoming",
          },
          {
            id: "status-2",
            operationCode: FILTERING_OPERATION_CODE__IN,
            argument: ["Announced"],
          },
        ],
      },
    ])
  })

  it("Drops incomplete draft clauses and empty draft groups.", () => {
    const drafts: TQueryFilterGroupDraft[] = [
      {
        id: "name",
        criteriaID: "name",
        criteriaName: "Name",
        dataType: QUERY_FILTER_ARGUMENT_DATA_TYPE__TEXT,
        joinOperator: QUERY_FILTER_JOIN_OPERATOR__AND,
        clauses: [
          {
            id: "name-1",
            operationCode: FILTERING_OPERATION_CODE__LIKE,
            argument: " ",
          },
          {
            id: "name-2",
            argument: "Ambient",
          },
        ],
      },
      {
        id: "date",
        criteriaID: "date",
        criteriaName: "Date",
        dataType: QUERY_FILTER_ARGUMENT_DATA_TYPE__DATE,
        joinOperator: QUERY_FILTER_JOIN_OPERATOR__AND,
        clauses: [
          {
            id: "date-1",
            operationCode: FILTERING_OPERATION_CODE__GREATER_THAN_EQUAL,
            argument: "2026-02-01",
          },
        ],
      },
    ]

    expect(normalizeDraftToQueryFilterGroups(drafts)).toEqual([
      {
        id: "date",
        criteriaID: "date",
        criteriaName: "Date",
        queryKey: undefined,
        dataType: QUERY_FILTER_ARGUMENT_DATA_TYPE__DATE,
        joinOperator: QUERY_FILTER_JOIN_OPERATOR__AND,
        clauses: [
          {
            id: "date-1",
            operationCode: FILTERING_OPERATION_CODE__GREATER_THAN_EQUAL,
            argument: "2026-02-01",
          },
        ],
      },
    ])
  })

  it("Requires both range boundaries when normalizing between draft clauses.", () => {
    const drafts: TQueryFilterGroupDraft[] = [
      {
        id: "date",
        criteriaID: "date",
        criteriaName: "Date",
        dataType: QUERY_FILTER_ARGUMENT_DATA_TYPE__DATE,
        joinOperator: QUERY_FILTER_JOIN_OPERATOR__AND,
        clauses: [
          {
            id: "date-incomplete-between",
            operationCode: FILTERING_OPERATION_CODE__BETWEEN,
            argument: ["2026-02-01", ""],
          },
          {
            id: "date-complete-between",
            operationCode: FILTERING_OPERATION_CODE__BETWEEN,
            argument: ["2026-02-01", "2026-02-28"],
          },
        ],
      },
    ]

    expect(normalizeDraftToQueryFilterGroups(drafts)).toEqual([
      {
        id: "date",
        criteriaID: "date",
        criteriaName: "Date",
        queryKey: undefined,
        dataType: QUERY_FILTER_ARGUMENT_DATA_TYPE__DATE,
        joinOperator: QUERY_FILTER_JOIN_OPERATOR__AND,
        clauses: [
          {
            id: "date-complete-between",
            operationCode: FILTERING_OPERATION_CODE__BETWEEN,
            argument: ["2026-02-01", "2026-02-28"],
          },
        ],
      },
    ])
  })

  it("Computes scalar, multi-value, range, and boolean argument input types from operation codes.", () => {
    expect(
      computeFilterArgumentTypeFromOperationCode({
        dataType: QUERY_FILTER_ARGUMENT_DATA_TYPE__TEXT,
        operationCode: FILTERING_OPERATION_CODE__LIKE,
      }),
    ).toBe(FILTER_ARGUMENT_TYPE__INPUT)
    expect(
      computeFilterArgumentTypeFromOperationCode({
        dataType: QUERY_FILTER_ARGUMENT_DATA_TYPE__TEXT,
        operationCode: FILTERING_OPERATION_CODE__EQUAL,
        usesSelectInput: true,
      }),
    ).toBe(FILTER_ARGUMENT_TYPE__SELECT)
    expect(
      computeFilterArgumentTypeFromOperationCode({
        dataType: QUERY_FILTER_ARGUMENT_DATA_TYPE__TEXT,
        operationCode: FILTERING_OPERATION_CODE__IN,
      }),
    ).toBe(FILTER_ARGUMENT_TYPE__MULTI_INPUT)
    expect(
      computeFilterArgumentTypeFromOperationCode({
        dataType: QUERY_FILTER_ARGUMENT_DATA_TYPE__TEXT,
        operationCode: FILTERING_OPERATION_CODE__IN,
        conditionType: FILTER_CONDITION_TYPE_CODE__MULTI_SELECT,
      }),
    ).toBe(FILTER_ARGUMENT_TYPE__MULTI_SELECT)
    expect(
      computeFilterArgumentTypeFromOperationCode({
        dataType: QUERY_FILTER_ARGUMENT_DATA_TYPE__TEXT,
        operationCode: FILTERING_OPERATION_CODE__IN,
        conditionType: FILTER_CONDITION_TYPE_CODE__RANGE,
      }),
    ).toBe(FILTER_ARGUMENT_TYPE__RANGE)
    expect(
      computeFilterArgumentTypeFromOperationCode({
        dataType: QUERY_FILTER_ARGUMENT_DATA_TYPE__DATE,
        operationCode: FILTERING_OPERATION_CODE__BETWEEN,
      }),
    ).toBe(FILTER_ARGUMENT_TYPE__RANGE)
    expect(
      computeFilterArgumentTypeFromOperationCode({
        dataType: QUERY_FILTER_ARGUMENT_DATA_TYPE__BOOLEAN,
        operationCode: FILTERING_OPERATION_CODE__EQUAL,
      }),
    ).toBe(FILTER_ARGUMENT_TYPE__BOOLEAN)
  })
})
