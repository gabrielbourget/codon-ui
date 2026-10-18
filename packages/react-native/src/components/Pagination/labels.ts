import type { TNativePaginationProps } from "./types"

export type TNativePaginationLabels = {
  root: { navigationAriaLabel: string; descriptionLabel: string; detailsLabel: string }
  primaryControls: {
    firstPageButton: string
    firstPageButtonAriaLabel: string
    previousPageButton: string
    previousPageButtonAriaLabel: string
    nextPageButton: string
    nextPageButtonAriaLabel: string
    lastPageButton: string
    lastPageButtonAriaLabel: string
    pageButtonAriaLabel: (page: number) => string
    overflowButtonAriaLabel: string
    overflowListAriaLabel: (position: number) => string
  }
  pageCounter: { counterText: string; ariaLabel: string }
  pageInput: {
    label: string
    inputAriaLabel: string
    placeholder: string
    submitButtonText: string
    submitButtonAriaLabel: string
    numberInput: { inputButtonGroupAriaLabel: string; incrementLabel: string; decrementLabel: string }
  }
  itemsPerPage: {
    label: string
    selectAriaLabel: string
    placeholder: string
    closeLabel: string
    emptyListMessage: string
  }
}
export type TNativePartialPaginationLabels = {
  [K in Exclude<keyof TNativePaginationLabels, "pageInput">]?: Partial<TNativePaginationLabels[K]>
} & {
  pageInput?: Partial<Omit<TNativePaginationLabels["pageInput"], "numberInput">> & {
    numberInput?: Partial<TNativePaginationLabels["pageInput"]["numberInput"]>
  }
}

export const DEFAULT_NATIVE_PAGINATION_LABELS: TNativePaginationLabels = {
  root: { navigationAriaLabel: "Pagination Navigation", descriptionLabel: "Description", detailsLabel: "Details" },
  primaryControls: {
    firstPageButton: "First",
    firstPageButtonAriaLabel: "First Page",
    previousPageButton: "Prev",
    previousPageButtonAriaLabel: "Previous Page",
    nextPageButton: "Next",
    nextPageButtonAriaLabel: "Next Page",
    lastPageButton: "Last",
    lastPageButtonAriaLabel: "Last Page",
    pageButtonAriaLabel: (page) => `Go To Page ${page}`,
    overflowButtonAriaLabel: "Visually Consolidated Pagination Items",
    overflowListAriaLabel: (position) => `Consolidated pages at position ${position}`,
  },
  pageCounter: { counterText: "Pages", ariaLabel: "Page Number Counter" },
  pageInput: {
    label: "Go To Page",
    inputAriaLabel: "Page number",
    placeholder: "Page #",
    submitButtonText: "Go",
    submitButtonAriaLabel: "Navigate to Selected Page",
    numberInput: {
      inputButtonGroupAriaLabel: "Pagination Page Input Button Group",
      incrementLabel: "Increase page number",
      decrementLabel: "Decrease page number",
    },
  },
  itemsPerPage: {
    label: "Items Per Page",
    selectAriaLabel: "Items Per Page",
    placeholder: "#/Page",
    closeLabel: "Close page size choices",
    emptyListMessage: "No page sizes available",
  },
}

export const resolveNativePaginationLabels = (
  props: Partial<TNativePaginationProps> = {},
): TNativePaginationLabels => ({
  root: { ...DEFAULT_NATIVE_PAGINATION_LABELS.root, ...props.labels?.root },
  primaryControls: {
    ...DEFAULT_NATIVE_PAGINATION_LABELS.primaryControls,
    firstPageButton: props.firstPageLabel ?? DEFAULT_NATIVE_PAGINATION_LABELS.primaryControls.firstPageButton,
    previousPageButton: props.prevPageLabel ?? DEFAULT_NATIVE_PAGINATION_LABELS.primaryControls.previousPageButton,
    nextPageButton: props.nextPageLabel ?? DEFAULT_NATIVE_PAGINATION_LABELS.primaryControls.nextPageButton,
    lastPageButton: props.lastPageLabel ?? DEFAULT_NATIVE_PAGINATION_LABELS.primaryControls.lastPageButton,
    ...props.labels?.primaryControls,
  },
  pageCounter: {
    ...DEFAULT_NATIVE_PAGINATION_LABELS.pageCounter,
    counterText: props.counterText ?? DEFAULT_NATIVE_PAGINATION_LABELS.pageCounter.counterText,
    ...props.labels?.pageCounter,
  },
  pageInput: {
    ...DEFAULT_NATIVE_PAGINATION_LABELS.pageInput,
    label: props.pageInputLabel ?? DEFAULT_NATIVE_PAGINATION_LABELS.pageInput.label,
    submitButtonText: props.pageInputSelectionButtonText ?? DEFAULT_NATIVE_PAGINATION_LABELS.pageInput.submitButtonText,
    ...props.labels?.pageInput,
    numberInput: { ...DEFAULT_NATIVE_PAGINATION_LABELS.pageInput.numberInput, ...props.labels?.pageInput?.numberInput },
  },
  itemsPerPage: {
    ...DEFAULT_NATIVE_PAGINATION_LABELS.itemsPerPage,
    label: props.itemsPerPageLabel ?? DEFAULT_NATIVE_PAGINATION_LABELS.itemsPerPage.label,
    placeholder: props.itemsPerPageSelectPlaceholder ?? DEFAULT_NATIVE_PAGINATION_LABELS.itemsPerPage.placeholder,
    ...props.labels?.itemsPerPage,
  },
})
