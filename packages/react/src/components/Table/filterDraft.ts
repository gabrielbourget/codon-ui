import {
  FILTER_ARGUMENT_TYPE__BOOLEAN,
  FILTER_ARGUMENT_TYPE__COMBOBOX,
  FILTER_ARGUMENT_TYPE__INPUT,
  FILTER_ARGUMENT_TYPE__MULTI_INPUT,
  FILTER_ARGUMENT_TYPE__MULTI_SELECT,
  FILTER_ARGUMENT_TYPE__MULTI_TYPEAHEAD_SEARCH,
  FILTER_ARGUMENT_TYPE__RANGE,
  FILTER_ARGUMENT_TYPE__SELECT,
  FILTER_ARGUMENT_TYPE__TYPEAHEAD_SEARCH,
  type TAvailableFilterArgumentTypes,
  type TAvailableFilterCriteria,
} from "./filterMetadata"
import {
  TABLE_FILTER_ARGUMENT_DATA_TYPE__BOOLEAN as QUERY_FILTER_ARGUMENT_DATA_TYPE__BOOLEAN,
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
  TABLE_FILTER_OPERATION_CODE__GREATER_THAN as FILTERING_OPERATION_CODE__GREATER_THAN,
  TABLE_FILTER_OPERATION_CODE__GREATER_THAN_EQUAL as FILTERING_OPERATION_CODE__GREATER_THAN_EQUAL,
  TABLE_FILTER_OPERATION_CODE__IN as FILTERING_OPERATION_CODE__IN,
  TABLE_FILTER_OPERATION_CODE__LESS_THAN as FILTERING_OPERATION_CODE__LESS_THAN,
  TABLE_FILTER_OPERATION_CODE__LESS_THAN_EQUAL as FILTERING_OPERATION_CODE__LESS_THAN_EQUAL,
  TABLE_FILTER_OPERATION_CODE__LIKE as FILTERING_OPERATION_CODE__LIKE,
  TABLE_FILTER_OPERATION_CODE__NOT_EQUAL as FILTERING_OPERATION_CODE__NOT_EQUAL,
  TABLE_FILTER_OPERATION_CODE__NOT_GREATER_THAN as FILTERING_OPERATION_CODE__NOT_GREATER_THAN,
  TABLE_FILTER_OPERATION_CODE__NOT_GREATER_THAN_EQUAL as FILTERING_OPERATION_CODE__NOT_GREATER_THAN_EQUAL,
  TABLE_FILTER_OPERATION_CODE__NOT_IN as FILTERING_OPERATION_CODE__NOT_IN,
  TABLE_FILTER_OPERATION_CODE__NOT_LESS_THAN as FILTERING_OPERATION_CODE__NOT_LESS_THAN,
  TABLE_FILTER_OPERATION_CODE__NOT_LESS_THAN_EQUAL as FILTERING_OPERATION_CODE__NOT_LESS_THAN_EQUAL,
  TABLE_FILTER_OPERATION_CODE__NOT_LIKE as FILTERING_OPERATION_CODE__NOT_LIKE,
  TABLE_FILTER_OPERATION_CODE__SIMILAR_TO as FILTERING_OPERATION_CODE__SIMILAR_TO,
  type TTableFilterArgumentDataType as TQueryFilterArgumentDataType,
  type TTableFilterArgumentValue as TQueryFilterArgumentValue,
  type TTableFilterClause as TQueryFilterClause,
  type TTableFilterConditionType as TFilterConditionTypeCode,
  type TTableFilterGroup as TQueryFilterGroup,
  type TTableFilterJoinOperator as TQueryFilterJoinOperator,
  type TTableFilterOperationCode as TFilteringOperationCode,
} from "./queryTypes"

export type TQueryFilterDraftArgumentOption = {
  id: string
  name: string
}

export type TQueryFilterClauseDraft = {
  id: string
  operationCode?: TFilteringOperationCode
  conditionType?: TFilterConditionTypeCode
  argument?: TQueryFilterArgumentValue
  filterArgumentSelectedKey?: string | null
}

export type TQueryFilterGroupDraft = {
  id: string
  criteriaID: string
  criteriaName: string
  queryKey?: string
  dataType: TQueryFilterArgumentDataType
  joinOperator: TQueryFilterJoinOperator
  clauses: TQueryFilterClauseDraft[]
  usesTypeAheadInput?: boolean
  typeAheadInputOnChange?: (value: string) => void
  usesSelectInput?: boolean
  usesComboBoxInput?: boolean
  availableFilterArguments?: TQueryFilterDraftArgumentOption[]
}

