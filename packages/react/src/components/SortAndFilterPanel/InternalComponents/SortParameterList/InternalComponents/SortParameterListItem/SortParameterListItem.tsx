"use client"

import type { FC } from "react"
import { Group } from "react-aria-components"

import Button from "../../../../../Button/Button"
import FilterClauseRowDefaultDeleteIcon from "../../../../../Filtering/FilterClauseRow/DefaultDeleteIcon"
import {
  TableHeaderDefaultSortAscendingIcon,
  TableHeaderDefaultSortDescendingIcon,
} from "../../../../../Table/components/TableHeader/DefaultTableHeaderIcons"
import TableRowDefaultDragIndicatorIcon from "../../../../../Table/components/TableRow/DefaultDragIndicatorIcon"
import { TABLE_SORT_DIRECTION__ASCENDING, TABLE_SORT_DIRECTION__DESCENDING } from "../../../../../Table/queryTypes"
import Text from "../../../../../Text/Text"

import type { TSortParameterProps } from "./helpers"
import styles from "./SortParameterListItemStyles.module.css"

const { sortParameterListItem, sortParameterListItem__middleContent, sortParameterListItem__rightContent } = styles
const SORT_AND_FILTER_PANEL_FOREGROUND_COLOR = "var(--cui-foreground)"
const SORT_AND_FILTER_PANEL_PRIMARY_COLOR = "var(--cui-color-primary-500)"

const SortParameterListItem: FC<TSortParameterProps> = (props) => {
  const {
    parameter: { id, criteriaName, sortDirection },
    onSortAscending,
    onSortDescending,
    onDeleteSortParameter,
    labels,
  } = props
  const isSortedAscending = sortDirection === TABLE_SORT_DIRECTION__ASCENDING
  const isSortedDescending = sortDirection === TABLE_SORT_DIRECTION__DESCENDING

  return (
    <div className={sortParameterListItem}>
      <TableRowDefaultDragIndicatorIcon size={10} color={SORT_AND_FILTER_PANEL_FOREGROUND_COLOR} />

      <div className={sortParameterListItem__middleContent}>
        <Text>{criteriaName}</Text>
      </div>

      <Group className={sortParameterListItem__rightContent} aria-label={labels.controlsGroupAriaLabel}>
        <Button
          type="button"
          aria-label={labels.sortAscendingButtonAriaLabel}
          aria-pressed={isSortedAscending}
          transparent
          raised={false}
          customStyles={{ padding: 0 }}
          hoverColor={SORT_AND_FILTER_PANEL_PRIMARY_COLOR}
          onPress={() => {
            if (!isSortedAscending) onSortAscending(id)
          }}
        >
          <TableHeaderDefaultSortAscendingIcon
            size={15}
            color={isSortedAscending ? SORT_AND_FILTER_PANEL_PRIMARY_COLOR : SORT_AND_FILTER_PANEL_FOREGROUND_COLOR}
          />
        </Button>
        <Button
          type="button"
          aria-label={labels.sortDescendingButtonAriaLabel}
          aria-pressed={isSortedDescending}
          transparent
          raised={false}
          customStyles={{ padding: 0 }}
          hoverColor={SORT_AND_FILTER_PANEL_PRIMARY_COLOR}
          onPress={() => {
            if (!isSortedDescending) onSortDescending(id)
          }}
        >
          <TableHeaderDefaultSortDescendingIcon
            size={15}
            color={isSortedDescending ? SORT_AND_FILTER_PANEL_PRIMARY_COLOR : SORT_AND_FILTER_PANEL_FOREGROUND_COLOR}
          />
        </Button>
        <Button
          type="button"
          aria-label={labels.deleteButtonAriaLabel}
          transparent
          raised={false}
          customStyles={{ padding: 0 }}
          onPress={() => onDeleteSortParameter(id)}
          hoverColor={SORT_AND_FILTER_PANEL_PRIMARY_COLOR}
        >
          <FilterClauseRowDefaultDeleteIcon size={15} color={SORT_AND_FILTER_PANEL_FOREGROUND_COLOR} />
        </Button>
      </Group>
    </div>
  )
}

export default SortParameterListItem
