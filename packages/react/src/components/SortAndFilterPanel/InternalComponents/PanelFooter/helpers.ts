import type { TSortAndFilterPanelFooterLabels } from "../../labels"

export type TPanelFooterProps = {
  labels: TSortAndFilterPanelFooterLabels
  onClearAllSortAndFilterParameters: () => void
  onCancelPendingChanges: () => void
  onApplyPendingChanges: () => void
}
