import { createQueryFilterGroupDraftFromCriteria, normalizeDraftToQueryFilterGroups } from "../filterDraft"
import type { TAvailableFilterCriteria } from "../filterMetadata"
import type {
  TTableFilterArgumentValue,
  TTableFilterDraftArgumentValue,
  TTableFilterOperationCode,
  TTableSortInstruction,
} from "../queryTypes"

const criterion: TAvailableFilterCriteria = {
  id: "",
  name: "Quantity",
  dataType: "number",
  queryKey: "stock.quantity",
  allowedOperationCodes: ["equal", "between"],
  availableCriteriaArguments: [{ id: "zero", name: "Zero", argumentValue: 0 }],
}
const values: TTableFilterArgumentValue[] = [false, 0, "", null, undefined, [], [0, 1], ["a", "b"], ["0", 0]]
const sorting: TTableSortInstruction = { id: "", criteriaID: "", criteriaName: "Quantity", sortDirection: "Ascending" }
export const nativeQueryContract = {
  normalized: normalizeDraftToQueryFilterGroups(createQueryFilterGroupDraftFromCriteria(criterion)),
  values,
  sorting,
}
// @ts-expect-error operation codes are closed
export const unsupportedOperation: TTableFilterOperationCode = "equals"
// @ts-expect-error criterion identities are strings in the canonical query contract
export const numericIdentity: TAvailableFilterCriteria = { id: 0, name: "Zero", dataType: "number" }
// @ts-expect-error unknown date objects are not serialized query arguments
export const objectArgument: TTableFilterArgumentValue = new Date()
// @ts-expect-error Boolean array entries are not serialized query arguments
export const booleanArrayArgument: TTableFilterArgumentValue = [false]
export const invalidSort: TTableSortInstruction = {
  id: "",
  criteriaID: "",
  criteriaName: "Quantity",
  // @ts-expect-error sort direction spellings are canonical
  sortDirection: "ascending",
}

export const incompleteDraftArray: TTableFilterDraftArgumentValue = ["lower", 0, null, undefined]
// @ts-expect-error Normalized arrays cannot contain missing draft entries.
export const incompleteAppliedArray: TTableFilterArgumentValue = [0, undefined]
// @ts-expect-error Nested arrays remain outside the serialized query contract.
export const nestedArgument: TTableFilterDraftArgumentValue = [[0]]
