export type TCompactTypeaheadSearchStatusLabels = {
  minimumInputLengthMessage: (args: { minimumInputLength: number }) => string
  loadingMessage: string
  emptyListMessage: string
}

export type TCompactTypeaheadSearchLabels = {
  inputButtonGroupAriaLabel: string
  searchButtonAriaLabel: string
  suggestionsListAriaLabel: string
  status: TCompactTypeaheadSearchStatusLabels
}

export type TPartialCompactTypeaheadSearchStatusLabels = Partial<TCompactTypeaheadSearchStatusLabels>

export type TPartialCompactTypeaheadSearchLabels = Partial<Omit<TCompactTypeaheadSearchLabels, "status">> & {
  status?: TPartialCompactTypeaheadSearchStatusLabels
}

export type TResolveCompactTypeaheadSearchLabelsArgs = {
  labels?: TPartialCompactTypeaheadSearchLabels
  minimumInputLengthMessage?: string
  loadingMessage?: string
  emptyListMessage?: string
}

export const DEFAULT_COMPACT_TYPEAHEAD_SEARCH_LABELS: TCompactTypeaheadSearchLabels = {
  inputButtonGroupAriaLabel: "CompactTypeaheadSearch Input Button Group",
  searchButtonAriaLabel: "CompactTypeaheadSearch Search Button",
  suggestionsListAriaLabel: "Suggestions",
  status: {
    minimumInputLengthMessage: ({ minimumInputLength }) => `Enter at least ${minimumInputLength} characters to search`,
    loadingMessage: "Loading results",
    emptyListMessage: "No matching results found",
  },
}

export const resolveCompactTypeaheadSearchLabels = ({
  labels,
  minimumInputLengthMessage,
  loadingMessage,
  emptyListMessage,
}: TResolveCompactTypeaheadSearchLabelsArgs = {}): TCompactTypeaheadSearchLabels => ({
  ...DEFAULT_COMPACT_TYPEAHEAD_SEARCH_LABELS,
  ...labels,
  status: {
    ...DEFAULT_COMPACT_TYPEAHEAD_SEARCH_LABELS.status,
    ...(minimumInputLengthMessage !== undefined ? { minimumInputLengthMessage: () => minimumInputLengthMessage } : {}),
    ...(loadingMessage !== undefined ? { loadingMessage } : {}),
    ...(emptyListMessage !== undefined ? { emptyListMessage } : {}),
    ...labels?.status,
  },
})
