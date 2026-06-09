import type { TAvailableSortCriteria } from "../../../../../Table/filterMetadata"
import type { TTableSortInstruction } from "../../../../../Table/queryTypes"
import type { TSortAndFilterPanelSortEntryLabels } from "../../../../labels"

export type TSortParameterProps = {
  parameter: TTableSortInstruction
  availableSortCriteria: TAvailableSortCriteria[]
  labels: TSortAndFilterPanelSortEntryLabels
  onModifySortParameter: ({ sortCriteriaID, listItemID }: { sortCriteriaID: string; listItemID: string }) => void
  onSortAscending: (listItemID: string) => void
  onSortDescending: (listItemID: string) => void
  onDeleteSortParameter: (listItemID: string) => void
}
