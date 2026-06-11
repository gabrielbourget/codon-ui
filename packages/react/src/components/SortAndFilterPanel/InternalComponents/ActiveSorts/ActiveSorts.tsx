"use client"

import type { FC, ReactNode } from "react"

import type { TTableSortInstruction } from "../../../Table/queryTypes"
import Tag from "../../../TagGroup/AdobeTag/AdobeTag"
import TagGroup from "../../../TagGroup/TagGroup"
import Text from "../../../Text/Text"
import PlaceholderText from "../../../Text/variants/PlaceholderText/PlaceholderText"
import SortParameterList from "../SortParameterList/SortParameterList"

import styles from "./ActiveSortsStyles.module.css"
import type { TActiveSortsProps } from "./helpers"

const { activeSorts, activeSorts__topBar } = styles
const SORT_AND_FILTER_PANEL_GEOMETRY__ROUND = "round"
const SORT_AND_FILTER_PANEL_PRIMARY_COLOR = "var(--cui-color-primary-500)"

const ActiveSorts: FC<TActiveSortsProps> = (props) => {
  const {
    sortParameterList,
    availableSortCriteria,
    onModifySortParameter,
    onSortAscending,
    onSortDescending,
    onDeleteSortParameter,
    onSortParameterDrop,
    onSortParameterDragStart,
    labels,
  } = props

  return (
    <div className={activeSorts}>
      <div className={activeSorts__topBar}>
        <Text variant="b10" customStyles={{ whiteSpace: "nowrap" }}>
          {labels.activeSorts.headingLabel}
        </Text>
        {sortParameterList.length === 0 ? (
          <PlaceholderText>{labels.activeSorts.noSortsFallback}</PlaceholderText>
        ) : null}
        {sortParameterList.length > 0 ? (
          <TagGroup
            aria-label={labels.activeSorts.activeSortsAriaLabel}
            items={sortParameterList}
            selectionMode="none"
            onRemove={(keys) => {
              const targetIDs = Array.from(keys) as string[]
              targetIDs.forEach((targetID) => onDeleteSortParameter(targetID))
            }}
          >
            {(item: object) => {
              const sortParameter = item as unknown as TTableSortInstruction
              return (
                <Tag
                  key={sortParameter.id}
                  color={SORT_AND_FILTER_PANEL_PRIMARY_COLOR}
                  geometry={SORT_AND_FILTER_PANEL_GEOMETRY__ROUND}
                  textValue={sortParameter.criteriaName}
                  customStyles={{ border: "none" }}
                >
                  <Text elementType="span" variant="b11">
                    {sortParameter.criteriaName}
                  </Text>
                </Tag>
              ) as ReactNode
            }}
          </TagGroup>
        ) : null}
      </div>

      {sortParameterList.length > 0 ? (
        <SortParameterList
          onSortAscending={onSortAscending}
          onSortDescending={onSortDescending}
          onDeleteSortParameter={onDeleteSortParameter}
          onModifySortParameter={onModifySortParameter}
          onSortParameterDragStart={onSortParameterDragStart}
          onSortParameterDrop={onSortParameterDrop}
          availableSortCriteria={availableSortCriteria}
          sortParameterList={sortParameterList}
          labels={{
            sortParameterList: labels.sortParameterList,
            sortEntry: labels.sortEntry,
          }}
        />
      ) : null}
    </div>
  )
}

export default ActiveSorts
