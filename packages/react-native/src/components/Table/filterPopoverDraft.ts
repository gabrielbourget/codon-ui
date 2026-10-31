import {
  computeNextQueryFilterClauseOperationCode,
  createQueryFilterClauseDraft,
  type TQueryFilterGroupDraft,
} from "./filterDraft"
import type { TTableFilterGroup } from "./queryTypes"
import type { TNativeTableColumnMetadata } from "./types"

export const buildNativeTableFilterDraft = <T extends object>(
  column: TNativeTableColumnMetadata<T>,
  group?: TTableFilterGroup,
): TQueryFilterGroupDraft => {
  const criteriaID = column.filter?.criteriaID ?? column.id
  const options = column.filter?.availableCriteriaArguments
  return {
    id: criteriaID,
    criteriaID,
    criteriaName: column.name ?? column.id,
    queryKey: column.filter?.queryKey,
    dataType: column.filter?.dataType ?? "text",
    joinOperator: group?.clauses.length ? group.joinOperator : "and",
    usesTypeAheadInput: column.filter?.usesTypeAheadInput,
    typeAheadInputOnChange: column.filter?.typeAheadInputOnChange,
    usesSelectInput: column.filter?.usesSelectInput,
    usesComboBoxInput: column.filter?.usesComboBoxInput,
    availableFilterArguments: options,
    clauses: group?.clauses.length
      ? group.clauses.map((clause) => ({
          id: clause.id,
          operationCode: clause.operationCode,
          argument: clause.argument,
          filterArgumentSelectedKey:
            options?.find((item) => (item.argumentValue ?? item.name) === clause.argument)?.id ?? null,
        }))
      : [
          createQueryFilterClauseDraft({
            id: `${criteriaID}-clause-1`,
            operationCode: computeNextQueryFilterClauseOperationCode({
              allowedOperationCodes: column.filter?.allowedOperationCodes ?? [],
            }),
          }),
        ],
  }
}
export const replaceNativeTableFilterGroup = (
  active: TTableFilterGroup[],
  criteriaID: string,
  next?: TTableFilterGroup,
) => {
  let replaced = false
  const result = active.flatMap((group) => {
    if (group.criteriaID !== criteriaID) return [group]
    replaced = true
    return next ? [next] : []
  })
  return !replaced && next ? [...result, next] : result
}
