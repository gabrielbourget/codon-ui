import type { DynamicFilterArgumentInputProps, QueryFilterGroupDraft, TableFilterGroup } from ".."

export const mixedAppliedArgument: TableFilterGroup["clauses"][number]["argument"] = ["edited", 0]
export const incompleteDraftArgument: QueryFilterGroupDraft["clauses"][number]["argument"] = [
  "lower",
  null,
  undefined,
  0,
]
export const incompleteEditorArgument: DynamicFilterArgumentInputProps["argument"] = incompleteDraftArgument
// @ts-expect-error Applied arrays cannot contain incomplete draft entries.
export const incompleteAppliedArgument: TableFilterGroup["clauses"][number]["argument"] = [0, undefined]
// @ts-expect-error Boolean arrays remain outside query arguments.
export const booleanArrayArgument: QueryFilterGroupDraft["clauses"][number]["argument"] = [false]
// @ts-expect-error Nested arrays remain outside query arguments.
export const nestedArrayArgument: DynamicFilterArgumentInputProps["argument"] = [[0]]
