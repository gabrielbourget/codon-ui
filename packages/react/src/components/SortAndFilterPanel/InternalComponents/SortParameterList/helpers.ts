import type {
  DraggableCollectionStartEvent,
  DroppableCollectionInsertDropEvent,
  DroppableCollectionReorderEvent,
} from "react-aria-components"

import type { TAvailableSortCriteria } from "../../../Table/filterMetadata"
import type { TTableSortInstruction } from "../../../Table/queryTypes"
import type { TSortAndFilterPanelLabels } from "../../labels"

export type TSortParameterListProps = {
  sortParameterList: TTableSortInstruction[]
  availableSortCriteria: TAvailableSortCriteria[]
  labels: Pick<TSortAndFilterPanelLabels, "sortParameterList" | "sortEntry">
  onModifySortParameter: ({ sortCriteriaID, listItemID }: { sortCriteriaID: string; listItemID: string }) => void
  onSortAscending: (listItemID: string) => void
  onSortDescending: (listItemID: string) => void
  onDeleteSortParameter: (listItemID: string) => void
  onSortParameterDrop: (e: DroppableCollectionReorderEvent | DroppableCollectionInsertDropEvent) => void
  onSortParameterDragStart: (e: DraggableCollectionStartEvent) => void
}
