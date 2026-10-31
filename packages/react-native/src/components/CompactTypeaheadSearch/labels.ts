export type TNativeCompactTypeaheadLabels = {
  inputButtonGroupAriaLabel: string
  searchButtonAriaLabel: string
  suggestionsListAriaLabel: string
  status: {
    minimumInputLengthMessage: (args: { minimumInputLength: number }) => string
    loadingMessage: string
    emptyListMessage: string
  }
}
export type TNativeCompactTypeaheadStatusLabels = TNativeCompactTypeaheadLabels["status"]
export type TPartialNativeCompactTypeaheadStatusLabels = Partial<TNativeCompactTypeaheadStatusLabels>
export type TPartialNativeCompactTypeaheadLabels = Partial<Omit<TNativeCompactTypeaheadLabels, "status">> & {
  status?: TPartialNativeCompactTypeaheadStatusLabels
}
export const DEFAULT_COMPACT_TYPEAHEAD_SEARCH_LABELS: TNativeCompactTypeaheadLabels = {
  inputButtonGroupAriaLabel: "CompactTypeaheadSearch Input Button Group",
  searchButtonAriaLabel: "CompactTypeaheadSearch Search Button",
  suggestionsListAriaLabel: "Suggestions",
  status: {
    minimumInputLengthMessage: ({ minimumInputLength }) => `Enter at least ${minimumInputLength} characters to search`,
    loadingMessage: "Loading results",
    emptyListMessage: "No matching results found",
  },
}
export type TNativeResolveCompactTypeaheadSearchLabelsArgs = {
  labels?: Partial<Omit<TNativeCompactTypeaheadLabels, "status">> & {
    status?: Partial<TNativeCompactTypeaheadLabels["status"]>
  }
  minimumInputLengthMessage?: string
  loadingMessage?: string
  emptyListMessage?: string
}
export const resolveCompactTypeaheadLabels = (
  props: TNativeResolveCompactTypeaheadSearchLabelsArgs = {},
): TNativeCompactTypeaheadLabels => ({
  ...DEFAULT_COMPACT_TYPEAHEAD_SEARCH_LABELS,
  ...props.labels,
  status: {
    ...DEFAULT_COMPACT_TYPEAHEAD_SEARCH_LABELS.status,
    ...(props.minimumInputLengthMessage !== undefined
      ? { minimumInputLengthMessage: () => props.minimumInputLengthMessage! }
      : {}),
    ...(props.loadingMessage !== undefined ? { loadingMessage: props.loadingMessage } : {}),
    ...(props.emptyListMessage !== undefined ? { emptyListMessage: props.emptyListMessage } : {}),
    ...props.labels?.status,
  },
})