export type TModifyFilterClauseArgs = {
  updatedClause: TQueryFilterClauseDraft
  newCriteriaID: string
}

export type TComputeFilterArgumentTypeFromOperationCodeOptions = {
  dataType: TQueryFilterArgumentDataType
  operationCode?: TFilteringOperationCode
  conditionType?: TFilterConditionTypeCode
  usesTypeAheadInput?: boolean
  usesSelectInput?: boolean
  usesComboBoxInput?: boolean
}

export type TCreateQueryFilterClauseDraftArgs = {
  id: string
  operationCode?: TFilteringOperationCode
  conditionType?: TFilterConditionTypeCode
  argument?: TQueryFilterArgumentValue
  filterArgumentSelectedKey?: string | null
}

export type TCreateQueryFilterGroupDraftFromCriteriaOptions = {
  groupID?: string
  clauseID?: string
  joinOperator?: TQueryFilterJoinOperator
  operationCode?: TFilteringOperationCode
}

export type TAppendQueryFilterClauseDraftToGroupOptions = Omit<TCreateQueryFilterClauseDraftArgs, "id"> & {
  allowDuplicateOperationCodes?: boolean
  allowedOperationCodes?: readonly TFilteringOperationCode[]
  clauseID?: string
}

const getNextQueryFilterClauseDraftID = (group: TQueryFilterGroupDraft): string => {
  const clauseIDPrefix = `${group.id}-clause-`
  const usedClauseIDs = new Set(group.clauses.map((clause) => clause.id))
  let nextClausePosition = group.clauses.length + 1

  while (usedClauseIDs.has(`${clauseIDPrefix}${nextClausePosition}`)) {
    nextClausePosition += 1
  }

  return `${clauseIDPrefix}${nextClausePosition}`
}

const scalarFilteringOperationCodes = [
  FILTERING_OPERATION_CODE__EQUAL,
  FILTERING_OPERATION_CODE__NOT_EQUAL,
  FILTERING_OPERATION_CODE__LIKE,
  FILTERING_OPERATION_CODE__NOT_LIKE,
  FILTERING_OPERATION_CODE__SIMILAR_TO,
  FILTERING_OPERATION_CODE__GREATER_THAN,
  FILTERING_OPERATION_CODE__GREATER_THAN_EQUAL,
  FILTERING_OPERATION_CODE__LESS_THAN,
  FILTERING_OPERATION_CODE__LESS_THAN_EQUAL,
  FILTERING_OPERATION_CODE__NOT_GREATER_THAN,
  FILTERING_OPERATION_CODE__NOT_GREATER_THAN_EQUAL,
  FILTERING_OPERATION_CODE__NOT_LESS_THAN,
  FILTERING_OPERATION_CODE__NOT_LESS_THAN_EQUAL,
] as const

const multiValueFilteringOperationCodes = [FILTERING_OPERATION_CODE__IN, FILTERING_OPERATION_CODE__NOT_IN] as const
const scalarFilteringOperationCodeSet = new Set<TFilteringOperationCode>(scalarFilteringOperationCodes)
const multiValueFilteringOperationCodeSet = new Set<TFilteringOperationCode>(multiValueFilteringOperationCodes)

export const computeInitialQueryFilterDraftArgument = (
  operationCode?: TFilteringOperationCode,
): TQueryFilterArgumentValue => {
  if (operationCode === FILTERING_OPERATION_CODE__BETWEEN) return ["", ""]
  if (operationCode && multiValueFilteringOperationCodeSet.has(operationCode)) return []

  return undefined
}

export const createQueryFilterClauseDraft = ({
  id,
  operationCode,
  conditionType,
  argument = computeInitialQueryFilterDraftArgument(operationCode),
  filterArgumentSelectedKey = null,
}: TCreateQueryFilterClauseDraftArgs): TQueryFilterClauseDraft => ({
  id,
  operationCode,
  conditionType,
  argument,
  filterArgumentSelectedKey,
})

export const computeNextQueryFilterClauseOperationCode = ({
  allowDuplicateOperationCodes = true,
  allowedOperationCodes,
  existingOperationCodes = [],
}: {
  allowDuplicateOperationCodes?: boolean
  allowedOperationCodes?: readonly TFilteringOperationCode[]
  existingOperationCodes?: readonly (TFilteringOperationCode | undefined)[]
}): TFilteringOperationCode | undefined => {
  const nextUnusedOperationCode = allowedOperationCodes?.find(
    (operationCode) => !existingOperationCodes.includes(operationCode),
  )

  return nextUnusedOperationCode ?? (allowDuplicateOperationCodes ? allowedOperationCodes?.[0] : undefined)
}

