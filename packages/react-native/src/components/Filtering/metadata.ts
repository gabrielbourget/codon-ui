import {
  computeFilterArgumentTypeFromOperationCode,
  type TQueryFilterClauseDraft,
  type TQueryFilterGroupDraft,
} from "../Table/filterDraft"
import { possibleFilterConditionTypes, type TAvailableFilterCriteria } from "../Table/filterMetadata"
import type { TTableFilterArgumentDataType, TTableFilterOperationCode } from "../Table/queryTypes"

import { DEFAULT_FILTER_CLAUSE_LABELS, type TTableFilterClauseLabels } from "./labels"

export const computeAvailableOperationCodeItems = (
  criteria: TAvailableFilterCriteria[],
  criteriaID: string,
  labels: Partial<Record<TTableFilterOperationCode, string>> = DEFAULT_FILTER_CLAUSE_LABELS.operations,
) =>
  (criteria.find((item) => item.id === criteriaID)?.allowedOperationCodes ?? []).map((id) => ({
    id,
    name: labels[id] ?? id,
  }))

export const computeAvailableFilterConditionTypes = (dataType: TTableFilterArgumentDataType) =>
  dataType === "date" || dataType === "date-time" || dataType === "time"
    ? possibleFilterConditionTypes.filter((item) => item.name !== "Multi-Select")
    : possibleFilterConditionTypes

export const computeFilterArgumentType = (group: TQueryFilterGroupDraft, clause: TQueryFilterClauseDraft) =>
  computeFilterArgumentTypeFromOperationCode({
    dataType: group.dataType,
    operationCode: clause.operationCode,
    conditionType: clause.conditionType,
    usesTypeAheadInput: group.usesTypeAheadInput,
    usesSelectInput: group.usesSelectInput,
    usesComboBoxInput: group.usesComboBoxInput,
  })

export const computeFilterArgumentAccessibleLabel = ({
  criteriaName,
  operationCode,
  labels = DEFAULT_FILTER_CLAUSE_LABELS,
}: {
  criteriaName: string
  operationCode?: TTableFilterOperationCode
  labels?: Pick<
    TTableFilterClauseLabels,
    "argumentAccessibleLabel" | "containedTextArgumentAccessibleLabel" | "similarTextArgumentAccessibleLabel"
  >
}): string => {
  if (operationCode === "like") return labels.containedTextArgumentAccessibleLabel({ criteriaName })
  if (operationCode === "similar-to") return labels.similarTextArgumentAccessibleLabel({ criteriaName })
  return labels.argumentAccessibleLabel({ criteriaName })
}
