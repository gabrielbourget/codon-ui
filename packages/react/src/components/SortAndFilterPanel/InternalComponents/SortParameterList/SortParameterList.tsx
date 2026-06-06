import type { FC } from "react"
import { DropIndicator, ListBox, useDragAndDrop } from "react-aria-components"

import type { TSortParameterListProps } from "./helpers"
import ListBoxItem from "./InternalComponents/AnimatedListBoxItem/AnimatedListBoxItem"
import SortParameterListItem from "./InternalComponents/SortParameterListItem/SortParameterListItem"
import styles from "./SortParameterListStyles.module.css"

const { sortParameterList: sortParameterListStyle } = styles

const SortParameterList: FC<TSortParameterListProps> = (props) => {
  const {
    sortParameterList,
    onSortAscending,
    onSortDescending,
    onDeleteSortParameter,
    onModifySortParameter,
    availableSortCriteria,
    onSortParameterDragStart,
    onSortParameterDrop,
    labels,
  } = props

  const { dragAndDropHooks } = useDragAndDrop({
    renderDropIndicator(target) {
      return (
        <DropIndicator
          target={target}
          className={({ isDropTarget }) => `dropIndicator ${isDropTarget ? "active" : ""}`}
        />
      )
    },
    onDragStart: onSortParameterDragStart,
    onReorder: onSortParameterDrop,
    onInsert: onSortParameterDrop,
    getItems: (keys) =>
      [...keys].map((key) => {
        const parameter = sortParameterList.find((parameterItem) => parameterItem.id === key)
        return { "text/plain": parameter!.criteriaName }
      }),
  })

  return (
    <ListBox
      items={sortParameterList}
      className={sortParameterListStyle}
      dragAndDropHooks={dragAndDropHooks}
      selectionMode="none"
      aria-label={labels.sortParameterList.listAriaLabel}
    >
      {(parameter) => (
        <ListBoxItem
          key={parameter.id}
          style={{ height: "auto", width: "100%" }}
          aria-label={labels.sortParameterList.itemAriaLabel({
            criteriaName: parameter.criteriaName,
            sortDirection: parameter.sortDirection,
          })}
        >
          <SortParameterListItem
            key={parameter.id}
            parameter={parameter}
            availableSortCriteria={availableSortCriteria}
            labels={labels.sortEntry}
            onSortAscending={onSortAscending}
            onSortDescending={onSortDescending}
            onDeleteSortParameter={onDeleteSortParameter}
            onModifySortParameter={onModifySortParameter}
          />
        </ListBoxItem>
      )}
    </ListBox>
  )
}

export default SortParameterList
