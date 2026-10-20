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

export const rebaseFilterGroupDrafts = (
  filterGroups: TQueryFilterGroupDraft[],
  possibleFilterCriteria: TAvailableFilterCriteria[],
): TQueryFilterGroupDraft[] => {
  let changed = false
  const groups = filterGroups.map((group) => {
    const criteria = possibleFilterCriteria.find((item) => item.id === group.criteriaID)
    if (!criteria) return group
    const metadata = {
      criteriaName: criteria.name,
      queryKey: criteria.queryKey,
      dataType: criteria.dataType,
      usesTypeAheadInput: criteria.usesTypeAheadInput,
      typeAheadInputOnChange: criteria.typeAheadInputOnChange,
      usesSelectInput: criteria.usesSelectInput,
      usesComboBoxInput: criteria.usesComboBoxInput,
      availableFilterArguments: criteria.availableCriteriaArguments,
    }
    let clausesChanged = false
    const clauses = group.clauses.map((clause) => {
      const selectedKey = inferFilterArgumentSelectedKey(criteria.availableCriteriaArguments, clause.argument)
      if (clause.filterArgumentSelectedKey === selectedKey) return clause
      clausesChanged = true
      return { ...clause, filterArgumentSelectedKey: selectedKey }
    })
    if (
      !clausesChanged &&
      (Object.keys(metadata) as (keyof typeof metadata)[]).every((key) => group[key] === metadata[key])
    )
      return group
    changed = true
    return { ...group, ...metadata, clauses: clausesChanged ? clauses : group.clauses }
  })
  return changed ? groups : filterGroups
}
