import { View, type StyleProp, type TextStyle, type ViewStyle } from "react-native"

import { useNativeTheme } from "../../theme"
import { Button } from "../Button/Button"
import { resolveNativeStyle } from "../colors"
import { FormField } from "../FormField/FormField"
import { Select } from "../Select/Select"
import {
  computeInitialQueryFilterDraftArgument,
  createQueryFilterClauseDraft,
  type TModifyFilterClauseArgs,
  type TQueryFilterClauseDraft,
  type TQueryFilterGroupDraft,
} from "../Table/filterDraft"
import type { TAvailableFilterCriteria } from "../Table/filterMetadata"
import type { TTableFilterConditionType } from "../Table/queryTypes"

import { FilterDeleteGlyph } from "./FilterDeleteGlyph"
import { resolveFilterClauseLabels, type TPartialFilterClauseLabels } from "./labels"
import { computeAvailableFilterConditionTypes, computeAvailableOperationCodeItems } from "./metadata"
import { useFilterRequest, type TFilterAvailability } from "./requests"

export type TFilterClauseSelectorsProps = TFilterAvailability & {
  group: TQueryFilterGroupDraft
  clause: TQueryFilterClauseDraft
  availableFilterCriteria: TAvailableFilterCriteria[]
  labels?: TPartialFilterClauseLabels
  showCriteriaSelector?: boolean
  hideDeleteButton?: boolean
  closeLabels: { criteria: string; operation: string; conditionType: string }
  onModifyFilterClause: (args: TModifyFilterClauseArgs) => void
  onDeleteFilterClause: (id: string) => void
  customParameterInfoStyles?: StyleProp<ViewStyle>
  customCriteriaFieldStyles?: StyleProp<TextStyle>
  customOperationFieldStyles?: StyleProp<TextStyle>
  customConditionTypeFieldStyles?: StyleProp<TextStyle>
  customDeleteButtonStyles?: StyleProp<TextStyle>
}
const hasClause = (props: TFilterClauseSelectorsProps) =>
  props.group.clauses.some((item) => item.id === props.clause.id)

// Selector controls only; the complete Card/row and argument renderer remain separate owners.
export const FilterClauseSelectors = (props: TFilterClauseSelectorsProps) => {
  const labels = resolveFilterClauseLabels(props.labels)
  const request = useFilterRequest(props)
  const direct = useFilterRequest(props, false)
  const theme = useNativeTheme()
  const conditions = computeAvailableFilterConditionTypes(props.group.dataType)
  const operations = computeAvailableOperationCodeItems(
    props.availableFilterCriteria,
    props.group.criteriaID,
    labels.operations,
  )
  const rootStyle = resolveNativeStyle<ViewStyle>(
    [{ width: "100%", gap: theme.spacing.unit }, props.customParameterInfoStyles],
    "FilterClauseSelectors",
    "customParameterInfoStyles",
  )
  return (
    <View testID="filter-clause-selectors" style={rootStyle}>
      {props.showCriteriaSelector !== false && (
        <FormField label={labels.criteriaLabel} customStyles={props.customCriteriaFieldStyles}>
          <Select
            items={props.availableFilterCriteria}
            getKey={(item) => item.id}
            getTextValue={(item) => item.name}
            accessibilityLabel={labels.criteriaLabel}
            closeLabel={props.closeLabels.criteria}
            placeholder={labels.criteriaPlaceholder}
            width="100%"
            value={props.group.criteriaID}
            onChange={request((current, key: string | number | null) => {
              const selected = current.availableFilterCriteria.find((item) => item.id === key)
              if (!hasClause(current) || !selected) return
              const operationCode = selected.allowedOperationCodes?.[0]
              current.onModifyFilterClause({
                newCriteriaID: selected.id,
                updatedClause: createQueryFilterClauseDraft({
                  id: current.clause.id,
                  operationCode,
                  argument: computeInitialQueryFilterDraftArgument(operationCode) ?? undefined,
                }),
              })
            })}
          />
        </FormField>
      )}
      <FormField label={labels.conditionLabel} customStyles={props.customOperationFieldStyles}>
        <Select
          items={operations}
          getKey={(item) => item.id}
          getTextValue={(item) => item.name}
          accessibilityLabel={labels.conditionLabel}
          closeLabel={props.closeLabels.operation}
          placeholder={labels.conditionPlaceholder}
          width="100%"
          value={props.clause.operationCode ?? null}
          onChange={request((current, key: string | number | null) => {
            const available = computeAvailableOperationCodeItems(
              current.availableFilterCriteria,
              current.group.criteriaID,
            )
            const selected = available.find((item) => item.id === key)
            if (!hasClause(current) || !selected) return
            current.onModifyFilterClause({
              newCriteriaID: current.group.criteriaID,
              updatedClause: createQueryFilterClauseDraft({
                id: current.clause.id,
                operationCode: selected.id,
                argument: computeInitialQueryFilterDraftArgument(selected.id) ?? undefined,
              }),
            })
          })}
        />
      </FormField>
      {(props.clause.operationCode === "in" || props.clause.operationCode === "not-in") && (
        <FormField label={labels.conditionTypeLabel} customStyles={props.customConditionTypeFieldStyles}>
          <Select
            items={conditions}
            getKey={(item) => item.id}
            getTextValue={(item) => item.name}
            accessibilityLabel={labels.conditionTypeLabel}
            closeLabel={props.closeLabels.conditionType}
            placeholder={labels.conditionTypePlaceholder}
            width="100%"
            value={props.clause.conditionType ?? null}
            onChange={request((current, key: string | number | null) => {
              if (
                !hasClause(current) ||
                (current.clause.operationCode !== "in" && current.clause.operationCode !== "not-in")
              )
                return
              const selected = computeAvailableFilterConditionTypes(current.group.dataType).find(
                (item) => item.id === key,
              )
              if (!selected) return
              current.onModifyFilterClause({
                newCriteriaID: current.group.criteriaID,
                updatedClause: createQueryFilterClauseDraft({
                  id: current.clause.id,
                  operationCode: current.clause.operationCode,
                  conditionType: selected.name as TTableFilterConditionType,
                  argument: computeInitialQueryFilterDraftArgument(current.clause.operationCode) ?? undefined,
                }),
              })
            })}
          />
        </FormField>
      )}
      {!props.hideDeleteButton && (
        <Button
          aria-label={labels.deleteButtonAriaLabel}
          transparent
          raised={false}
          customStyles={[{ padding: 0 }, props.customDeleteButtonStyles]}
          hoverColor={theme.colors.controlSelectedBackground}
          onPress={direct((current) => {
            if (hasClause(current)) current.onDeleteFilterClause(current.clause.id)
          })}
        >
          <FilterDeleteGlyph color={theme.colors.controlForeground} />
        </Button>
      )}
    </View>
  )
}
