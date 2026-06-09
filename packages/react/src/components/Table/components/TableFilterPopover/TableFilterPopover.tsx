import classNames from "classnames"
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react"
import { Button as AdobeButton, DialogTrigger } from "react-aria-components"

import { ROUND } from "../../../../tokens/geometry"
import Button from "../../../Button/Button"
import ClickPopover from "../../../ClickPopover/ClickPopover"
import FilterClauseRow from "../../../Filtering/FilterClauseRow/FilterClauseRow"
import { resolveTableFilteringLabels, type TPartialTableFilteringLabels } from "../../../Filtering/labels"
import Tag from "../../../Tag/Tag"
import Text from "../../../Text/Text"
import ToggleSwitcher from "../../../ToggleSwitcher/ToggleSwitcher"
import {
  computeNextQueryFilterClauseOperationCode,
  createQueryFilterClauseDraft,
  normalizeDraftToQueryFilterGroups,
  type TModifyFilterClauseArgs,
  type TQueryFilterGroupDraft,
} from "../../filterDraft"
import type { TAvailableFilterCriteria, TAvailableListItem } from "../../filterMetadata"
import type { TTableColumnMetadata } from "../../helpers"
import {
  TABLE_FILTER_ARGUMENT_DATA_TYPE__TEXT,
  TABLE_FILTER_JOIN_OPERATOR__AND,
  TABLE_FILTER_JOIN_OPERATOR__OR,
  type TTableFilterGroup,
  type TTableFilterJoinOperator,
} from "../../queryTypes"

import TableFilterPopoverDefaultAddConditionIcon from "./DefaultAddConditionIcon"
import styles from "./TableFilterPopoverStyles.module.css"

export type TTableFilterPopoverProps<T extends object> = {
  "data-testid"?: string
  column: TTableColumnMetadata<T>
  filterGroup?: TTableFilterGroup
  activeFilters: TTableFilterGroup[]
  onFiltersChange: (nextFilters: TTableFilterGroup[]) => void
  isFilterActive: boolean
  activeFilterIcon: ReactNode
  inactiveFilterIcon: ReactNode
  triggerClassName?: string
  triggerStyle?: CSSProperties
  className?: string
  style?: CSSProperties
  customClassName?: string
  customStyles?: CSSProperties
  customTriggerClassName?: string
  customTriggerStyles?: CSSProperties
  customPopoverClassName?: string
  customPopoverStyles?: CSSProperties
  customTitleRowClassName?: string
  customTitleRowStyles?: CSSProperties
  customTitleGroupClassName?: string
  customTitleGroupStyles?: CSSProperties
  customClauseListClassName?: string
  customClauseListStyles?: CSSProperties
  customActionsClassName?: string
  customActionsStyles?: CSSProperties
  labels?: TPartialTableFilteringLabels
}

const replaceFilterGroup = (
  activeFilters: TTableFilterGroup[],
  criteriaID: string,
  nextFilterGroup?: TTableFilterGroup,
): TTableFilterGroup[] => {
  let replacedExistingGroup = false

  const nextFilters = activeFilters.flatMap((filterGroup) => {
    if (filterGroup.criteriaID !== criteriaID) return [filterGroup]

    replacedExistingGroup = true
    return nextFilterGroup ? [nextFilterGroup] : []
  })

  return !replacedExistingGroup && nextFilterGroup ? [...nextFilters, nextFilterGroup] : nextFilters
}

const getFilterArgumentValue = (item: TAvailableListItem) => item.argumentValue ?? item.name

const inferFilterArgumentSelectedKey = (
  availableFilterArguments: TAvailableListItem[] | undefined,
  argument: TTableFilterGroup["clauses"][number]["argument"],
) => {
  if (!availableFilterArguments?.length) return null

  const matchedArgument = availableFilterArguments.find((item) => getFilterArgumentValue(item) === argument)
  return matchedArgument?.id ?? null
}