export const createQueryFilterGroupDraftFromCriteria = (
  criteria: TAvailableFilterCriteria,
  options: TCreateQueryFilterGroupDraftFromCriteriaOptions = {},
): TQueryFilterGroupDraft => {
  const groupID = options.groupID ?? criteria.id
  const operationCode =
    options.operationCode ??
    computeNextQueryFilterClauseOperationCode({
      allowedOperationCodes: criteria.allowedOperationCodes,
    })

  return {
    id: groupID,
    criteriaID: criteria.id,
    criteriaName: criteria.name,
    queryKey: criteria.queryKey,
    dataType: criteria.dataType as TQueryFilterArgumentDataType,
    joinOperator: options.joinOperator ?? QUERY_FILTER_JOIN_OPERATOR__AND,
    usesTypeAheadInput: criteria.usesTypeAheadInput,
    typeAheadInputOnChange: criteria.typeAheadInputOnChange,
    usesSelectInput: criteria.usesSelectInput,
    usesComboBoxInput: criteria.usesComboBoxInput,
    availableFilterArguments: criteria.availableCriteriaArguments,
    clauses: [
      createQueryFilterClauseDraft({
        id: options.clauseID ?? `${groupID}-clause-1`,
        operationCode,
      }),
    ],
  }
}

export const appendQueryFilterClauseDraftToGroup = (
  group: TQueryFilterGroupDraft,
  options: TAppendQueryFilterClauseDraftToGroupOptions = {},
): TQueryFilterGroupDraft => {
  const nextAllowedOperationCode = computeNextQueryFilterClauseOperationCode({
    allowDuplicateOperationCodes: options.allowDuplicateOperationCodes,
    allowedOperationCodes: options.allowedOperationCodes,
    existingOperationCodes: group.clauses.map((clause) => clause.operationCode),
  })
  const fallbackOperationCode = options.allowedOperationCodes ? undefined : group.clauses.at(-1)?.operationCode
  const operationCode = options.operationCode ?? nextAllowedOperationCode ?? fallbackOperationCode

  if (!operationCode) return group

  return {
    ...group,
    clauses: [
      ...group.clauses,
      createQueryFilterClauseDraft({
        ...options,
        id: options.clauseID ?? getNextQueryFilterClauseDraftID(group),
        operationCode,
      }),
    ],
  }
}

const supportsScalarInput = (dataType: TQueryFilterArgumentDataType) => {
  return (
    dataType === QUERY_FILTER_ARGUMENT_DATA_TYPE__NUMBER ||
    dataType === QUERY_FILTER_ARGUMENT_DATA_TYPE__TEXT ||
    dataType === QUERY_FILTER_ARGUMENT_DATA_TYPE__DATE ||
    dataType === QUERY_FILTER_ARGUMENT_DATA_TYPE__DATETIME ||
    dataType === QUERY_FILTER_ARGUMENT_DATA_TYPE__TIME
  )
}

const computeTextScalarArgumentType = (options: TComputeFilterArgumentTypeFromOperationCodeOptions) => {
  const { usesComboBoxInput, usesSelectInput, usesTypeAheadInput } = options

  if (usesTypeAheadInput) return FILTER_ARGUMENT_TYPE__TYPEAHEAD_SEARCH
  if (usesSelectInput) return FILTER_ARGUMENT_TYPE__SELECT
  if (usesComboBoxInput) return FILTER_ARGUMENT_TYPE__COMBOBOX

  return FILTER_ARGUMENT_TYPE__INPUT
}

const computeTextMultiValueArgumentType = (options: TComputeFilterArgumentTypeFromOperationCodeOptions) => {
  const { conditionType = FILTER_CONDITION_TYPE_CODE__LIST, usesTypeAheadInput } = options

  if (conditionType === FILTER_CONDITION_TYPE_CODE__MULTI_SELECT) return FILTER_ARGUMENT_TYPE__MULTI_SELECT
  if (conditionType === FILTER_CONDITION_TYPE_CODE__RANGE) return FILTER_ARGUMENT_TYPE__RANGE
  if (usesTypeAheadInput) return FILTER_ARGUMENT_TYPE__MULTI_TYPEAHEAD_SEARCH

  return FILTER_ARGUMENT_TYPE__MULTI_INPUT
}

