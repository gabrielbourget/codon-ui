import { createRef } from "react"
import type { View } from "react-native"

import {
  SortAndFilterPanel,
  DEFAULT_SORT_AND_FILTER_PANEL_LABELS,
  resolveSortAndFilterPanelLabels,
  AVAILABLE_SORT_AND_FILTER_PANEL_FOCUS_TARGETS,
  SORT_AND_FILTER_PANEL_FOCUS_TARGET__FILTER,
  type SortAndFilterPanelProps,
  type SortAndFilterPanelFocusTarget,
  type SortAndFilterPanelLabels,
  type SortAndFilterPanelFilterGroup,
  type SortAndFilterPanelSortInstruction,
  type ApplySortAndFilterParametersArgs,
  type AvailableSortAndFilterPanelListItem,
} from "../../.."
const target: SortAndFilterPanelFocusTarget = SORT_AND_FILTER_PANEL_FOCUS_TARGET__FILTER
const item: AvailableSortAndFilterPanelListItem = { id: "", name: "", argumentValue: false }
const sort: SortAndFilterPanelSortInstruction = { id: "", criteriaID: "", criteriaName: "", sortDirection: "Ascending" }
const filter: SortAndFilterPanelFilterGroup = {
  id: "f",
  criteriaID: "active",
  criteriaName: "Active",
  dataType: "boolean",
  joinOperator: "and",
  clauses: [],
}
const labels: SortAndFilterPanelLabels = resolveSortAndFilterPanelLabels({ filtering: { popover: { title: "" } } })
const title: string = labels.filtering.popover.title
const fallback: string = DEFAULT_SORT_AND_FILTER_PANEL_LABELS.filtering.popover.title
const props: SortAndFilterPanelProps = {
  title: "Query",
  height: "100%",
  width: 350,
  horizontalGap: 8,
  position: "right",
  panelGeometry: "rounded",
  raised: true,
  overlayBlur: false,
  isDismissable: true,
  isKeyboardDismissDisabled: false,
  booleanArgumentComponent: "Toggle",
  customModalStyles: { letterSpacing: 1 },
  customDialogStyles: { padding: 10, fontWeight: "600" },
  customOverlayStyles: { opacity: 0.5 },
  labels: {
    form: { addSortCriteriaLabel: "" },
    footer: { applyButton: "" },
    filtering: { argumentInput: { multiInputFallbackPlaceholder: ({ position }) => String(position) } },
  },
  testID: "query-panel",
  "data-testid": "query-alias",
  children: "Unused canonical child",
  isOpen: true,
  onOpenChange: () => {},
  initialFocusTarget: target,
  possibleSortCriteria: [],
  possibleFilterCriteria: [],
  activeSorts: [sort],
  activeFilters: [filter],
  applyPendingSortAndFilterChanges: (value: ApplySortAndFilterParametersArgs) => {
    void value
  },
}
export const complete = <SortAndFilterPanel {...props} />
// @ts-expect-error The wrapper exposes criteria focus targets rather than a public root ref.
export const invalidRootRef = <SortAndFilterPanel {...props} ref={createRef<View>()} />
void [item, title, fallback, AVAILABLE_SORT_AND_FILTER_PANEL_FOCUS_TARGETS]

// @ts-expect-error Native Panel accepts stock RN dimensions rather than viewport CSS units.
export const invalidViewportHeight = <SortAndFilterPanel {...props} height="100vh" />
// @ts-expect-error Criteria focus targets stay bounded to the two original controls.
export const invalidFocusTarget = <SortAndFilterPanel {...props} initialFocusTarget="search" />
// @ts-expect-error The Boolean renderer choice remains the original Checkbox/Toggle union.
export const invalidBooleanRenderer = <SortAndFilterPanel {...props} booleanArgumentComponent="Switch" />
