import type { TPartialNativeTableFilteringLabels } from "../Table/filterLabels"

import { resolveQueryControlLabels, type TPartialQueryControlLabels } from "./controlLabels"

const activeFilters = {
  headingLabel: "Filtering By:",
  noFiltersFallback: "No filters currently applied",
  activeFiltersAriaLabel: "Active Filter Parameters",
  activeFiltersListAriaLabel: "Filter Parameter List",
  filterGroupAriaLabel: ({ criteriaName }: { criteriaName: string }) => `${criteriaName} filter group`,
  filterGroupLabel: "Filters:",
  addFilterButtonAriaLabel: ({ criteriaName }: { criteriaName: string }) => `Add filter for ${criteriaName}`,
  matchModeAriaLabel: ({ criteriaName }: { criteriaName: string }) => `${criteriaName} filter match mode`,
  joinOperators: { and: "Match all", or: "Match any" },
}
export type TPartialNativeSortAndFilterPanelLabels = Omit<TPartialQueryControlLabels, "form"> & {
  form?: TPartialQueryControlLabels["form"] & {
    addFilterCriteriaLabel?: string
    addFilterCriteriaPlaceholder?: string
  }
  activeFilters?: Omit<Partial<typeof activeFilters>, "joinOperators"> & {
    joinOperators?: Partial<typeof activeFilters.joinOperators>
  }
  filtering?: TPartialNativeTableFilteringLabels
  native?: { closeSortCriteria?: string; closeFilterCriteria?: string }
}
export const resolveNativeSortAndFilterPanelLabels = (labels?: TPartialNativeSortAndFilterPanelLabels) => {
  const queryLabels = resolveQueryControlLabels(labels)
  return {
    ...queryLabels,
    form: {
      ...queryLabels.form,
      addFilterCriteriaLabel: "Add Filter Criteria",
      addFilterCriteriaPlaceholder: "Select Filter Criteria",
      ...labels?.form,
    },
    activeFilters: {
      ...activeFilters,
      ...labels?.activeFilters,
      joinOperators: { ...activeFilters.joinOperators, ...labels?.activeFilters?.joinOperators },
    },
    filtering: labels?.filtering,
    native: {
      closeSortCriteria: "Close sort criteria",
      closeFilterCriteria: "Close filter criteria",
      ...labels?.native,
    },
  }
}
export type TNativeSortAndFilterPanelLabels = ReturnType<typeof resolveNativeSortAndFilterPanelLabels>