export const computeFilterArgumentTypeFromOperationCode = (
  options: TComputeFilterArgumentTypeFromOperationCodeOptions,
): TAvailableFilterArgumentTypes | undefined => {
  const { dataType, operationCode } = options

  if (!operationCode) return undefined

  if (operationCode === FILTERING_OPERATION_CODE__BETWEEN) {
    return supportsScalarInput(dataType) ? FILTER_ARGUMENT_TYPE__RANGE : undefined
  }

  if (multiValueFilteringOperationCodeSet.has(operationCode)) {
    if (dataType === QUERY_FILTER_ARGUMENT_DATA_TYPE__NUMBER) return FILTER_ARGUMENT_TYPE__MULTI_INPUT
    if (dataType === QUERY_FILTER_ARGUMENT_DATA_TYPE__TEXT) return computeTextMultiValueArgumentType(options)
    if (
      dataType === QUERY_FILTER_ARGUMENT_DATA_TYPE__DATE ||
      dataType === QUERY_FILTER_ARGUMENT_DATA_TYPE__DATETIME ||
      dataType === QUERY_FILTER_ARGUMENT_DATA_TYPE__TIME
    ) {
      return FILTER_ARGUMENT_TYPE__MULTI_INPUT
    }

    return undefined
  }

  if (scalarFilteringOperationCodeSet.has(operationCode)) {
    if (dataType === QUERY_FILTER_ARGUMENT_DATA_TYPE__BOOLEAN) {
      return operationCode === FILTERING_OPERATION_CODE__EQUAL || operationCode === FILTERING_OPERATION_CODE__NOT_EQUAL
        ? FILTER_ARGUMENT_TYPE__BOOLEAN
        : undefined
    }

    if (!supportsScalarInput(dataType)) return undefined
    if (dataType === QUERY_FILTER_ARGUMENT_DATA_TYPE__TEXT) return computeTextScalarArgumentType(options)

    return FILTER_ARGUMENT_TYPE__INPUT
  }

  return undefined
}

const isMeaningfulArgument = (argument: TQueryFilterArgumentValue): boolean => {
  if (Array.isArray(argument)) return argument.some((item) => isMeaningfulArgument(item))
  if (typeof argument === "string") return argument.trim().length > 0

  return argument != null
}

const normalizeScalarArgument = (
  argument: Exclude<TQueryFilterArgumentValue, string[] | number[]>,
): Exclude<TQueryFilterArgumentValue, string[] | number[]> => {
  return typeof argument === "string" ? argument.trim() : argument
}

const normalizeArrayArgument = (
  operationCode: TFilteringOperationCode,
  argument: string[] | number[],
): string[] | number[] | undefined => {
  if (operationCode === FILTERING_OPERATION_CODE__BETWEEN) {
    const [minimumValue, maximumValue] = argument.map((item) => normalizeScalarArgument(item))

    return isMeaningfulArgument(minimumValue) && isMeaningfulArgument(maximumValue)
      ? ([minimumValue, maximumValue] as string[] | number[])
      : undefined
  }

  const meaningfulValues = argument
    .map((item) => normalizeScalarArgument(item))
    .filter((item) => isMeaningfulArgument(item))

  return meaningfulValues.length ? (meaningfulValues as string[] | number[]) : undefined
}

const normalizeClauseArgument = (
  operationCode: TFilteringOperationCode,
  argument: TQueryFilterArgumentValue,
): TQueryFilterArgumentValue => {
  if (Array.isArray(argument)) return normalizeArrayArgument(operationCode, argument)

  const normalizedArgument = normalizeScalarArgument(argument)
  return isMeaningfulArgument(normalizedArgument) ? normalizedArgument : undefined
}

export const normalizeDraftToQueryFilterGroups = (
  draftInput: TQueryFilterGroupDraft | TQueryFilterGroupDraft[],
): TQueryFilterGroup[] => {
  const drafts = Array.isArray(draftInput) ? draftInput : [draftInput]

  return drafts.flatMap((draft) => {
    const clauses: TQueryFilterClause[] = draft.clauses.flatMap((clause) => {
      if (!clause.operationCode) return []

      const argument = normalizeClauseArgument(clause.operationCode, clause.argument)
      if (!isMeaningfulArgument(argument)) return []

      return [
        {
          id: clause.id,
          operationCode: clause.operationCode,
          argument,
        },
      ]
    })

    if (!clauses.length) return []

    return [
      {
        id: draft.id,
        criteriaID: draft.criteriaID,
        criteriaName: draft.criteriaName,
        queryKey: draft.queryKey,
        dataType: draft.dataType,
        joinOperator: draft.joinOperator,
        clauses,
      },
    ]
  })
}
