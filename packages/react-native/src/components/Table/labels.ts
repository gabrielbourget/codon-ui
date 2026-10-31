export type TNativeTableSelectionLabels = { selectAllRowsAriaLabel: string; selectRowAriaLabel: string }
export type TNativeTableLabels = { selection: TNativeTableSelectionLabels }
export type TPartialNativeTableLabels = { selection?: Partial<TNativeTableSelectionLabels> }
export const DEFAULT_NATIVE_TABLE_LABELS: TNativeTableLabels = {
  selection: { selectAllRowsAriaLabel: "Select All", selectRowAriaLabel: "Select Row" },
}
export const resolveNativeTableLabels = (labels?: TPartialNativeTableLabels): TNativeTableLabels => ({
  selection: { ...DEFAULT_NATIVE_TABLE_LABELS.selection, ...labels?.selection },
})
