import type { TTableSortInstruction } from "../Table/queryTypes"

export type TQueryControlLabels = {
  form: { addSortCriteriaLabel: string; addSortCriteriaPlaceholder: string }
  header: { closeButtonAriaLabel: string }
  footer: { clearAllButton: string; cancelButton: string; applyButton: string }
  activeSorts: { headingLabel: string; noSortsFallback: string; activeSortsAriaLabel: string }
  sortParameterList: {
    listAriaLabel: string
    itemAriaLabel: (args: { criteriaName: string; sortDirection: TTableSortInstruction["sortDirection"] }) => string
  }
  sortEntry: {
    controlsGroupAriaLabel: string
    sortAscendingButtonAriaLabel: string
    sortDescendingButtonAriaLabel: string
    deleteButtonAriaLabel: string
  }
}
export type TPartialQueryControlLabels = { [K in keyof TQueryControlLabels]?: Partial<TQueryControlLabels[K]> }

export const DEFAULT_QUERY_CONTROL_LABELS: TQueryControlLabels = {
  form: { addSortCriteriaLabel: "Add Sort Criteria", addSortCriteriaPlaceholder: "Select Sort Criteria" },
  header: { closeButtonAriaLabel: "Close Sort and Filter Panel" },
  footer: { clearAllButton: "Clear All", cancelButton: "Cancel", applyButton: "Apply" },
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
}

export const resolveQueryControlLabels = (labels?: TPartialQueryControlLabels): TQueryControlLabels => ({
  form: { ...DEFAULT_QUERY_CONTROL_LABELS.form, ...labels?.form },
  header: { ...DEFAULT_QUERY_CONTROL_LABELS.header, ...labels?.header },
  footer: { ...DEFAULT_QUERY_CONTROL_LABELS.footer, ...labels?.footer },
  activeSorts: { ...DEFAULT_QUERY_CONTROL_LABELS.activeSorts, ...labels?.activeSorts },
  sortParameterList: { ...DEFAULT_QUERY_CONTROL_LABELS.sortParameterList, ...labels?.sortParameterList },
  sortEntry: { ...DEFAULT_QUERY_CONTROL_LABELS.sortEntry, ...labels?.sortEntry },
})
