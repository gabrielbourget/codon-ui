import type { RefAttributes } from "react"
import { View, type StyleProp, type TextStyle, type ViewStyle } from "react-native"

import { useNativeTheme } from "../../theme"
import { Button } from "../Button/Button"
import { Card } from "../Card/Card"
import type { TNativeCardProps, TNativeCardRef } from "../Card/types"
import { resolveNativeStyle } from "../colors"
import { createQueryFilterClauseDraft } from "../Table/filterDraft"
import { resolveNativeTableFilteringLabels, type TPartialNativeTableFilteringLabels } from "../Table/filterLabels"

import { FilterClauseSelectors, type TFilterClauseSelectorsProps } from "./FilterClauseSelectors"
import { FilterDeleteGlyph } from "./FilterDeleteGlyph"
import { computeFilterArgumentType, computeFilterArgumentAccessibleLabel } from "./metadata"
import { renderNonTemporalFilterArgumentInput, isNonTemporalFilterArgumentDataType } from "./renderNonTemporalArgument"
import { useFilterRequest } from "./requests"

export type TNativeFilterClauseRowProps = Omit<TNativeCardProps, "children" | "style" | "customStyles"> &
  RefAttributes<TNativeCardRef> &
  Omit<TFilterClauseSelectorsProps, "labels" | "closeLabels" | "customParameterInfoStyles"> & {
    listIndex: number
    labels?: TPartialNativeTableFilteringLabels
    accessibilityLabel?: string
    testID?: string
    booleanArgumentComponent?: "Checkbox" | "Toggle"
    customStyles?: StyleProp<TextStyle>
    style?: StyleProp<TextStyle>
    customParameterInfoStyles?: StyleProp<ViewStyle>
    customArgumentStyles?: StyleProp<ViewStyle>
  }
export const FilterClauseRow = (props: TNativeFilterClauseRowProps) => {
  const labels = resolveNativeTableFilteringLabels(props.labels)
  const theme = useNativeTheme()
  const request = useFilterRequest(props)
  const direct = useFilterRequest(props, false)
  const {
    group,
    clause,
    listIndex: _index,
    availableFilterCriteria: _criteria,
    showCriteriaSelector: _showCriteria,
    hideDeleteButton: _hideDelete,
    labels: _labels,
    canAct: _canAct,
    booleanArgumentComponent: _boolean,
    onModifyFilterClause: _modify,
    onDeleteFilterClause: _delete,
    customStyles: _custom,
    style: _style,
    customParameterInfoStyles: _parameterStyle,
    customArgumentStyles: _argumentStyle,
    customCriteriaFieldStyles: _criteriaStyle,
    customOperationFieldStyles: _operationStyle,
    customConditionTypeFieldStyles: _conditionStyle,
    customDeleteButtonStyles: _deleteStyle,
    ...card
  } = props
  const kind = computeFilterArgumentType(group, clause)
  if (kind && !isNonTemporalFilterArgumentDataType(group.dataType))
    throw new Error(
      `Native temporal filter editor is not constructed: ${group.dataType}. Picker construction remains required.`,
    )
  return (
    <Card
      {...card}
      testID={props.testID ?? props["data-testid"] ?? "filter-clause-row"}
      role={props.role ?? "group"}
      accessible={props.accessible ?? false}
      accessibilityLabel={
        props.accessibilityLabel ??
        props["aria-label"] ??
        labels.filterClause.parameterAriaLabel({ index: props.listIndex, criteriaName: group.criteriaName })
      }
      raised={false}
      customStyles={resolveNativeStyle(
        [
          {
            width: "100%",
            height: "auto",
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            padding: 10,
            backgroundColor: theme.colors.controlHoverBackground,
            borderRadius: 5,
          },
          props.customStyles,
          props.style,
        ],
        "FilterClauseRow",
        "style",
      )}
    >
      <View
        style={[{ flex: 1, width: "100%", gap: 5 }, props.customParameterInfoStyles]}
        testID="filter-clause-row-parameter-info"
      >
        <FilterClauseSelectors
          {...props}
          customParameterInfoStyles={undefined}
          hideDeleteButton
          labels={labels.filterClause}
          closeLabels={{
            criteria: "Close filter criteria",
            operation: labels.native.closeOperation,
            conditionType: labels.native.closeConditionType,
          }}
        />
        <View testID="filter-clause-row-argument" style={props.customArgumentStyles}>
          {isNonTemporalFilterArgumentDataType(group.dataType) &&
            renderNonTemporalFilterArgumentInput({
              dataType: group.dataType,
              argument: clause.argument,
              filterArgumentType: kind,
              filterArgumentSelectedKey: clause.filterArgumentSelectedKey ?? null,
              availableFilterArguments: group.availableFilterArguments,
              booleanArgumentComponent: props.booleanArgumentComponent,
              filterArgumentAccessibleLabel: computeFilterArgumentAccessibleLabel({
                criteriaName: group.criteriaName,
                operationCode: clause.operationCode,
                labels: labels.filterClause,
              }),
              labels: labels.argumentInput,
              nativeLabels: labels.native,
              canAct: props.canAct,
              onArgumentChange: request((current, { argument, filterArgumentSelectedKey }) => {
                if (!current.group.clauses.some((candidate) => candidate.id === current.clause.id)) return
                current.onModifyFilterClause({
                  newCriteriaID: current.group.criteriaID,
                  updatedClause: createQueryFilterClauseDraft({
                    id: current.clause.id,
                    operationCode: current.clause.operationCode,
                    conditionType: current.clause.conditionType,
                    argument: argument === null ? undefined : argument,
                    filterArgumentSelectedKey,
                  }),
                })
              }),
            })}
        </View>
      </View>
      {!props.hideDeleteButton && (
        <Button
          transparent
          raised={false}
          accessibilityLabel={labels.filterClause.deleteButtonAriaLabel}
          hoverColor={theme.colors.controlSelectedBackground}
          customStyles={[{ padding: 0 }, props.customDeleteButtonStyles]}
          onPress={direct((current) => {
            if (current.group.clauses.some((candidate) => candidate.id === current.clause.id))
              current.onDeleteFilterClause(current.clause.id)
          })}
        >
          <FilterDeleteGlyph color={theme.colors.controlForeground} />
        </Button>
      )}
    </Card>
  )
}