const buildDefaultDraft = <T extends object>(
  column: TTableColumnMetadata<T>,
  filterGroup?: TTableFilterGroup,
): TQueryFilterGroupDraft => {
  const criteriaID = column.filter?.criteriaID ?? column.id
  const criteriaName = column.name ?? column.id
  const queryKey = column.filter?.queryKey
  const dataType = column.filter?.dataType ?? TABLE_FILTER_ARGUMENT_DATA_TYPE__TEXT
  const allowedOperationCodes = column.filter?.allowedOperationCodes ?? []
  const availableFilterArguments = column.filter?.availableCriteriaArguments

  if (filterGroup && filterGroup.clauses.length > 0) {
    return {
      id: criteriaID,
      criteriaID,
      criteriaName,
      queryKey,
      dataType,
      joinOperator: filterGroup.joinOperator,
      usesTypeAheadInput: column.filter?.usesTypeAheadInput,
      typeAheadInputOnChange: column.filter?.typeAheadInputOnChange,
      usesSelectInput: column.filter?.usesSelectInput,
      usesComboBoxInput: column.filter?.usesComboBoxInput,
      availableFilterArguments,
      clauses: filterGroup.clauses.map((clause) => ({
        id: clause.id,
        operationCode: clause.operationCode,
        argument: clause.argument,
        filterArgumentSelectedKey: inferFilterArgumentSelectedKey(availableFilterArguments, clause.argument),
      })),
    }
  }

  const defaultClauses = [
    createQueryFilterClauseDraft({
      id: `${criteriaID}-clause-1`,
      operationCode: computeNextQueryFilterClauseOperationCode({
        allowedOperationCodes,
      }),
    }),
  ]

  return {
    id: criteriaID,
    criteriaID,
    criteriaName,
    queryKey,
    dataType,
    joinOperator: TABLE_FILTER_JOIN_OPERATOR__AND,
    usesTypeAheadInput: column.filter?.usesTypeAheadInput,
    typeAheadInputOnChange: column.filter?.typeAheadInputOnChange,
    usesSelectInput: column.filter?.usesSelectInput,
    usesComboBoxInput: column.filter?.usesComboBoxInput,
    availableFilterArguments,
    clauses: defaultClauses,
  }
}

