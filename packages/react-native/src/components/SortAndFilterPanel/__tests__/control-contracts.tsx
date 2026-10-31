import { createRef } from "react"
import type { View } from "react-native"

import { DEFAULT_QUERY_CONTROL_LABELS } from "../controlLabels"
import {
  QuerySortCriteriaField,
  QuerySortEntry,
  type TQuerySortCriteriaFieldProps,
  type TQuerySortEntryProps,
} from "../QueryControls"

const field: TQuerySortCriteriaFieldProps = {
  availableSortCriteria: [{ id: "", name: "", defaultDirection: "Descending" }],
  labels: DEFAULT_QUERY_CONTROL_LABELS.form,
  closeLabel: "Close criteria",
  onAddSortParameter: () => {},
}
const entry: TQuerySortEntryProps = {
  parameter: { id: "", criteriaID: "", criteriaName: "", sortDirection: "Ascending" },
  availableSortCriteria: [],
  labels: DEFAULT_QUERY_CONTROL_LABELS.sortEntry,
  onModifySortParameter: () => {},
  onSortAscending: () => {},
  onSortDescending: () => {},
  onDeleteSortParameter: () => {},
}

export const privateQueryControlContracts = [
  <QuerySortCriteriaField {...field} ref={createRef<View>()} />,
  <QuerySortEntry {...entry} canAct={() => false} />,
  // @ts-expect-error The field has no uncontrolled/default selection axis.
  <QuerySortCriteriaField {...field} defaultValue="" />,
  // @ts-expect-error The field does not own a retained selected key.
  <QuerySortCriteriaField {...field} value="" />,
  // @ts-expect-error Browser class names have no native owner.
  <QuerySortEntry {...entry} className="browser-row" />,
]

// @ts-expect-error Native Select dismissal requires an explicitly supplied close label.
export const missingCloseLabel: TQuerySortCriteriaFieldProps = {
  availableSortCriteria: [],
  labels: DEFAULT_QUERY_CONTROL_LABELS.form,
  onAddSortParameter: () => {},
}
