import { type FC, type ReactNode, useMemo } from "react"

import Button from "../../Button/Button"
import Card from "../../Card/Card"
import FormField from "../../FormField/FormField"
import ListBoxItem from "../../ListBoxItem/ListBoxItem"
import Select from "../../Select/Select"
import { computeInitialQueryFilterDraftArgument, createQueryFilterClauseDraft } from "../../Table/filterDraft"
import type { TAvailableListItem } from "../../Table/filterMetadata"
import {
  TABLE_FILTER_OPERATION_CODE__IN,
  TABLE_FILTER_OPERATION_CODE__LIKE,
  TABLE_FILTER_OPERATION_CODE__NOT_IN,
  TABLE_FILTER_OPERATION_CODE__SIMILAR_TO,
  type TTableFilterConditionType,
  type TTableFilterOperationCode,
} from "../../Table/queryTypes"
import DynamicFilterArgumentInput from "../DynamicFilterArgumentInput/DynamicFilterArgumentInput"
import { resolveTableFilteringLabels, type TTableFilterClauseLabels } from "../labels"

import FilterClauseRowDefaultDeleteIcon from "./DefaultDeleteIcon"
import {
  calibrateComponent,
  computeAvailableFilterConditionTypes,
  computeAvailableOperationCodeItems,
  computeFilterArgumentType,
  type TFilterClauseRowProps,
} from "./helpers"

const computeFilterArgumentAccessibleLabel = (args: {
  criteriaName: string
  operationCode?: TTableFilterOperationCode
  labels: TTableFilterClauseLabels
}) => {
  const { criteriaName, operationCode, labels } = args

  if (operationCode === TABLE_FILTER_OPERATION_CODE__LIKE) {
    return labels.containedTextArgumentAccessibleLabel({ criteriaName })
  }

  if (operationCode === TABLE_FILTER_OPERATION_CODE__SIMILAR_TO) {
    return labels.similarTextArgumentAccessibleLabel({ criteriaName })
  }

  return labels.argumentAccessibleLabel({ criteriaName })
}

