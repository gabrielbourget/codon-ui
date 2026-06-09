import type { TModifyFilterClauseArgs, TQueryFilterGroupDraft } from "../../../Table/filterDraft"
import type { TAvailableBooleanArgumentComponents, TAvailableFilterCriteria } from "../../../Table/filterMetadata"
import type { TTableFilterJoinOperator } from "../../../Table/queryTypes"
import type { TSortAndFilterPanelLabels } from "../../labels"

export type TActiveFiltersProps = {
  filterGroupDrafts: TQueryFilterGroupDraft[]
  availableFilterCriteria: TAvailableFilterCriteria[]
  labels: Pick<TSortAndFilterPanelLabels, "activeFilters" | "filtering">
  onChangeFilterGroupJoinOperator: (criteriaID: string, joinOperator: TTableFilterJoinOperator) => void
  onAddFilterParameter: (criteriaID: string) => void
  onModifyFilterClause: (args: TModifyFilterClauseArgs) => void
  onDeleteFilterParameter: (listItemID: string) => void
  booleanArgumentComponent?: TAvailableBooleanArgumentComponents
}
