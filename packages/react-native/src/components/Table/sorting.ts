import {
  TABLE_SORT_DIRECTION__ASCENDING,
  TABLE_SORT_DIRECTION__DESCENDING,
  type TTableSortInstruction,
} from "./queryTypes"
import type { TNativeTableColumnSortMetadata, TNativeTableSortingControls } from "./types"

export const computeNextNativeTableSorts = ({
  activeSorts,
  column,
  mode,
}: {
  activeSorts: TTableSortInstruction[]
  column: { id: string; name?: string; sort?: TNativeTableColumnSortMetadata }
  mode?: TNativeTableSortingControls["mode"]
}): TTableSortInstruction[] => {
  if (!column.sort?.criteriaID) return activeSorts
  const currentIndex = activeSorts.findIndex((sort) => sort.criteriaID === column.sort!.criteriaID)
  const current = activeSorts[currentIndex]
  const direction =
    current?.sortDirection === TABLE_SORT_DIRECTION__ASCENDING
      ? TABLE_SORT_DIRECTION__DESCENDING
      : current?.sortDirection === TABLE_SORT_DIRECTION__DESCENDING
        ? undefined
        : TABLE_SORT_DIRECTION__ASCENDING
  if (!direction)
    return mode === "multiple" ? activeSorts.filter((sort) => sort.criteriaID !== column.sort!.criteriaID) : []
  const next: TTableSortInstruction = {
    id: `sort-${column.sort.criteriaID}`,
    criteriaID: column.sort.criteriaID,
    criteriaName: column.name ?? column.id,
    queryKey: column.sort.queryKey,
    sortDirection: direction,
  }
  if (mode !== "multiple") return [next]
  return currentIndex < 0
    ? [...activeSorts, next]
    : activeSorts.map((sort, index) => (index === currentIndex ? next : sort))
}