const TableFilterPopover = <T extends object>({
  "data-testid": dataTestID,
  className,
  column,
  filterGroup,
  activeFilters,
  onFiltersChange,
  isFilterActive,
  activeFilterIcon,
  inactiveFilterIcon,
  triggerClassName,
  triggerStyle,
  style,
  customActionsClassName,
  customActionsStyles,
  customClassName,
  customClauseListClassName,
  customClauseListStyles,
  customPopoverClassName,
  customPopoverStyles,
  customStyles,
  customTitleGroupClassName,
  customTitleGroupStyles,
  customTitleRowClassName,
  customTitleRowStyles,
  customTriggerClassName,
  customTriggerStyles,
  labels,
}: TTableFilterPopoverProps<T>) => {
  const criteriaID = column.filter?.criteriaID ?? column.id
  const criteriaName = column.name ?? column.id
  const allowedOperationCodes = column.filter?.allowedOperationCodes ?? []
  const resolvedLabels = useMemo(() => resolveTableFilteringLabels(labels), [labels])
  const joinOperatorItems = useMemo(
    () => [
      {
        id: TABLE_FILTER_JOIN_OPERATOR__AND,
        label: resolvedLabels.popover.joinOperators[TABLE_FILTER_JOIN_OPERATOR__AND],
      },
      {
        id: TABLE_FILTER_JOIN_OPERATOR__OR,
        label: resolvedLabels.popover.joinOperators[TABLE_FILTER_JOIN_OPERATOR__OR],
      },
    ],
    [resolvedLabels],
  )

  const columnCriteria: TAvailableFilterCriteria = {
    id: criteriaID,
    name: criteriaName,
    queryKey: column.filter?.queryKey,
    dataType: column.filter?.dataType ?? TABLE_FILTER_ARGUMENT_DATA_TYPE__TEXT,
    allowedOperationCodes,
    usesTypeAheadInput: column.filter?.usesTypeAheadInput,
    typeAheadInputOnChange: column.filter?.typeAheadInputOnChange,
    usesSelectInput: column.filter?.usesSelectInput,
    usesComboBoxInput: column.filter?.usesComboBoxInput,
    availableCriteriaArguments: column.filter?.availableCriteriaArguments,
  }

  const [draft, setDraft] = useState<TQueryFilterGroupDraft>(() => buildDefaultDraft(column, filterGroup))
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    setDraft(buildDefaultDraft(column, filterGroup))
  }, [column, filterGroup])

  const handleModifyClause = ({ updatedClause }: TModifyFilterClauseArgs) => {
    setDraft((prev) => ({
      ...prev,
      clauses: prev.clauses.map((c) => (c.id === updatedClause.id ? updatedClause : c)),
    }))
  }

  const handleDeleteClause = (clauseID: string) => {
    setDraft((prev) => ({
      ...prev,
      clauses: prev.clauses.filter((c) => c.id !== clauseID),
    }))
  }

  const handleAddClause = () => {
    const usedOpCodes = new Set(draft.clauses.map((c) => c.operationCode))
    const nextOpCode = computeNextQueryFilterClauseOperationCode({
      allowDuplicateOperationCodes: false,
      allowedOperationCodes,
      existingOperationCodes: Array.from(usedOpCodes),
    })
    if (!nextOpCode) return

    setDraft((prev) => ({
      ...prev,
      clauses: [
        ...prev.clauses,
        createQueryFilterClauseDraft({
          id: `${criteriaID}-clause-${prev.clauses.length + 1}`,
          operationCode: nextOpCode,
        }),
      ],
    }))
  }

  const handleJoinOperatorChange = (joinOperator: TTableFilterJoinOperator) => {
    setDraft((prev) => ({ ...prev, joinOperator }))
  }

  const applyFilter = () => {
    const normalized = normalizeDraftToQueryFilterGroups(draft)
    onFiltersChange(replaceFilterGroup(activeFilters, criteriaID, normalized[0]))
    setIsOpen(false)
  }

  const clearFilter = () => {
    setDraft(buildDefaultDraft(column))
    onFiltersChange(replaceFilterGroup(activeFilters, criteriaID))
    setIsOpen(false)
  }

  const canAddClause = draft.clauses.length < allowedOperationCodes.length

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      <AdobeButton
        type="button"
        aria-label={resolvedLabels.popover.triggerButtonAriaLabel({ criteriaName })}
        aria-pressed={isFilterActive}
        className={classNames(triggerClassName, customTriggerClassName)}
        style={{ ...customTriggerStyles, ...triggerStyle }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {isFilterActive ? activeFilterIcon : inactiveFilterIcon}
      </AdobeButton>

      <ClickPopover
        placement="bottom left"
        customClassName={customPopoverClassName}
        customStyles={{ width: "auto", padding: 0, ...customPopoverStyles }}
        offset={0}
      >
        <form
          className={classNames(styles.tableFilterPopover, customClassName, className)}
          style={{ ...customStyles, ...style }}
          data-testid={dataTestID ?? "table-filter-popover"}
          onClick={(e) => e.stopPropagation()}
          onSubmit={(event) => {
            event.preventDefault()
            event.stopPropagation()
            applyFilter()
          }}
        >
          <div
            className={classNames(styles.tableFilterPopover__titleRow, customTitleRowClassName)}
            style={customTitleRowStyles}
          >
            <div
              className={classNames(styles.tableFilterPopover__titleGroup, customTitleGroupClassName)}
              style={customTitleGroupStyles}
            >
              <Text customClassName={styles.tableFilterPopover__title} elementType="p" variant="b10" fontWeight="bold">
                {resolvedLabels.popover.title}
              </Text>
              <Tag
                color="var(--aui-control-selected-background)"
                geometry={ROUND}
                aria-label={resolvedLabels.popover.criteriaTagAriaLabel({ criteriaName })}
                customClassName={styles.tableFilterPopover__criteriaTag}
                customStyles={{ border: "none", color: "var(--aui-control-selected-foreground)" }}
              >
                <Text elementType="span" variant="b11" fontWeight="semibold">
                  {criteriaName}
                </Text>
              </Tag>
            </div>

            {allowedOperationCodes.length > 1 && (
              <Button
                type="button"
                order="primary"
                geometry={ROUND}
                raised={false}
                isDisabled={!canAddClause}
                aria-label={resolvedLabels.popover.addConditionButtonAriaLabel}
                customStyles={{ height: 24, width: 24, padding: 0, flexShrink: 0 }}
                onPress={handleAddClause}
              >
                <TableFilterPopoverDefaultAddConditionIcon
                  size={14}
                  color="var(--aui-control-selected-foreground)"
                  data-testid="table-filter-popover-default-add-condition-icon"
                />
              </Button>
            )}
          </div>

          <div className={styles.tableFilterPopover__form}>
            {draft.clauses.length > 1 && (
              <ToggleSwitcher
                aria-label={resolvedLabels.popover.matchModeAriaLabel({ criteriaName })}
                items={joinOperatorItems}
                selectedKey={draft.joinOperator}
                onSelectionChange={(key) => handleJoinOperatorChange(key as TTableFilterJoinOperator)}
                width="100%"
                uppercase
                optionFontWeight="bold"
                selectedOptionFontWeight="bold"
              />
            )}

            <div
              className={classNames(styles.tableFilterPopover__clauseList, customClauseListClassName)}
              style={customClauseListStyles}
            >
              {draft.clauses.map((clause, index) => (
                <FilterClauseRow
                  key={clause.id}
                  listIndex={index}
                  group={draft}
                  clause={clause}
                  availableFilterCriteria={[columnCriteria]}
                  showCriteriaSelector={false}
                  hideDeleteButton={draft.clauses.length === 1}
                  labels={resolvedLabels}
                  onModifyFilterClause={handleModifyClause}
                  onDeleteFilterClause={handleDeleteClause}
                />
              ))}
            </div>
          </div>

          <div
            className={classNames(styles.tableFilterPopover__actions, customActionsClassName)}
            style={customActionsStyles}
          >
            <Button type="button" transparent raised={false} onPress={clearFilter}>
              <Text elementType="span" variant="b11">
                {resolvedLabels.popover.clearButton}
              </Text>
            </Button>
            <Button type="submit" order="primary" raised={false}>
              <Text elementType="span" variant="b11">
                {resolvedLabels.popover.applyButton}
              </Text>
            </Button>
          </div>
        </form>
      </ClickPopover>
    </DialogTrigger>
  )
}

export default TableFilterPopover
