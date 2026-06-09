export type TTypeaheadSearchStatusLabels = {
  idleMessage: string
  minimumInputLengthMessage: (args: { minimumInputLength: number }) => string
  loadingMessage: string
  emptyListMessage: string
  errorMessage: string
}

export type TTypeaheadSearchLabels = {
  searchButtonAriaLabel: string
  resultsListAriaLabel: string
  status: TTypeaheadSearchStatusLabels
}

export type TPartialTypeaheadSearchStatusLabels = Partial<TTypeaheadSearchStatusLabels>

export type TPartialTypeaheadSearchLabels = Partial<Omit<TTypeaheadSearchLabels, "status">> & {
  status?: TPartialTypeaheadSearchStatusLabels
}

export type TResolveTypeaheadSearchLabelsArgs = {
  labels?: TPartialTypeaheadSearchLabels
  minimumInputLength?: number
  idleMessage?: string
  minimumInputLengthMessage?: string
  loadingMessage?: string
  emptyListMessage?: string
  errorMessage?: string
  searchButtonAriaLabel?: string
}

export const DEFAULT_TYPEAHEAD_SEARCH_LABELS: TTypeaheadSearchLabels = {
  searchButtonAriaLabel: "Search",
  resultsListAriaLabel: "Search results",
  status: {
    idleMessage: "Use the search input to search",
    minimumInputLengthMessage: ({ minimumInputLength }) => `Enter at least ${minimumInputLength} characters to search`,
    loadingMessage: "Loading results",
    emptyListMessage: "No matching results found",
    errorMessage: "Something went wrong while searching",
  },
}

export const resolveTypeaheadSearchLabels = ({
  labels,
  idleMessage,
  minimumInputLengthMessage,
  loadingMessage,
  emptyListMessage,
  errorMessage,
  searchButtonAriaLabel,
}: TResolveTypeaheadSearchLabelsArgs = {}): TTypeaheadSearchLabels => ({
  ...DEFAULT_TYPEAHEAD_SEARCH_LABELS,
  ...(searchButtonAriaLabel !== undefined ? { searchButtonAriaLabel } : {}),
  ...labels,
  status: {
    ...DEFAULT_TYPEAHEAD_SEARCH_LABELS.status,
    ...(idleMessage !== undefined ? { idleMessage } : {}),
    ...(minimumInputLengthMessage !== undefined ? { minimumInputLengthMessage: () => minimumInputLengthMessage } : {}),
    ...(loadingMessage !== undefined ? { loadingMessage } : {}),
    ...(emptyListMessage !== undefined ? { emptyListMessage } : {}),
    ...(errorMessage !== undefined ? { errorMessage } : {}),
    ...labels?.status,
  },
})
