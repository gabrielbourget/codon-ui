import type { FC, ReactNode } from "react"

import Button from "../../../Button/Button"
import FilterClauseRow from "../../../Filtering/FilterClauseRow/FilterClauseRow"
import TableFilterPopoverDefaultAddConditionIcon from "../../../Table/components/TableFilterPopover/DefaultAddConditionIcon"
import {
  TABLE_FILTER_JOIN_OPERATOR__AND,
  TABLE_FILTER_JOIN_OPERATOR__OR,
  type TTableFilterJoinOperator,
} from "../../../Table/queryTypes"
import Tag from "../../../TagGroup/AdobeTag/AdobeTag"
import TagGroup from "../../../TagGroup/TagGroup"
import Text from "../../../Text/Text"
import PlaceholderText from "../../../Text/variants/PlaceholderText/PlaceholderText"
import ToggleSwitcher from "../../../ToggleSwitcher/ToggleSwitcher"

import styles from "./ActiveFiltersStyles.module.css"
import type { TActiveFiltersProps } from "./helpers"

const {
  activeFilters,
  activeFilters__topBar,
  activeFilters__parameterList,
  activeFilters__filterGroup,
  activeFilters__filterGroupHeader,
  activeFilters__filterGroupPrimaryRow,
  activeFilters__filterGroupTitle,
  activeFilters__filterGroupCriteriaTag,
  activeFilters__filterGroupAddButton,
  activeFilters__filterGroupParameterList,
  activeFilters__joinOperatorSwitcher,
} = styles

const SORT_AND_FILTER_PANEL_GEOMETRY__ROUND = "round"
const SORT_AND_FILTER_PANEL_PRIMARY_COLOR = "var(--cui-color-primary-500)"
const SORT_AND_FILTER_PANEL_PRIMARY_FOREGROUND_COLOR = "var(--cui-control-selected-foreground)"

const joinOperatorOptions: { id: TTableFilterJoinOperator }[] = [
  {
    id: TABLE_FILTER_JOIN_OPERATOR__AND,
  },
  {
    id: TABLE_FILTER_JOIN_OPERATOR__OR,
  },
]

const ActiveFilters: FC<TActiveFiltersProps> = (props) => {
  const {
    filterGroupDrafts,
    availableFilterCriteria,
    onChangeFilterGroupJoinOperator,
    onAddFilterParameter,
    onModifyFilterClause,
    onDeleteFilterParameter,
    booleanArgumentComponent,
    labels,
  } = props
  const allClauses = filterGroupDrafts.flatMap((group) =>
    group.clauses.map((clause) => ({ id: clause.id, criteriaName: group.criteriaName })),
  )

  return (
    <div className={activeFilters}>
      <div className={activeFilters__topBar}>
        <Text variant="b10" customStyles={{ whiteSpace: "nowrap" }}>
          {labels.activeFilters.headingLabel}
        </Text>
        {allClauses.length === 0 ? <PlaceholderText>{labels.activeFilters.noFiltersFallback}</PlaceholderText> : null}
        {allClauses.length > 0 ? (
          <TagGroup
            aria-label={labels.activeFilters.activeFiltersAriaLabel}
            items={allClauses}
            selectionMode="none"
            onRemove={(keys) => {
              const targetIDs = Array.from(keys) as string[]
              targetIDs.forEach((targetID) => onDeleteFilterParameter(targetID))
            }}
          >
            {(item: object) => {
              const { id, criteriaName } = item as { id: string; criteriaName: string }

              return (
                <Tag
                  key={id}
                  color={SORT_AND_FILTER_PANEL_PRIMARY_COLOR}
                  geometry={SORT_AND_FILTER_PANEL_GEOMETRY__ROUND}
                  textValue={criteriaName}
                  customStyles={{ border: "none" }}
                >
                  <Text elementType="span" variant="b11">
                    {criteriaName}
                  </Text>
                </Tag>
              ) as ReactNode
            }}
          </TagGroup>
        ) : null}
      </div>
      {filterGroupDrafts.length > 0 ? (
        <div className={activeFilters__parameterList} aria-label={labels.activeFilters.activeFiltersListAriaLabel}>
          {filterGroupDrafts.map((group) => (
            <section
              key={group.id}
              className={activeFilters__filterGroup}
              aria-label={labels.activeFilters.filterGroupAriaLabel({ criteriaName: group.criteriaName })}
            >
              <div className={activeFilters__filterGroupHeader}>
                <div className={activeFilters__filterGroupPrimaryRow}>
                  <div className={activeFilters__filterGroupTitle}>
                    <Text variant="b10" fontWeight="semibold">
                      {labels.activeFilters.filterGroupLabel}
                    </Text>
                    <span className={activeFilters__filterGroupCriteriaTag}>
                      <Text elementType="span" variant="b11" fontWeight="semibold">
                        {group.criteriaName}
                      </Text>
                    </span>
                  </div>

                  <Button
                    aria-label={labels.activeFilters.addFilterButtonAriaLabel({ criteriaName: group.criteriaName })}
                    order="primary"
                    geometry={SORT_AND_FILTER_PANEL_GEOMETRY__ROUND}
                    raised={false}
                    customClassName={activeFilters__filterGroupAddButton}
                    customStyles={{ height: 24, width: 24, padding: 0 }}
                    onPress={() => onAddFilterParameter(group.criteriaID)}
                  >
                    <TableFilterPopoverDefaultAddConditionIcon
                      size={14}
                      color={SORT_AND_FILTER_PANEL_PRIMARY_FOREGROUND_COLOR}
                    />
                  </Button>
                </div>

                {group.clauses.length > 1 ? (
                  <ToggleSwitcher
                    aria-label={labels.activeFilters.matchModeAriaLabel({ criteriaName: group.criteriaName })}
                    items={joinOperatorOptions.map((option) => ({
                      id: option.id,
                      label: labels.activeFilters.joinOperators[option.id],
                    }))}
                    selectedKey={group.joinOperator}
                    onSelectionChange={(selectedKey) =>
                      onChangeFilterGroupJoinOperator(group.criteriaID, selectedKey as TTableFilterJoinOperator)
                    }
                    customClassName={activeFilters__joinOperatorSwitcher}
                    width="100%"
                    uppercase
                    optionFontWeight="bold"
                    selectedOptionFontWeight="bold"
                  />
                ) : null}
              </div>

              <div className={activeFilters__filterGroupParameterList}>
                {group.clauses.map((clause, index) => (
                  <FilterClauseRow
                    key={clause.id}
                    listIndex={index}
                    group={group}
                    clause={clause}
                    availableFilterCriteria={availableFilterCriteria}
                    labels={labels.filtering}
                    onModifyFilterClause={onModifyFilterClause}
                    onDeleteFilterClause={onDeleteFilterParameter}
                    booleanArgumentComponent={booleanArgumentComponent}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default ActiveFilters
