import { NativeThemeProvider, Text } from "../../../../packages/react-native/src"
import { buildFilterGroupDraftsFromQueryFilterGroups } from "../../../../packages/react-native/src/components/SortAndFilterPanel/hydration"
import { normalizeDraftToQueryFilterGroups } from "../../../../packages/react-native/src/components/Table/filterDraft"
import type { TAvailableFilterCriteria } from "../../../../packages/react-native/src/components/Table/filterMetadata"
import type { TTableFilterGroup } from "../../../../packages/react-native/src/components/Table/queryTypes"

const criteria: readonly TAvailableFilterCriteria[] = [
  {
    id: "active",
    name: "Active",
    queryKey: "events.active",
    dataType: "boolean",
    availableCriteriaArguments: [{ id: "", name: "False", argumentValue: false }],
  },
  {
    id: "count",
    name: "Count",
    queryKey: "events.count",
    dataType: "number",
    availableCriteriaArguments: [{ id: "zero", name: "Zero", argumentValue: 0 }],
  },
]
const applied: readonly TTableFilterGroup[] = [
  {
    id: "active-group",
    criteriaID: "active",
    criteriaName: "Old active label",
    dataType: "boolean",
    joinOperator: "and",
    clauses: [{ id: "active-clause", operationCode: "equal", argument: false }],
  },
  {
    id: "count-group",
    criteriaID: "count",
    criteriaName: "Old count label",
    dataType: "number",
    joinOperator: "or",
    clauses: [{ id: "count-clause", operationCode: "greater-than-equal", argument: 0 }],
  },
]

// Nonshipping data/bundle probe. It is not a Table or SortAndFilterPanel UI or installed acceptance scene.
const NativeQueryDraftProof = () => {
  const drafts = buildFilterGroupDraftsFromQueryFilterGroups(applied, criteria)
  const normalized = normalizeDraftToQueryFilterGroups(drafts)
  return (
    <NativeThemeProvider>
      <Text testID="native-query-draft-proof">{JSON.stringify({ drafts, normalized })}</Text>
    </NativeThemeProvider>
  )
}
export default NativeQueryDraftProof
