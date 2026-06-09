import {
  DEFAULT_TABLE_FILTERING_LABELS,
  resolveTableFilteringLabels,
  type TPartialTableFilteringLabels,
  type TTableFilteringLabels,
} from "../Filtering/labels"
import {
  TABLE_FILTER_JOIN_OPERATOR__AND,
  TABLE_FILTER_JOIN_OPERATOR__OR,
  type TTableSortInstruction,
} from "../Table/queryTypes"

export type TSortAndFilterPanelFormLabels = {
  addSortCriteriaLabel: string
  addSortCriteriaPlaceholder: string
  addFilterCriteriaLabel: string
  addFilterCriteriaPlaceholder: string
}

export type TSortAndFilterPanelHeaderLabels = {
  closeButtonAriaLabel: string
}

export type TSortAndFilterPanelFooterLabels = {
  clearAllButton: string
  cancelButton: string
  applyButton: string
}

export type TSortAndFilterPanelActiveSortsLabels = {
  headingLabel: string
  noSortsFallback: string
  activeSortsAriaLabel: string
}

export type TSortAndFilterPanelSortParameterListLabels = {
  listAriaLabel: string
  itemAriaLabel: (args: { criteriaName: string; sortDirection: TTableSortInstruction["sortDirection"] }) => string
}

export type TSortAndFilterPanelSortEntryLabels = {
  controlsGroupAriaLabel: string
  sortAscendingButtonAriaLabel: string
  sortDescendingButtonAriaLabel: string
  deleteButtonAriaLabel: string
}

export type TSortAndFilterPanelActiveFiltersLabels = {
  headingLabel: string
  noFiltersFallback: string
  activeFiltersAriaLabel: string
  activeFiltersListAriaLabel: string
  filterGroupAriaLabel: (args: { criteriaName: string }) => string
  filterGroupLabel: string
  addFilterButtonAriaLabel: (args: { criteriaName: string }) => string
  matchModeAriaLabel: (args: { criteriaName: string }) => string
  joinOperators: {
    [TABLE_FILTER_JOIN_OPERATOR__AND]: string
    [TABLE_FILTER_JOIN_OPERATOR__OR]: string
  }
}

export type TSortAndFilterPanelLabels = {
  form: TSortAndFilterPanelFormLabels
  header: TSortAndFilterPanelHeaderLabels
  footer: TSortAndFilterPanelFooterLabels
  activeSorts: TSortAndFilterPanelActiveSortsLabels
  sortParameterList: TSortAndFilterPanelSortParameterListLabels
  sortEntry: TSortAndFilterPanelSortEntryLabels
  activeFilters: TSortAndFilterPanelActiveFiltersLabels
  filtering: TTableFilteringLabels
}

export type TPartialSortAndFilterPanelActiveFiltersLabels = Omit<
  Partial<TSortAndFilterPanelActiveFiltersLabels>,
  "joinOperators"
> & {
  joinOperators?: Partial<TSortAndFilterPanelActiveFiltersLabels["joinOperators"]>
}

export type TPartialSortAndFilterPanelLabels = {
  form?: Partial<TSortAndFilterPanelFormLabels>
  header?: Partial<TSortAndFilterPanelHeaderLabels>
  footer?: Partial<TSortAndFilterPanelFooterLabels>
  activeSorts?: Partial<TSortAndFilterPanelActiveSortsLabels>
  sortParameterList?: Partial<TSortAndFilterPanelSortParameterListLabels>
  sortEntry?: Partial<TSortAndFilterPanelSortEntryLabels>
  activeFilters?: TPartialSortAndFilterPanelActiveFiltersLabels
  filtering?: TPartialTableFilteringLabels
}

export const DEFAULT_SORT_AND_FILTER_PANEL_LABELS: TSortAndFilterPanelLabels = {
  form: {
    addSortCriteriaLabel: "Add Sort Criteria",
    addSortCriteriaPlaceholder: "Select Sort Criteria",
    addFilterCriteriaLabel: "Add Filter Criteria",
    addFilterCriteriaPlaceholder: "Select Filter Criteria",
  },
  header: {
    closeButtonAriaLabel: "Close Sort and Filter Panel",
  },
  footer: {
    clearAllButton: "Clear All",
    cancelButton: "Cancel",
    applyButton: "Apply",
  },
  activeSorts: {
    headingLabel: "Sorting By:",
    noSortsFallback: "No sorting currently applied",
    activeSortsAriaLabel: "Active Sort Parameters",
  },
  sortParameterList: {
    listAriaLabel: "Sort Parameter List",
    itemAriaLabel: ({ criteriaName, sortDirection }) => `Sort Parameter - ${criteriaName} - ${sortDirection}`,
  },
  sortEntry: {
    controlsGroupAriaLabel: "Sort Parameter List Item Controls",
    sortAscendingButtonAriaLabel: "Sort Ascending",
    sortDescendingButtonAriaLabel: "Sort Descending",
    deleteButtonAriaLabel: "Delete Sort Entry",
  },
  activeFilters: {
    headingLabel: "Filtering By:",
    noFiltersFallback: "No filters currently applied",
    activeFiltersAriaLabel: "Active Filter Parameters",
    activeFiltersListAriaLabel: "Filter Parameter List",
    filterGroupAriaLabel: ({ criteriaName }) => `${criteriaName} filter group`,
    filterGroupLabel: "Filters:",
    addFilterButtonAriaLabel: ({ criteriaName }) => `Add filter for ${criteriaName}`,
    matchModeAriaLabel: ({ criteriaName }) => `${criteriaName} filter match mode`,
    joinOperators: {
      [TABLE_FILTER_JOIN_OPERATOR__AND]: "Match all",
      [TABLE_FILTER_JOIN_OPERATOR__OR]: "Match any",
    },
  },
  filtering: DEFAULT_TABLE_FILTERING_LABELS,
}

export const resolveSortAndFilterPanelLabels = (
  labels?: TPartialSortAndFilterPanelLabels,
): TSortAndFilterPanelLabels => ({
  form: {
    ...DEFAULT_SORT_AND_FILTER_PANEL_LABELS.form,
    ...labels?.form,
  },
  header: {
    ...DEFAULT_SORT_AND_FILTER_PANEL_LABELS.header,
    ...labels?.header,
  },
  footer: {
    ...DEFAULT_SORT_AND_FILTER_PANEL_LABELS.footer,
    ...labels?.footer,
  },
  activeSorts: {
    ...DEFAULT_SORT_AND_FILTER_PANEL_LABELS.activeSorts,
    ...labels?.activeSorts,
  },
  sortParameterList: {
    ...DEFAULT_SORT_AND_FILTER_PANEL_LABELS.sortParameterList,
    ...labels?.sortParameterList,
  },
  sortEntry: {
    ...DEFAULT_SORT_AND_FILTER_PANEL_LABELS.sortEntry,
    ...labels?.sortEntry,
  },
  activeFilters: {
    ...DEFAULT_SORT_AND_FILTER_PANEL_LABELS.activeFilters,
    ...labels?.activeFilters,
    joinOperators: {
      ...DEFAULT_SORT_AND_FILTER_PANEL_LABELS.activeFilters.joinOperators,
      ...labels?.activeFilters?.joinOperators,
    },
  },
  filtering: resolveTableFilteringLabels(labels?.filtering),
})
