// @ts-expect-error The complete SortAndFilterPanel contract is still private.
import { SortAndFilterPanel as PublicPanel } from "../src"
import {
  SortAndFilterPanel,
  type TNativeSortAndFilterPanelProps,
} from "../src/components/SortAndFilterPanel/SortAndFilterPanel"

export const panel = (
  <SortAndFilterPanel
    isOpen
    onOpenChange={() => {}}
    possibleSortCriteria={[]}
    possibleFilterCriteria={[]}
    applyPendingSortAndFilterChanges={(request) => {
      const empty: string[] = request.sortInstructions.map((sort) => sort.criteriaID)
      void empty
    }}
    initialFocusTarget="filter"
    width={0}
    height="100%"
    horizontalGap={0}
    raised={false}
    overlayBlur={false}
    labels={{ form: { addFilterCriteriaPlaceholder: "" }, activeFilters: { joinOperators: { or: "Any" } } }}
    customDialogStyles={{ padding: 0 }}
  />
)
// @ts-expect-error Focus targets retain the canonical finite policy.
export const invalidTarget: TNativeSortAndFilterPanelProps["initialFocusTarget"] = "search"
// @ts-expect-error Application receives the complete typed query request.
export const invalidApply: TNativeSortAndFilterPanelProps["applyPendingSortAndFilterChanges"] = (_value: string) => {}
void PublicPanel
