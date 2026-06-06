import classNames from "classnames"
import type { HTMLMotionProps } from "motion/react"
import type { CSSProperties } from "react"

import type { TAriaLabelingProps } from "../../../tokens/a11y"
import {
  computeFilterArgumentTypeFromOperationCode,
  type TModifyFilterClauseArgs,
  type TQueryFilterClauseDraft,
  type TQueryFilterGroupDraft,
} from "../../Table/filterDraft"
import {
  FILTER_ARGUMENT_DATA_TYPE__DATE,
  FILTER_ARGUMENT_DATA_TYPE__DATETIME,
  FILTER_ARGUMENT_DATA_TYPE__TIME,
  type TAvailableBooleanArgumentComponents,
  type TAvailableFilterArgumentTypes,
  type TAvailableFilterCriteria,
  type TAvailableListItem,
  possibleFilterConditionTypes,
} from "../../Table/filterMetadata"
import {
  TABLE_FILTER_CONDITION_TYPE__MULTI_SELECT,
  type TTableFilterArgumentDataType,
  type TTableFilterOperationCode,
} from "../../Table/queryTypes"
import { DEFAULT_TABLE_FILTERING_LABELS, type TPartialTableFilteringLabels } from "../labels"

import styles from "./FilterClauseRowStyles.module.css"

type TFilterClauseRowNativeProps = Omit<HTMLMotionProps<"div">, "children" | "className" | "style">

export type TFilterClauseRowProps = TFilterClauseRowNativeProps &
  TAriaLabelingProps & {
    listIndex: number
    group: TQueryFilterGroupDraft
    clause: TQueryFilterClauseDraft
    availableFilterCriteria: TAvailableFilterCriteria[]
    showCriteriaSelector?: boolean
    hideDeleteButton?: boolean
    booleanArgumentComponent?: TAvailableBooleanArgumentComponents
    labels?: TPartialTableFilteringLabels
    onModifyFilterClause: (args: TModifyFilterClauseArgs) => void
    onDeleteFilterClause: (clauseID: string) => void
    "data-testid"?: string
    className?: string
    style?: CSSProperties
    customClassName?: string
    customStyles?: CSSProperties
    customParameterInfoClassName?: string
    customParameterInfoStyles?: CSSProperties
    customCriteriaFieldClassName?: string
    customCriteriaFieldStyles?: CSSProperties
    customOperationFieldClassName?: string
    customOperationFieldStyles?: CSSProperties
    customConditionTypeFieldClassName?: string
    customConditionTypeFieldStyles?: CSSProperties
    customArgumentClassName?: string
    customArgumentStyles?: CSSProperties
    customDeleteButtonClassName?: string
    customDeleteButtonStyles?: CSSProperties
  }

type TFilterClauseRowCalibration = {
  filterClauseRowStyles: string
  filterClauseRowStyle: CSSProperties
  parameterInfoStyles: string
  criteriaFieldStyles: string
  operationFieldStyles: string
  conditionTypeFieldStyles: string
  argumentStyles: string
  deleteButtonStyles: string
}

export const calibrateComponent = (props: TFilterClauseRowProps): TFilterClauseRowCalibration => {
  const {
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
  } = props

  const filterClauseRowStyles = classNames(styles.filterClauseRow, customClassName, className)
  const parameterInfoStyles = classNames(styles.filterClauseRow__parameterInfo, customParameterInfoClassName)
  const criteriaFieldStyles = classNames(customCriteriaFieldClassName)
  const operationFieldStyles = classNames(customOperationFieldClassName)
  const conditionTypeFieldStyles = classNames(customConditionTypeFieldClassName)
  const argumentStyles = classNames(customArgumentClassName)
  const deleteButtonStyles = classNames(customDeleteButtonClassName)

  const filterClauseRowStyle = { ...customStyles, ...style }

  return {
    filterClauseRowStyles,
    filterClauseRowStyle,
    parameterInfoStyles,
    criteriaFieldStyles,
    operationFieldStyles,
    conditionTypeFieldStyles,
    argumentStyles,
    deleteButtonStyles,
  }
}

export const FILTERING_OPERATION_CODE_TO_LABEL = DEFAULT_TABLE_FILTERING_LABELS.filterClause.operations

export const computeAvailableOperationCodeItems = (
  availableFilterCriteria: TAvailableFilterCriteria[],
  criteriaID: string,
  operationLabels: Partial<Record<TTableFilterOperationCode, string>> = FILTERING_OPERATION_CODE_TO_LABEL,
): TAvailableListItem[] => {
  const selectedCriteria = availableFilterCriteria.find((c) => c.id === criteriaID)

  return (selectedCriteria?.allowedOperationCodes ?? []).map((code) => ({
    id: code,
    name: operationLabels[code] ?? code,
  }))
}

export const computeAvailableFilterConditionTypes = (dataType: TTableFilterArgumentDataType): TAvailableListItem[] => {
  if (
    dataType === FILTER_ARGUMENT_DATA_TYPE__DATE ||
    dataType === FILTER_ARGUMENT_DATA_TYPE__DATETIME ||
    dataType === FILTER_ARGUMENT_DATA_TYPE__TIME
  ) {
    return possibleFilterConditionTypes.filter((item) => item.name !== TABLE_FILTER_CONDITION_TYPE__MULTI_SELECT)
  }

  return possibleFilterConditionTypes
}

export const computeFilterArgumentType = (
  group: TQueryFilterGroupDraft,
  clause: TQueryFilterClauseDraft,
): TAvailableFilterArgumentTypes | undefined => {
  return computeFilterArgumentTypeFromOperationCode({
    dataType: group.dataType as TTableFilterArgumentDataType,
    operationCode: clause.operationCode,
    conditionType: clause.conditionType,
    usesTypeAheadInput: group.usesTypeAheadInput,
    usesSelectInput: group.usesSelectInput,
    usesComboBoxInput: group.usesComboBoxInput,
  })
}
