import type { TSortAndFilterPanelHeaderLabels } from "../../labels"

export type TPanelHeaderProps = {
  title: string
  labels: TSortAndFilterPanelHeaderLabels
  onCloseSortAndFilterPanel: () => void
}
