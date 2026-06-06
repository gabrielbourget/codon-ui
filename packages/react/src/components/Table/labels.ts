export type TTableSelectionLabels = {
  selectAllRowsAriaLabel: string
  selectRowAriaLabel: string
}

export type TTableLabels = {
  selection: TTableSelectionLabels
}

export type TPartialTableLabels = {
  selection?: Partial<TTableSelectionLabels>
}

export const DEFAULT_TABLE_LABELS: TTableLabels = {
  selection: {
    selectAllRowsAriaLabel: "Select All",
    selectRowAriaLabel: "Select Row",
  },
}

export const resolveTableLabels = (labels?: TPartialTableLabels): TTableLabels => ({
  selection: {
    ...DEFAULT_TABLE_LABELS.selection,
    ...labels?.selection,
  },
})