const FilterClauseRow: FC<TFilterClauseRowProps> = (props) => {
  const {
    "aria-describedby": ariaDescribedBy,
    "aria-details": ariaDetails,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    "data-testid": dataTestID,
    ariaDescribedBy: ariaDescribedByAlias,
    ariaDetails: ariaDetailsAlias,
    ariaLabel: ariaLabelAlias,
    ariaLabelledBy: ariaLabelledByAlias,
    group,
    clause,
    availableFilterCriteria,
    showCriteriaSelector = true,
    hideDeleteButton = false,
    customArgumentClassName,
    customArgumentStyles,
    customClassName,
    customConditionTypeFieldClassName,
    customConditionTypeFieldStyles,
    customCriteriaFieldClassName,
    customCriteriaFieldStyles,
    customDeleteButtonClassName,
    customDeleteButtonStyles,
    customOperationFieldClassName,
    customOperationFieldStyles,
    customParameterInfoClassName,
    customParameterInfoStyles,
    customStyles,
    className,
    onModifyFilterClause,
    onDeleteFilterClause,
    listIndex,
    booleanArgumentComponent,
    labels,
    role = "group",
    style,
    ...rest
  } = props
  const resolvedLabels = useMemo(() => resolveTableFilteringLabels(labels), [labels])
  const filterClauseLabels = resolvedLabels.filterClause

  const conditionTypes = computeAvailableFilterConditionTypes(group.dataType)
  const {
    filterClauseRowStyles,
    filterClauseRowStyle,
    parameterInfoStyles,
    criteriaFieldStyles,
    operationFieldStyles,
    conditionTypeFieldStyles,
    argumentStyles,
    deleteButtonStyles,
  } = calibrateComponent({
    ...props,
    className,
    customArgumentClassName,
    customClassName,
    customConditionTypeFieldClassName,
    customCriteriaFieldClassName,
    customDeleteButtonClassName,
    customOperationFieldClassName,
    customParameterInfoClassName,
    customStyles,
    style,
  })
  const rootAriaLabel =
    ariaLabel ??
    ariaLabelAlias ??
    filterClauseLabels.parameterAriaLabel({ index: listIndex, criteriaName: group.criteriaName })

  return (
    <Card
      {...rest}
      aria-label={rootAriaLabel}
      aria-labelledby={ariaLabelledBy ?? ariaLabelledByAlias}
      aria-describedby={ariaDescribedBy ?? ariaDescribedByAlias}
      aria-details={ariaDetails ?? ariaDetailsAlias}
      data-testid={dataTestID ?? "filter-clause-row"}
      role={role}
      raised={false}
      customClassName={filterClauseRowStyles}
      customStyles={{
        width: "100%",
        flexDirection: "row",
        gap: 10,
        padding: 10,
        ...filterClauseRowStyle,
      }}
    >
      <div
        className={parameterInfoStyles}
        style={customParameterInfoStyles}
        data-testid="filter-clause-row-parameter-info"
      >
        {showCriteriaSelector && (
          <FormField
            aria-label={filterClauseLabels.criteriaLabel}
            label={filterClauseLabels.criteriaLabel}
            labelID="filter-criteria-select-id"
            customClassName={criteriaFieldStyles}
            customStyles={customCriteriaFieldStyles}
          >
            <Select
              aria-labelledby="filter-criteria-select-id"
              items={availableFilterCriteria}
              placeholder={filterClauseLabels.criteriaPlaceholder}
              customStyles={{ width: "100%" }}
              value={group.criteriaID}
              onChange={(id) => {
                const selectedCriteria = availableFilterCriteria.find((item) => item.id === id)
                if (!selectedCriteria) return

                const newOperationCode = selectedCriteria.allowedOperationCodes?.[0]
                onModifyFilterClause({
                  updatedClause: createQueryFilterClauseDraft({
                    id: clause.id,
                    operationCode: newOperationCode,
                    argument: computeInitialQueryFilterDraftArgument(newOperationCode) ?? undefined,
                  }),
                  newCriteriaID: selectedCriteria.id,
                })
              }}
            >
              {(item: object) => {
                const listItem = item as unknown as TAvailableListItem

                return <ListBoxItem id={listItem.id}>{listItem.name}</ListBoxItem>
              }}
            </Select>
          </FormField>
        )}

        <FormField
          aria-label={filterClauseLabels.conditionLabel}
          label={filterClauseLabels.conditionLabel}
          labelID="filter-condition-select-id"
          customClassName={operationFieldStyles}
          customStyles={customOperationFieldStyles}
        >
          <Select
            aria-labelledby="filter-condition-select-id"
            items={computeAvailableOperationCodeItems(
              availableFilterCriteria,
              group.criteriaID,
              filterClauseLabels.operations,
            )}
            placeholder={filterClauseLabels.conditionPlaceholder}
            customStyles={{ width: "100%" }}
            value={clause.operationCode ?? null}
            onChange={(id) => {
              const newOperationCode = id as TTableFilterOperationCode
              onModifyFilterClause({
                updatedClause: createQueryFilterClauseDraft({
                  id: clause.id,
                  operationCode: newOperationCode,
                  argument: computeInitialQueryFilterDraftArgument(newOperationCode) ?? undefined,
                }),
                newCriteriaID: group.criteriaID,
              })
            }}
          >
            {(item: object) => {
              const listItem = item as unknown as TAvailableListItem

              return (<ListBoxItem id={listItem.id}>{listItem.name}</ListBoxItem>) as ReactNode
            }}
          </Select>
        </FormField>

        {clause.operationCode === TABLE_FILTER_OPERATION_CODE__IN ||
        clause.operationCode === TABLE_FILTER_OPERATION_CODE__NOT_IN ? (
          <FormField
            aria-label={filterClauseLabels.conditionTypeLabel}
            label={filterClauseLabels.conditionTypeLabel}
            labelID="filter-condition-type-select-id"
            customClassName={conditionTypeFieldStyles}
            customStyles={customConditionTypeFieldStyles}
          >
            <Select
              aria-labelledby="filter-condition-type-select-id"
              items={conditionTypes}
              placeholder={filterClauseLabels.conditionTypePlaceholder}
              customStyles={{ width: "100%" }}
              value={clause.conditionType ?? null}
              onChange={(id) => {
                const selectedConditionType = conditionTypes.find((item) => item.id === id)
                if (!selectedConditionType) return

                onModifyFilterClause({
                  updatedClause: createQueryFilterClauseDraft({
                    id: clause.id,
                    operationCode: clause.operationCode,
                    conditionType: selectedConditionType.name as TTableFilterConditionType,
                    argument: computeInitialQueryFilterDraftArgument(clause.operationCode) ?? undefined,
                  }),
                  newCriteriaID: group.criteriaID,
                })
              }}
            >
              {(item: object) => {
                const listItem = item as unknown as TAvailableListItem

                return <ListBoxItem id={listItem.id}>{listItem.name}</ListBoxItem>
              }}
            </Select>
          </FormField>
        ) : null}

        <div className={argumentStyles} style={customArgumentStyles} data-testid="filter-clause-row-argument">
          <DynamicFilterArgumentInput
            dataType={group.dataType}
            argument={clause.argument}
            availableFilterArguments={group.availableFilterArguments}
            filterArgumentSelectedKey={clause.filterArgumentSelectedKey ?? null}
            filterArgumentAccessibleLabel={computeFilterArgumentAccessibleLabel({
              criteriaName: group.criteriaName,
              operationCode: clause.operationCode,
              labels: filterClauseLabels,
            })}
            booleanArgumentComponent={booleanArgumentComponent}
            filterArgumentType={computeFilterArgumentType(group, clause)}
            labels={resolvedLabels.argumentInput}
            onArgumentChange={({ argument: newArgument, filterArgumentSelectedKey }) => {
              onModifyFilterClause({
                updatedClause: createQueryFilterClauseDraft({
                  id: clause.id,
                  operationCode: clause.operationCode,
                  conditionType: clause.conditionType,
                  argument: newArgument === null ? undefined : newArgument,
                  filterArgumentSelectedKey,
                }),
                newCriteriaID: group.criteriaID,
              })
            }}
          />
        </div>
      </div>

      {!hideDeleteButton && (
        <Button
          type="button"
          transparent
          aria-label={filterClauseLabels.deleteButtonAriaLabel}
          raised={false}
          customClassName={deleteButtonStyles}
          customStyles={{ padding: 0, ...customDeleteButtonStyles }}
          onPress={() => onDeleteFilterClause(clause.id)}
          hoverColor="var(--aui-control-selected-background)"
        >
          <FilterClauseRowDefaultDeleteIcon
            size={15}
            color="var(--aui-control-foreground)"
            data-testid="filter-clause-row-default-delete-icon"
          />
        </Button>
      )}
    </Card>
  )
}

export default FilterClauseRow
