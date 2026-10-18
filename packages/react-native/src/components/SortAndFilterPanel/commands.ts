import {
  appendQueryFilterClauseDraftToGroup,
  createQueryFilterGroupDraftFromCriteria,
  type TModifyFilterClauseArgs,
  type TQueryFilterGroupDraft,
} from "../Table/filterDraft"
import type { TAvailableFilterCriteria, TAvailableSortCriteria } from "../Table/filterMetadata"
import {
  TABLE_SORT_DIRECTION__ASCENDING,
  type TTableFilterJoinOperator,
  type TTableSortDirection,
  type TTableSortInstruction,
} from "../Table/queryTypes"

export type TNativeQueryDraft = {
  sortInstructions: TTableSortInstruction[]
  filterGroups: TQueryFilterGroupDraft[]
}

export const availableSortCriteria = (sorts: TTableSortInstruction[], criteria: TAvailableSortCriteria[]) => {
  const used = new Set(sorts.map((item) => item.criteriaID))
  return criteria.filter((item) => !used.has(item.id))
}

export const addSort = (sorts: TTableSortInstruction[], criteria: TAvailableSortCriteria[], criteriaID: string) => {
  const selected = criteria.find((item) => item.id === criteriaID)
  if (!selected || sorts.some((item) => item.criteriaID === criteriaID)) return sorts
  return [
    ...sorts,
    {
      id: selected.id,
      criteriaID: selected.id,
      criteriaName: selected.name,
      queryKey: selected.queryKey,
      sortDirection: selected.defaultDirection ?? TABLE_SORT_DIRECTION__ASCENDING,
    },
  ]
}

export const modifySort = (
  sorts: TTableSortInstruction[],
  criteria: TAvailableSortCriteria[],
  rowID: string,
  criteriaID: string,
) => {
  const selected = criteria.find((item) => item.id === criteriaID)
  if (
    !selected ||
    !sorts.some((item) => item.id === rowID) ||
    sorts.some((item) => item.id !== rowID && item.criteriaID === criteriaID)
  )
    return sorts
  return sorts.map((item) =>
    item.id !== rowID
      ? item
      : {
          ...item,
          id: selected.id,
          criteriaID: selected.id,
          criteriaName: selected.name,
          queryKey: selected.queryKey,
        },
  )
}

export const setSortDirection = (sorts: TTableSortInstruction[], rowID: string, direction: TTableSortDirection) => {
  if (!sorts.some((item) => item.id === rowID && item.sortDirection !== direction)) return sorts
  return sorts.map((item) => (item.id === rowID ? { ...item, sortDirection: direction } : item))
}

export const removeSort = (sorts: TTableSortInstruction[], rowID: string) =>
  sorts.some((item) => item.id === rowID) ? sorts.filter((item) => item.id !== rowID) : sorts

export const reorderSort = (
  sorts: TTableSortInstruction[],
  sourceID: string,
  targetID: string,
  position: "before" | "after",
) => {
  const sourceIndex = sorts.findIndex((item) => item.id === sourceID)
  if (
    sourceID === targetID ||
    sourceIndex < 0 ||
    !sorts.some((item) => item.id === targetID) ||
    (position !== "before" && position !== "after")
  )
    return sorts
  const reordered = [...sorts]
  const [source] = reordered.splice(sourceIndex, 1)
  const targetIndex = reordered.findIndex((item) => item.id === targetID)
  reordered.splice(targetIndex + (position === "after" ? 1 : 0), 0, source)
  return reordered.every((item, index) => item === sorts[index]) ? sorts : reordered
}

export const addFilter = (
  groups: TQueryFilterGroupDraft[],
  criteria: TAvailableFilterCriteria[],
  criteriaID: string,
) => {
  const selected = criteria.find((item) => item.id === criteriaID)
  if (!selected) return groups
  const existing = groups.find((item) => item.criteriaID === criteriaID)
  if (!existing) return [...groups, createQueryFilterGroupDraftFromCriteria(selected)]
  const appended = appendQueryFilterClauseDraftToGroup(existing, {
    allowDuplicateOperationCodes: true,
    allowedOperationCodes: selected.allowedOperationCodes,
  })
  return appended === existing ? groups : groups.map((item) => (item === existing ? appended : item))
}

export const removeFilterClause = (groups: TQueryFilterGroupDraft[], clauseID: string) => {
  if (!groups.some((group) => group.clauses.some((item) => item.id === clauseID))) return groups
  return groups
    .map((group) =>
      group.clauses.some((item) => item.id === clauseID)
        ? { ...group, clauses: group.clauses.filter((item) => item.id !== clauseID) }
        : group,
    )
    .filter((group) => group.clauses.length > 0)
}

export const modifyFilterClause = (
  groups: TQueryFilterGroupDraft[],
  criteria: TAvailableFilterCriteria[],
  { updatedClause, newCriteriaID }: TModifyFilterClauseArgs,
) => {
  const source = groups.find((group) => group.clauses.some((item) => item.id === updatedClause.id))
  const selected = criteria.find((item) => item.id === newCriteriaID)
  if (!source || !selected) return groups
  if (source.criteriaID === newCriteriaID)
    return groups.map((group) =>
      group === source
        ? { ...group, clauses: group.clauses.map((item) => (item.id === updatedClause.id ? updatedClause : item)) }
        : group,
    )
  const remaining = removeFilterClause(groups, updatedClause.id)
  const target = remaining.find((group) => group.criteriaID === newCriteriaID)
  if (target)
    return remaining.map((group) =>
      group === target ? { ...group, clauses: [...group.clauses, updatedClause] } : group,
    )
  return [
    ...remaining,
    { ...createQueryFilterGroupDraftFromCriteria(selected, { clauseID: updatedClause.id }), clauses: [updatedClause] },
  ]
}

export const setFilterJoin = (
  groups: TQueryFilterGroupDraft[],
  criteriaID: string,
  joinOperator: TTableFilterJoinOperator,
) => {
  if (!groups.some((group) => group.criteriaID === criteriaID && group.joinOperator !== joinOperator)) return groups
  return groups.map((group) =>
    group.criteriaID === criteriaID && group.joinOperator !== joinOperator ? { ...group, joinOperator } : group,
  )
}

export const clearDraft = (draft: TNativeQueryDraft): TNativeQueryDraft =>
  draft.sortInstructions.length || draft.filterGroups.length ? { sortInstructions: [], filterGroups: [] } : draft
