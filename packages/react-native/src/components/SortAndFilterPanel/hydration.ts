import type { TQueryFilterGroupDraft } from "../Table/filterDraft"
import type { TAvailableFilterCriteria, TAvailableListItem } from "../Table/filterMetadata"
import type { TTableFilterArgumentValue, TTableFilterGroup } from "../Table/queryTypes"

const getFilterArgumentValue = (item: TAvailableListItem) => item.argumentValue ?? item.name

const inferFilterArgumentSelectedKey = (
  availableFilterArguments: TAvailableListItem[] | undefined,
  argument: TTableFilterArgumentValue,
) => {
  if (!availableFilterArguments?.length) return null
  const matchedArgument = availableFilterArguments.find((item) => getFilterArgumentValue(item) === argument)
  return matchedArgument?.id ?? null
}

export const buildFilterGroupDraftsFromQueryFilterGroups = (
  filterGroups: readonly TTableFilterGroup[],
  possibleFilterCriteria: readonly TAvailableFilterCriteria[],
): TQueryFilterGroupDraft[] =>
  filterGroups.flatMap((filterGroup) => {
    const matchingCriteria = possibleFilterCriteria.find((criteria) => criteria.id === filterGroup.criteriaID)
    if (!matchingCriteria) return []
    return [
      {
        id: filterGroup.id,
        criteriaID: matchingCriteria.id,
        criteriaName: matchingCriteria.name,
        queryKey: matchingCriteria.queryKey,
        dataType: matchingCriteria.dataType,
        joinOperator: filterGroup.joinOperator,
        usesTypeAheadInput: matchingCriteria.usesTypeAheadInput,
        typeAheadInputOnChange: matchingCriteria.typeAheadInputOnChange,
        usesSelectInput: matchingCriteria.usesSelectInput,
        usesComboBoxInput: matchingCriteria.usesComboBoxInput,
        availableFilterArguments: matchingCriteria.availableCriteriaArguments,
        clauses: filterGroup.clauses.map((clause) => ({
          id: clause.id,
          operationCode: clause.operationCode,
          argument: clause.argument,
          filterArgumentSelectedKey: inferFilterArgumentSelectedKey(
            matchingCriteria.availableCriteriaArguments,
            clause.argument,
          ),
        })),
      },
    ]
  })
