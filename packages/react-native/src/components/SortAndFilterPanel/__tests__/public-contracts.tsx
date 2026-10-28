import {
  SortAndFilterPanel,
  DEFAULT_SORT_AND_FILTER_PANEL_LABELS,
  resolveSortAndFilterPanelLabels,
  AVAILABLE_SORT_AND_FILTER_PANEL_FOCUS_TARGETS,
  SORT_AND_FILTER_PANEL_FOCUS_TARGET__FILTER,
  type SortAndFilterPanelProps,
  type SortAndFilterPanelFocusTarget,
  type SortAndFilterPanelLabels,
  type SortAndFilterPanelFilterGroup,
  type SortAndFilterPanelSortInstruction,
  type ApplySortAndFilterParametersArgs,
  type AvailableSortAndFilterPanelListItem,
} from "../../.."
const target: SortAndFilterPanelFocusTarget = SORT_AND_FILTER_PANEL_FOCUS_TARGET__FILTER
const item: AvailableSortAndFilterPanelListItem = { id: "", name: "", argumentValue: false }
const sort: SortAndFilterPanelSortInstruction = { id: "", criteriaID: "", criteriaName: "", sortDirection: "Ascending" }
const filter: SortAndFilterPanelFilterGroup = {
  id: "f",
  criteriaID: "active",
  criteriaName: "Active",
  dataType: "boolean",
  joinOperator: "and",
  clauses: [],
}
const labels: SortAndFilterPanelLabels = resolveSortAndFilterPanelLabels({ filtering: { popover: { title: "" } } })
const title: string = labels.filtering.popover.title
const fallback: string = DEFAULT_SORT_AND_FILTER_PANEL_LABELS.filtering.popover.title
const props: SortAndFilterPanelProps = {
  isOpen: true,
  onOpenChange: () => {},
  initialFocusTarget: target,
  possibleSortCriteria: [],
  possibleFilterCriteria: [],
  activeSorts: [sort],
  activeFilters: [filter],
  applyPendingSortAndFilterChanges: (value: ApplySortAndFilterParametersArgs) => {
    void value
  },
}
export const complete = <SortAndFilterPanel {...props} />
void [item, title, fallback, AVAILABLE_SORT_AND_FILTER_PANEL_FOCUS_TARGETS]
